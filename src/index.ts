import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { CommandToolbarButton } from '@jupyterlab/apputils';
import { Cell } from '@jupyterlab/cells';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { LabIcon } from '@jupyterlab/ui-components';
import { SlideshowWidgetFactory } from './factory';
import presentationSvg from '../style/icons/presentation.svg';

const presentationIcon = new LabIcon({
    name: 'jupyterlab-myst-revealjs:presentation',
    svgstr: presentationSvg
});

const FACTORY_NAME = 'Slideshow';
const COMMAND_ID = 'slideshow:open';

const plugin: JupyterFrontEndPlugin<void> = {
    id: 'jupyterlab-myst-revealjs:plugin',
    description:
        'Live reveal.js slideshow for MyST Markdown notebooks in JupyterLab.',
    autoStart: true,
    requires: [IRenderMimeRegistry, INotebookTracker, IEditorServices],
    activate
};

function activate(
    app: JupyterFrontEnd,
    rendermime: IRenderMimeRegistry,
    tracker: INotebookTracker,
    editorServices: IEditorServices
): void {
    const contentFactory = new Cell.ContentFactory({
        editorFactory: editorServices.factoryService.newInlineEditor
    });

    const factory = new SlideshowWidgetFactory({
        name: FACTORY_NAME,
        label: 'Slideshow',
        fileTypes: ['notebook'],
        modelName: 'notebook',
        preferKernel: true,
        canStartKernel: true,
        shutdownOnClose: false,
        rendermime,
        contentFactory,
        contents: app.serviceManager.contents
    });

    app.docRegistry.addWidgetFactory(factory);

    app.commands.addCommand(COMMAND_ID, {
        label: (args: any) =>
            args.toolbar ? '' : 'Open as Slideshow',
        icon: presentationIcon,
        caption: 'Open as Slideshow',
        execute: args => {
            const path =
                (args.path as string | undefined) ??
                tracker.currentWidget?.context.path;
            if (!path) {
                return;
            }
            return app.commands.execute('docmanager:open', {
                path,
                factory: FACTORY_NAME
            });
        }
    });

    tracker.widgetAdded.connect(
        (_sender: INotebookTracker, panel: NotebookPanel) => {
            const button = new CommandToolbarButton({
                commands: app.commands,
                id: COMMAND_ID,
                args: { toolbar: true }
            });
            panel.toolbar.insertBefore(
                'kernelName',
                'slideshow-button',
                button
            );
        }
    );
}

export default plugin;
