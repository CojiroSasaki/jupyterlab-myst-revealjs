import { CodeCell } from '@jupyterlab/cells';
import { DocumentWidget } from '@jupyterlab/docregistry';
import { INotebookModel } from '@jupyterlab/notebook';
import { SlideshowContent } from './content';
import { SlideBuilder } from './slidebuilder';

export class SlideshowPanel extends DocumentWidget<
    SlideshowContent,
    INotebookModel
> {
    private _slideBuilder: SlideBuilder;
    private _rebuildTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(options: SlideshowPanel.IOptions) {
        super(options);
        this._slideBuilder = options.slideBuilder;

        this.context.ready.then(() => {
            this._buildSlides();
        });

        this.context.model.contentChanged.connect(this._onContentChanged, this);

        this.node.addEventListener('keydown', this._onKeyDown);
    }

    get slideBuilder(): SlideBuilder {
        return this._slideBuilder;
    }

    private static _toggleKeys: Record<string, string> = {
        'i': 'jp-Slideshow-hideInput',
        'o': 'jp-Slideshow-hideOutput'
    };

    private _onKeyDown = (event: KeyboardEvent): void => {
        if (event.shiftKey && event.key === 'Enter') {
            const codeCell = this._slideBuilder.findFocusedCodeCell();
            if (codeCell) {
                event.preventDefault();
                event.stopPropagation();
                CodeCell.execute(codeCell, this.context.sessionContext).then(
                    () => this._refreshLayout()
                );
            }
            return;
        }

        // Toggle input/output visibility on focused code cell
        if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
            return;
        }
        const toggleClass = SlideshowPanel._toggleKeys[event.key];
        if (toggleClass) {
            const codeCell = this._slideBuilder.findFocusedCodeCell();
            if (codeCell) {
                event.preventDefault();
                event.stopPropagation();
                codeCell.toggleClass(toggleClass);
                this._refreshLayout();
            }
        }
    };

    private _refreshLayout(): void {
        requestAnimationFrame(() => {
            const reveal = this.content.revealInstance;
            if (reveal) {
                reveal.layout();
            }
        });
    }

    private _onContentChanged(): void {
        if (this._rebuildTimeout !== null) {
            clearTimeout(this._rebuildTimeout);
        }
        this._rebuildTimeout = setTimeout(() => {
            this._rebuildTimeout = null;
            this._buildSlides();
        }, 500);
    }

    private async _buildSlides(): Promise<void> {
        try {
            const slidesDiv = await this._slideBuilder.buildAll();
            await this.content.updateSlides(slidesDiv);
            this._slideBuilder.attachCodeCells();
            requestAnimationFrame(() => {
                this.content.syncReveal();
            });
        } catch (err) {
            console.warn('SlideBuilder: build failed', err);
        }
    }

    dispose(): void {
        this.node.removeEventListener('keydown', this._onKeyDown);
        if (this._rebuildTimeout !== null) {
            clearTimeout(this._rebuildTimeout);
        }
        this.context.model.contentChanged.disconnect(
            this._onContentChanged,
            this
        );
        this._slideBuilder.dispose();
        super.dispose();
    }
}

export namespace SlideshowPanel {
    export interface IOptions
        extends DocumentWidget.IOptions<SlideshowContent, INotebookModel> {
        slideBuilder: SlideBuilder;
    }
}
