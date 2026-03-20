import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import Reveal from 'reveal.js';
import type { RevealApi } from 'reveal.js';

export class SlideshowContent extends Widget {
    private _reveal: RevealApi | null = null;
    private _revealDiv: HTMLDivElement;
    private _slidesDiv: HTMLDivElement;

    constructor() {
        super();
        this.addClass('jp-SlideshowContent');

        this._revealDiv = document.createElement('div');
        this._revealDiv.className = 'reveal';

        this._slidesDiv = document.createElement('div');
        this._slidesDiv.className = 'slides';

        this._revealDiv.appendChild(this._slidesDiv);
        this.node.appendChild(this._revealDiv);
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
        const deck = new Reveal(this._revealDiv, {
            embedded: true,
            keyboardCondition: 'focused',
            width: 960,
            height: 700,
            margin: 0.04,
            hash: false,
            history: false,
            transition: 'slide'
        });
        await deck.initialize();
        this._reveal = deck;
    }
}
