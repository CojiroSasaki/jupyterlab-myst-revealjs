import {
  Cell,
  CodeCell,
  ICellModel,
  ICodeCellModel,
  MarkdownCell
} from '@jupyterlab/cells';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel, INotebookTracker } from '@jupyterlab/notebook';
import { IRenderMimeRegistry, MimeModel } from '@jupyterlab/rendermime';
import { Widget } from '@lumino/widgets';
import type { ISlideshowConfig } from './settings';

export type SlideType =
  | 'slide'
  | 'subslide'
  | 'fragment'
  | 'notes'
  | 'skip'
  | '-';

interface ICellSlideInfo {
  slideType: SlideType;
  tags: string[];
  cell: ICellModel;
  backgroundAttrs: Record<string, string>;
  state: string | null;
}

interface ICodeCellEntry {
  codeCell: CodeCell;
  container: HTMLElement;
}

export class SlideBuilder {
  private _model: INotebookModel;
  private _rendermime: IRenderMimeRegistry;
  private _contentFactory: Cell.IContentFactory;
  private _tracker: INotebookTracker;
  private _context: DocumentRegistry.IContext<INotebookModel>;
  private _config: Required<ISlideshowConfig>;
  private _codeCellEntries: ICodeCellEntry[] = [];
  private _isDisposed = false;

  // Parser state
  private _cells!: INotebookModel['cells'];
  private _pos = 0;

  constructor(options: SlideBuilder.IOptions) {
    this._model = options.model;
    this._rendermime = options.rendermime;
    this._contentFactory = options.contentFactory;
    this._tracker = options.tracker;
    this._context = options.context;
    this._config = options.config;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  dispose(): void {
    this._disposeCodeCells();
    this._isDisposed = true;
  }

  findFocusedCodeCell(): CodeCell | null {
    for (const entry of this._codeCellEntries) {
      if (entry.container.contains(document.activeElement)) {
        return entry.codeCell;
      }
    }
    return null;
  }

  async buildAll(): Promise<HTMLElement> {
    this._disposeCodeCells();

    const slidesDiv = document.createElement('div');
    slidesDiv.className = 'slides';

    this._cells = this._model.cells;
    this._pos = 0;

    await this._parseSlides(slidesDiv);

    return slidesDiv;
  }

  /**
   * Attach all CodeCell widgets to the DOM via Lumino lifecycle.
   * Must be called after the slides DOM has been placed in the document.
   */
  attachCodeCells(): void {
    for (const entry of this._codeCellEntries) {
      if (!entry.codeCell.isAttached) {
        Widget.attach(entry.codeCell, entry.container);
      }
    }
  }

  // ── Parser: recursive descent ──────────────────────────

  /**
   * slides → slide*
   */
  private async _parseSlides(parent: HTMLElement): Promise<void> {
    while (this._peek() !== null) {
      await this._parseSlide(parent);
    }
  }

  /**
   * slide → (SLIDE | implicit) subslide (SUBSLIDE subslide)*
   *
   * Creates an outer <section> (horizontal slide group).
   * Each subslide becomes a nested inner <section>.
   */
  private async _parseSlide(parent: HTMLElement): Promise<void> {
    const outer = document.createElement('section');

    // First subslide (starts with SLIDE or implicit)
    await this._parseSubSlide(outer);

    // Additional subslides
    while (this._peek()?.slideType === 'subslide') {
      await this._parseSubSlide(outer);
    }

    parent.appendChild(outer);
  }

  /**
   * subslide → cell*
   *
   * Creates an inner <section>. Consumes the leading SLIDE/SUBSLIDE token
   * and all continuation cells (-, fragment, notes) until the next
   * SLIDE or SUBSLIDE.
   */
  private async _parseSubSlide(parent: HTMLElement): Promise<void> {
    const section = document.createElement('section');

    // Consume the leading slide/subslide token
    const first = this._peek()!;
    if (first.slideType === 'slide' || first.slideType === 'subslide') {
      // Apply background attributes from the leading cell
      for (const [attr, value] of Object.entries(first.backgroundAttrs)) {
        section.setAttribute(attr, value);
      }
      if (first.state) {
        section.setAttribute('data-state', first.state);
      }
      await this._appendCell(section);
    }

    // Consume cell groups: each base cell followed by its "-" continuations
    let fragmentIndex = -1;
    let info: ICellSlideInfo | null;
    while ((info = this._peek()) !== null) {
      if (info.slideType === 'slide' || info.slideType === 'subslide') {
        break;
      }
      fragmentIndex = await this._parseCellGroup(section, fragmentIndex);
    }

    parent.appendChild(section);
  }

  // ── Lexer ──────────────────────────────────────────────

  /**
   * Return slide info for the current cell, skipping over
   * cells with slide_type "skip".
   */
  private _peek(): ICellSlideInfo | null {
    while (this._pos < this._cells.length) {
      const cell = this._cells.get(this._pos);
      const info = this._getSlideInfo(cell);

      if (info.slideType === 'skip') {
        this._pos++;
        continue;
      }
      return info;
    }
    return null;
  }

  // ── Cell rendering ─────────────────────────────────────

  /**
   * cell_group → base_cell ("-")*
   *
   * Consumes one base cell and all following "-" continuation cells.
   * Continuation cells inherit the base cell's slide type (RISE semantics).
   * Returns the updated fragment index.
   */
  private async _parseCellGroup(
    section: HTMLElement,
    fragmentIndex: number
  ): Promise<number> {
    const base = this._peek()!;

    if (base.slideType === 'fragment') {
      // New fragment group: continuations share the same data-fragment-index
      fragmentIndex++;
      const node = await this._consumeCell();
      node.classList.add('fragment');
      node.setAttribute('data-fragment-index', String(fragmentIndex));
      section.appendChild(node);
      while (this._peek()?.slideType === '-') {
        const cont = await this._consumeCell();
        cont.classList.add('fragment');
        cont.setAttribute('data-fragment-index', String(fragmentIndex));
        section.appendChild(cont);
      }
    } else if (base.slideType === 'notes') {
      // Notes group: continuations go into the same <aside>
      const aside = document.createElement('aside');
      aside.className = 'notes';
      aside.appendChild(await this._consumeCell());
      while (this._peek()?.slideType === '-') {
        aside.appendChild(await this._consumeCell());
      }
      section.appendChild(aside);
    } else {
      // Regular cell (or "-" with no prior typed context)
      section.appendChild(await this._consumeCell());
      while (this._peek()?.slideType === '-') {
        section.appendChild(await this._consumeCell());
      }
    }

    return fragmentIndex;
  }

  /**
   * Consume one cell from the token stream and render it to a DOM node.
   * Applies gridwidth and hide-cell tag handling.
   */
  private async _consumeCell(): Promise<HTMLElement> {
    const info = this._peek()!;
    const cellIndex = this._pos;
    this._pos++;

    const node =
      info.cell.type === 'code'
        ? this._renderCodeCell(info.cell as ICodeCellModel, info.tags)
        : await this._renderMarkdownCell(info.cell, cellIndex);

    this._applyGridwidth(node, info.tags);

    if (info.cell.type !== 'code' && info.tags.includes('hide-cell')) {
      node.classList.add('jp-Slideshow-hideCell');
    }

    return node;
  }

  /**
   * Consume one cell and append its DOM node to the parent element.
   */
  private async _appendCell(parent: HTMLElement): Promise<void> {
    parent.appendChild(await this._consumeCell());
  }

  private _disposeCodeCells(): void {
    for (const entry of this._codeCellEntries) {
      if (entry.codeCell.isAttached) {
        Widget.detach(entry.codeCell);
      }
      entry.codeCell.dispose();
    }
    this._codeCellEntries = [];
  }

  private _getSlideInfo(cell: ICellModel): ICellSlideInfo {
    const slideshow = cell.getMetadata('slideshow') as
      | Record<string, unknown>
      | undefined;
    const rawType = (slideshow?.slide_type as string) ?? '-';

    const validTypes: SlideType[] = [
      'slide',
      'subslide',
      'fragment',
      'notes',
      'skip'
    ];
    const slideType: SlideType = validTypes.includes(rawType as SlideType)
      ? (rawType as SlideType)
      : '-';

    const tags: string[] =
      (cell.getMetadata('tags') as string[] | undefined) ?? [];

    const backgroundAttrs: Record<string, string> = {};
    if (slideshow) {
      const prefix = 'slide_background_';
      for (const key of Object.keys(slideshow)) {
        if (key.startsWith(prefix) && typeof slideshow[key] === 'string') {
          const attr =
            'data-background-' + key.slice(prefix.length).replace(/_/g, '-');
          backgroundAttrs[attr] = slideshow[key] as string;
        }
      }
    }

    const state =
      slideshow && typeof slideshow.slide_state === 'string'
        ? slideshow.slide_state
        : this._config.slide_state;

    return { slideType, tags, cell, backgroundAttrs, state };
  }

  private _applyGridwidth(node: HTMLElement, tags: string[]): void {
    for (const tag of tags) {
      if (tag.startsWith('gridwidth-')) {
        node.classList.add(tag);
      }
    }
  }

  private _renderCodeCell(cell: ICodeCellModel, tags: string[]): HTMLElement {
    const codeCell = new CodeCell({
      model: cell,
      rendermime: this._rendermime,
      contentFactory: this._contentFactory
    });
    codeCell.initializeState();

    if (tags.includes('hide-input')) {
      codeCell.addClass('jp-Slideshow-hideInput');
    }
    if (tags.includes('hide-output')) {
      codeCell.addClass('jp-Slideshow-hideOutput');
    }
    if (tags.includes('hide-cell')) {
      codeCell.addClass('jp-Slideshow-hideCell');
    }
    if (tags.includes('remove-input')) {
      codeCell.addClass('jp-Slideshow-removeInput');
    }
    if (tags.includes('remove-output')) {
      codeCell.addClass('jp-Slideshow-removeOutput');
    }

    const container = document.createElement('div');
    container.className = 'jp-Slideshow-codeCellContainer';
    container.tabIndex = 0;
    this._codeCellEntries.push({ codeCell, container });
    return container;
  }

  private async _renderMarkdownCell(
    cell: ICellModel,
    cellIndex: number
  ): Promise<HTMLElement> {
    const container = document.createElement('div');
    container.className = 'jp-Slideshow-markdownCell';

    // Prefer the globally-processed DOM from NotebookPanel so that
    // cross-slide equation references (label/eqref) are resolved.
    const notebookPanel = this._tracker.find(w => w.context === this._context);
    if (notebookPanel) {
      const cellWidget = notebookPanel.content.widgets[cellIndex];
      if (cellWidget instanceof MarkdownCell) {
        const mystNode = cellWidget.node.querySelector('.myst');
        if (mystNode) {
          container.appendChild(mystNode.cloneNode(true));
          return container;
        }
      }
    }

    // Fallback: independent rendering (no cross-slide equation resolution)
    const source = cell.sharedModel.getSource();
    const renderer = this._rendermime.createRenderer('text/markdown');
    const model = new MimeModel({
      data: { 'text/markdown': source },
      trusted: cell.trusted
    });
    await renderer.renderModel(model);
    container.appendChild(renderer.node);

    return container;
  }
}

export namespace SlideBuilder {
  export interface IOptions {
    model: INotebookModel;
    rendermime: IRenderMimeRegistry;
    contentFactory: Cell.IContentFactory;
    tracker: INotebookTracker;
    context: DocumentRegistry.IContext<INotebookModel>;
    config: Required<ISlideshowConfig>;
  }
}
