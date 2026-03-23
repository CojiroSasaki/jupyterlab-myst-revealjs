import { Cell } from '@jupyterlab/cells';
import { ABCWidgetFactory, DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel } from '@jupyterlab/notebook';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Contents } from '@jupyterlab/services';
import { SlideshowContent } from './content';
import { SlideshowPanel } from './panel';
import { readSlideshowConfig } from './settings';
import { SlideBuilder } from './slidebuilder';

export class SlideshowWidgetFactory extends ABCWidgetFactory<
  SlideshowPanel,
  INotebookModel
> {
  readonly rendermime: IRenderMimeRegistry;
  readonly contentFactory: Cell.IContentFactory;
  readonly contents: Contents.IManager;

  constructor(options: SlideshowWidgetFactory.IOptions) {
    super(options);
    this.rendermime = options.rendermime;
    this.contentFactory = options.contentFactory;
    this.contents = options.contents;
  }

  protected createNewWidget(
    context: DocumentRegistry.IContext<INotebookModel>,
    _source?: SlideshowPanel
  ): SlideshowPanel {
    const rendermime = this.rendermime.clone({
      resolver: context.urlResolver
    });

    const slideBuilder = new SlideBuilder({
      model: context.model,
      rendermime,
      contentFactory: this.contentFactory
    });

    const config = readSlideshowConfig(context.model.metadata);
    const content = new SlideshowContent(config);

    return new SlideshowPanel({
      context,
      content,
      slideBuilder,
      contents: this.contents
    });
  }
}

export namespace SlideshowWidgetFactory {
  export interface IOptions extends DocumentRegistry.IWidgetFactoryOptions<SlideshowPanel> {
    rendermime: IRenderMimeRegistry;
    contentFactory: Cell.IContentFactory;
    contents: Contents.IManager;
  }
}
