import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import Reveal from 'reveal.js';
import type { RevealApi } from 'reveal.js';
import { getThemeCss, type ISlideshowConfig } from './settings';

export class SlideshowContent extends Widget {
  private _reveal: RevealApi | null = null;
  private _revealDiv: HTMLDivElement;
  private _slidesDiv: HTMLDivElement;
  private _config: Required<ISlideshowConfig>;
  private _customStyleEl: HTMLStyleElement | null = null;
  private _tooltipEl: HTMLDivElement | null = null;

  constructor(config: Required<ISlideshowConfig>) {
    super();
    this._config = config;
    this.addClass('jp-SlideshowContent');

    // Inject scoped CSS (core + theme)
    const { coreCss, themeCss } = getThemeCss(config.theme);
    const styleEl = document.createElement('style');
    styleEl.textContent = coreCss + '\n' + themeCss;
    this.node.appendChild(styleEl);

    this._revealDiv = document.createElement('div');
    this._revealDiv.className = 'reveal';

    this._slidesDiv = document.createElement('div');
    this._slidesDiv.className = 'slides';

    this._revealDiv.appendChild(this._slidesDiv);

    // Header / footer: empty divs inside .reveal but outside .slides.
    // reveal.js scales .slides only, so these stay at viewport coordinates.
    // Content and styling are defined by the user in myst-revealjs.css
    // (e.g. via ::after pseudo-elements).  When empty, offsetHeight is 0
    // and updateScrollingSections() ignores them.
    const headerDiv = document.createElement('div');
    headerDiv.className = 'jp-Slideshow-header';
    this._revealDiv.appendChild(headerDiv);

    const footerDiv = document.createElement('div');
    footerDiv.className = 'jp-Slideshow-footer';
    this._revealDiv.appendChild(footerDiv);

    this.node.appendChild(this._revealDiv);
  }

  async updateSlides(slidesContainer: HTMLElement): Promise<void> {
    this._slidesDiv.replaceChildren(...Array.from(slidesContainer.childNodes));
    this._attachReferenceTooltips();

    if (!this._reveal && this.isAttached) {
      await this._initReveal();
    }
  }

  injectCustomCss(css: string): void {
    if (!this._customStyleEl) {
      this._customStyleEl = document.createElement('style');
      this.node.appendChild(this._customStyleEl);
    }
    this._customStyleEl.textContent = css;
  }

  /**
   * Adjust sections to account for header/footer overlays and enable
   * scrolling when content overflows.
   *
   * - All sections get padding to prevent content from hiding behind
   *   the absolutely-positioned header/footer.  For non-scrolling
   *   sections, reveal.js centering still works because it uses
   *   scrollHeight (which includes padding).
   * - When scroll is enabled, sections whose content exceeds the
   *   available height get an explicit height + overflow-y so the
   *   user can scroll.
   *
   * Must be called AFTER reveal.js layout() so we can override the
   * top value it sets.
   */
  updateScrollingSections(): void {
    // Measure header/footer heights
    const headerEl = this._revealDiv.querySelector(
      '.jp-Slideshow-header'
    ) as HTMLElement | null;
    const footerEl = this._revealDiv.querySelector(
      '.jp-Slideshow-footer'
    ) as HTMLElement | null;
    const headerH = headerEl ? headerEl.offsetHeight : 0;
    const footerH = footerEl ? footerEl.offsetHeight : 0;

    const sections = this._slidesDiv.querySelectorAll(
      ':scope > section:not(.stack), :scope > section.stack > section'
    );

    const threshold = this._config.scroll
      ? this._config.height * 0.95 - headerH - footerH
      : Infinity;

    const availableH = this._config.height - headerH - footerH;

    // Phase 1: clear our overrides so scrollHeight reflects natural
    // content height.
    for (const section of Array.from(sections)) {
      const el = section as HTMLElement;
      el.style.top = '';
      el.style.height = '';
      el.style.overflowY = '';
    }

    // Phase 2: recalculate layout with natural heights
    if (this._reveal) {
      this._reveal.layout();
    }

    // Phase 3: override top to center content within the header–footer
    // region, or enable scrolling for overflowing sections.
    for (const section of Array.from(sections)) {
      const el = section as HTMLElement;

      const state = el.getAttribute('data-state') ?? '';

      if (this._config.scroll && el.scrollHeight > threshold) {
        // Scrolling section: position below header, constrain height
        el.style.top = headerH + 'px';
        el.style.height = threshold + 'px';
        el.style.overflowY = 'auto';
      } else if (state === 'middle') {
        // Vertically center content within available area
        const contentH = el.scrollHeight;
        const top = headerH + Math.max((availableH - contentH) / 2, 0);
        el.style.top = top + 'px';
      } else if (headerH > 0) {
        // Position below header
        el.style.top = headerH + 'px';
      }
    }
  }

  syncReveal(): void {
    if (this._reveal) {
      const indices = this._reveal.getIndices() ?? { h: 0, v: 0 };
      this._reveal.sync();
      this._reveal.layout();
      const total = this._reveal.getTotalSlides();
      if (total > 0) {
        this._reveal.slide(Math.min(indices.h, total - 1), indices.v);
      }
    }
  }

  protected onBeforeDetach(_msg: Message): void {
    if (this._reveal) {
      this._reveal.destroy();
      this._reveal = null;
    }
  }

  protected onResize(_msg: Widget.ResizeMessage): void {
    if (this._reveal) {
      this.updateScrollingSections();
    }
  }

  dispose(): void {
    if (this._reveal) {
      this._reveal.destroy();
      this._reveal = null;
    }
    super.dispose();
  }

  /**
   * Resolve the tooltip content for a cross-reference target.
   *
   * Returns the kind of reference and the element to clone into the
   * tooltip, or null if the target is not a supported reference type.
   * Future kinds (table, section) can be added here.
   */
  private _resolveTooltipTarget(
    targetEl: Element
  ): { kind: 'equation' | 'figure'; node: Element } | null {
    if (targetEl.querySelector('.katex-display')) {
      return { kind: 'equation', node: targetEl };
    }

    if (targetEl.tagName === 'FIGURE') {
      return { kind: 'figure', node: targetEl };
    }
    const figure = targetEl.querySelector('figure');
    if (figure) {
      return { kind: 'figure', node: figure };
    }

    return null;
  }

  private _attachReferenceTooltips(): void {
    this._tooltipEl?.remove();
    this._tooltipEl = null;

    const links = this._slidesDiv.querySelectorAll('a.hover-link');
    for (const link of Array.from(links)) {
      link.addEventListener('mouseenter', (e: Event) => {
        const anchor = e.currentTarget as HTMLAnchorElement;
        const targetId = anchor.getAttribute('href')?.replace(/^#/, '');
        if (!targetId) {
          return;
        }

        const targetEl = this._slidesDiv.querySelector(
          `#${CSS.escape(targetId)}`
        );
        if (!targetEl) {
          return;
        }

        const resolved = this._resolveTooltipTarget(targetEl);
        if (!resolved) {
          return;
        }

        const tooltip = document.createElement('div');
        tooltip.className = 'jp-Slideshow-refTooltip';
        tooltip.appendChild(resolved.node.cloneNode(true));

        // The tooltip is placed inside .reveal but outside .slides,
        // so it would otherwise inherit .reveal's font-size (e.g. 42px
        // from the theme) instead of the .myst-scoped size used on the
        // slide. Copy the original element's computed font-size; for
        // equations apply a 1.2x boost for readability.
        const scale = resolved.kind === 'equation' ? 1.2 : 1.0;
        const origFontSize = parseFloat(
          getComputedStyle(resolved.node).fontSize
        );
        tooltip.style.fontSize = origFontSize * scale + 'px';

        // For figures, mirror the source's rendered width so an image
        // inside a width-constrained ancestor (e.g. gridwidth-1-2)
        // does not balloon back to its natural size in the tooltip.
        if (resolved.kind === 'figure') {
          tooltip.style.maxWidth =
            resolved.node.getBoundingClientRect().width + 'px';
        }

        // Append hidden so we can measure the tooltip, then place it
        // within the container with vertical flip and horizontal
        // clipping so it never spills out of the slide viewport.
        tooltip.style.visibility = 'hidden';
        this._revealDiv.appendChild(tooltip);

        const rect = anchor.getBoundingClientRect();
        const containerRect = this._revealDiv.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const margin = 4;

        const spaceBelow = containerRect.bottom - rect.bottom;
        let top: number;
        if (spaceBelow >= tooltipRect.height + margin) {
          top = rect.bottom - containerRect.top + margin;
        } else {
          // Flip above the link, but never past the container top
          top = Math.max(
            0,
            rect.top - containerRect.top - tooltipRect.height - margin
          );
        }

        let left = rect.left - containerRect.left;
        const maxLeft = containerRect.width - tooltipRect.width;
        if (left > maxLeft) {
          left = Math.max(0, maxLeft);
        }

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        tooltip.style.visibility = '';

        this._tooltipEl = tooltip;
      });

      link.addEventListener('mouseleave', () => {
        this._tooltipEl?.remove();
        this._tooltipEl = null;
      });
    }
  }

  private async _initReveal(): Promise<void> {
    const c = this._config;
    const deck = new Reveal(this._revealDiv, {
      // Architecture-fixed options
      embedded: true,
      keyboardCondition: 'focused',
      hash: false,
      history: false,
      margin: 0.04,
      // User-configurable options
      width: c.width,
      height: c.height,
      controls: c.controls,
      progress: c.progress,
      slideNumber: c.slide_number,
      center: false,
      transition: c.transition as
        | 'none'
        | 'fade'
        | 'slide'
        | 'convex'
        | 'concave'
        | 'zoom',
      scrollActivationWidth: c.scroll ? 0 : undefined
    });
    await deck.initialize();
    this._reveal = deck;

    // Re-apply scrolling overrides after reveal.js re-layouts on slide change
    deck.on('slidechanged', () => {
      this.updateScrollingSections();
    });
  }
}
