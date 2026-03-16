import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

/**
 * Initialization data for the jupyterlab-myst-revealjs extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-myst-revealjs:plugin',
  description: 'Live reveal.js slideshow for MyST Markdown notebooks in JupyterLab.',
  autoStart: true,
  optional: [ISettingRegistry],
  activate: (app: JupyterFrontEnd, settingRegistry: ISettingRegistry | null) => {
    console.log('JupyterLab extension jupyterlab-myst-revealjs is activated!');

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('jupyterlab-myst-revealjs settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Failed to load settings for jupyterlab-myst-revealjs.', reason);
        });
    }
  }
};

export default plugin;
