import type { INotebookMetadata } from '@jupyterlab/nbformat';

import revealCoreCss from '../style/themes/reveal.raw.css';
import themeBlack from '../style/themes/black.raw.css';
import themeBlackContrast from '../style/themes/black-contrast.raw.css';
import themeDracula from '../style/themes/dracula.raw.css';
import themeSerif from '../style/themes/serif.raw.css';
import themeWhite from '../style/themes/white.raw.css';
import themeWhiteContrast from '../style/themes/white-contrast.raw.css';

const THEME_CSS: Record<string, string> = {
    black: themeBlack,
    'black-contrast': themeBlackContrast,
    dracula: themeDracula,
    serif: themeSerif,
    white: themeWhite,
    'white-contrast': themeWhiteContrast,
};

export const VALID_THEMES = Object.keys(THEME_CSS);

const VALID_TRANSITIONS = [
    'none', 'fade', 'slide', 'convex', 'concave', 'zoom'
];

const DEFAULTS: Required<ISlideshowConfig> = {
    theme: 'white',
    transition: 'slide',
    controls: true,
    progress: true,
    slideNumber: false,
    center: true,
    width: 960,
    height: 700,
    scroll: false,
    header: '',
    footer: '',
};

export interface ISlideshowConfig {
    theme?: string;
    transition?: string;
    controls?: boolean;
    progress?: boolean;
    slideNumber?: boolean;
    center?: boolean;
    width?: number;
    height?: number;
    scroll?: boolean;
    header?: string;
    footer?: string;
}

export function readSlideshowConfig(
    metadata: INotebookMetadata
): Required<ISlideshowConfig> {
    const raw = (metadata as Record<string, unknown>)['myst-revealjs'] as
        | Partial<ISlideshowConfig>
        | undefined;

    if (!raw || typeof raw !== 'object') {
        return { ...DEFAULTS };
    }

    return {
        theme: VALID_THEMES.includes(raw.theme ?? '')
            ? raw.theme!
            : DEFAULTS.theme,
        transition: VALID_TRANSITIONS.includes(raw.transition ?? '')
            ? raw.transition!
            : DEFAULTS.transition,
        controls: typeof raw.controls === 'boolean'
            ? raw.controls
            : DEFAULTS.controls,
        progress: typeof raw.progress === 'boolean'
            ? raw.progress
            : DEFAULTS.progress,
        slideNumber: typeof raw.slideNumber === 'boolean'
            ? raw.slideNumber
            : DEFAULTS.slideNumber,
        center: typeof raw.center === 'boolean'
            ? raw.center
            : DEFAULTS.center,
        width: typeof raw.width === 'number'
            ? raw.width
            : DEFAULTS.width,
        height: typeof raw.height === 'number'
            ? raw.height
            : DEFAULTS.height,
        scroll: typeof raw.scroll === 'boolean'
            ? raw.scroll
            : DEFAULTS.scroll,
        header: typeof raw.header === 'string'
            ? raw.header
            : DEFAULTS.header,
        footer: typeof raw.footer === 'string'
            ? raw.footer
            : DEFAULTS.footer,
    };
}

/**
 * Return reveal.js core CSS and the selected theme CSS as strings.
 */
export function getThemeCss(theme: string): { coreCss: string; themeCss: string } {
    const themeCss = THEME_CSS[theme] ?? THEME_CSS[DEFAULTS.theme];
    return { coreCss: revealCoreCss, themeCss };
}
