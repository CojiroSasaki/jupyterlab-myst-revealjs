import { Cell, CodeCell, ICellModel, ICodeCellModel } from '@jupyterlab/cells';
import { INotebookModel } from '@jupyterlab/notebook';
import { IRenderMimeRegistry, MimeModel } from '@jupyterlab/rendermime';
import { Widget } from '@lumino/widgets';

export type SlideType = 'slide' | 'skip' | '-';

interface ICellSlideInfo {
    slideType: SlideType;
    tags: string[];
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

        let currentSection: HTMLElement | null = null;

        const cells = this._model.cells;
        for (let i = 0; i < cells.length; i++) {
            const cell = cells.get(i);
            const info = this._getSlideInfo(cell);

            if (info.slideType === 'skip' || info.tags.includes('remove-cell')) {
                continue;
            }

            if (info.slideType === 'slide' || currentSection === null) {
                currentSection = document.createElement('section');
                slidesDiv.appendChild(currentSection);
            }

            const node = cell.type === 'code'
                ? this._renderCodeCell(cell as ICodeCellModel, info.tags)
                : await this._renderMarkdownCell(cell);

            this._applyGridwidth(node, info.tags);
            currentSection.appendChild(node);
        }

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
        const slideType: SlideType =
            rawType === 'slide' || rawType === 'skip' ? rawType : '-';

        const tags: string[] =
            (cell.getMetadata('tags') as string[] | undefined) ?? [];

        return { slideType, tags };
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
