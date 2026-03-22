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
        this.node.appendChild(this._revealDiv);

        // Header / footer overlays
        if (config.header) {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'jp-Slideshow-header';
            headerDiv.innerHTML = config.header;
            this._revealDiv.appendChild(headerDiv);
        }
        if (config.footer) {
            const footerDiv = document.createElement('div');
            footerDiv.className = 'jp-Slideshow-footer';
            footerDiv.innerHTML = config.footer;
            this._revealDiv.appendChild(footerDiv);
        }
    }

    get revealInstance(): RevealApi | null {
        return this._reveal;
    }

    async updateSlides(slidesContainer: HTMLElement): Promise<void> {
        this._slidesDiv.replaceChildren(
            ...Array.from(slidesContainer.childNodes)
        );

        if (!this._reveal && this.isAttached) {
            await this._initReveal();
        }
    }

    syncReveal(): void {
        if (this._reveal) {
            const indices = this._reveal.getIndices() ?? { h: 0, v: 0 };
            this._reveal.sync();
            this._reveal.layout();
            const total = this._reveal.getTotalSlides();
            if (total > 0) {
                this._reveal.slide(
                    Math.min(indices.h, total - 1),
                    indices.v
                );
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
            this._reveal.layout();
        }
    }

    dispose(): void {
        if (this._reveal) {
            this._reveal.destroy();
            this._reveal = null;
        }
        super.dispose();
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
            slideNumber: c.slideNumber,
            center: c.center,
            transition: c.transition as 'none' | 'fade' | 'slide' | 'convex' | 'concave' | 'zoom',
            scrollActivationWidth: c.scroll ? 0 : undefined,
        });
        await deck.initialize();
        this._reveal = deck;
    }
}
