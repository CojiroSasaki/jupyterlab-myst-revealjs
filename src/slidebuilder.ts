import { Cell, CodeCell, ICellModel, ICodeCellModel } from '@jupyterlab/cells';
import { INotebookModel } from '@jupyterlab/notebook';
import { IRenderMimeRegistry, MimeModel } from '@jupyterlab/rendermime';
import { Widget } from '@lumino/widgets';

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
}

interface ICodeCellEntry {
    codeCell: CodeCell;
    container: HTMLElement;
}

export class SlideBuilder {
    private _model: INotebookModel;
    private _rendermime: IRenderMimeRegistry;
    private _contentFactory: Cell.IContentFactory;
    private _codeCellEntries: ICodeCellEntry[] = [];
    private _isDisposed = false;

    // Parser state
    private _cells!: INotebookModel['cells'];
    private _pos = 0;

    constructor(options: SlideBuilder.IOptions) {
        this._model = options.model;
        this._rendermime = options.rendermime;
        this._contentFactory = options.contentFactory;
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
            if (entry.codeCell.node.contains(document.activeElement)) {
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
            await this._appendCell(section);
        }

        // Consume continuation cells
        let info: ICellSlideInfo | null;
        while ((info = this._peek()) !== null) {
            if (info.slideType === 'slide' || info.slideType === 'subslide') {
                break;
            }
            await this._appendCell(section);
        }

        parent.appendChild(section);
    }

    // ── Lexer ──────────────────────────────────────────────

    /**
     * Return slide info for the current cell, skipping over
     * cells that should be excluded (skip / remove-cell).
     */
    private _peek(): ICellSlideInfo | null {
        while (this._pos < this._cells.length) {
            const cell = this._cells.get(this._pos);
            const info = this._getSlideInfo(cell);

            if (info.slideType === 'skip' || info.tags.includes('remove-cell')) {
                this._pos++;
                continue;
            }
            return info;
        }
        return null;
    }

    // ── Cell rendering ─────────────────────────────────────

    /**
     * Consume one cell and append its DOM node to the section.
     * Applies fragment class and notes wrapper based on slide_type.
     */
    private async _appendCell(section: HTMLElement): Promise<void> {
        const info = this._peek()!;
        this._pos++;

        const node = info.cell.type === 'code'
            ? this._renderCodeCell(info.cell as ICodeCellModel, info.tags)
            : await this._renderMarkdownCell(info.cell);

        this._applyGridwidth(node, info.tags);

        if (info.cell.type !== 'code' && info.tags.includes('hide-cell')) {
            node.classList.add('jp-Slideshow-hideCell');
        }

        if (info.slideType === 'fragment') {
            node.classList.add('fragment');
            section.appendChild(node);
        } else if (info.slideType === 'notes') {
            const aside = document.createElement('aside');
            aside.className = 'notes';
            aside.appendChild(node);
            section.appendChild(aside);
        } else {
            section.appendChild(node);
        }
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
            | { slide_type?: string }
            | undefined;
        const rawType = slideshow?.slide_type ?? '-';

        const validTypes: SlideType[] = [
            'slide', 'subslide', 'fragment', 'notes', 'skip'
        ];
        const slideType: SlideType = validTypes.includes(rawType as SlideType)
            ? (rawType as SlideType)
            : '-';

        const tags: string[] =
            (cell.getMetadata('tags') as string[] | undefined) ?? [];

        return { slideType, tags, cell };
    }

    private _applyGridwidth(node: HTMLElement, tags: string[]): void {
        for (const tag of tags) {
            if (tag.startsWith('gridwidth-')) {
                node.classList.add(tag);
            }
        }
    }

    private _renderCodeCell(
        cell: ICodeCellModel,
        tags: string[]
    ): HTMLElement {
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
        this._codeCellEntries.push({ codeCell, container });
        return container;
    }

    private async _renderMarkdownCell(cell: ICellModel): Promise<HTMLElement> {
        const container = document.createElement('div');
        container.className = 'jp-Slideshow-markdownCell';

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
    }
}
