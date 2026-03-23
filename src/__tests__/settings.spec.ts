import { readSlideshowConfig, getThemeCss, VALID_THEMES } from '../settings';
import type { INotebookMetadata } from '@jupyterlab/nbformat';

describe('readSlideshowConfig', () => {
    const DEFAULTS = {
        theme: 'white',
        transition: 'slide',
        controls: true,
        progress: true,
        slideNumber: false,
        center: true,
        width: 960,
        height: 700,
        scroll: false
    };

    it('returns defaults when metadata has no myst-revealjs key', () => {
        const metadata: INotebookMetadata = {};
        expect(readSlideshowConfig(metadata)).toEqual(DEFAULTS);
    });

    it('returns defaults when myst-revealjs is not an object', () => {
        const metadata = { 'myst-revealjs': 'invalid' } as unknown as INotebookMetadata;
        expect(readSlideshowConfig(metadata)).toEqual(DEFAULTS);
    });

    it('reads valid configuration from metadata', () => {
        const metadata = {
            'myst-revealjs': {
                theme: 'black',
                transition: 'fade',
                controls: false,
                progress: false,
                slideNumber: true,
                center: false,
                width: 1280,
                height: 720,
                scroll: true
            }
        } as unknown as INotebookMetadata;

        expect(readSlideshowConfig(metadata)).toEqual({
            theme: 'black',
            transition: 'fade',
            controls: false,
            progress: false,
            slideNumber: true,
            center: false,
            width: 1280,
            height: 720,
            scroll: true
        });
    });

    it('falls back to default for invalid theme name', () => {
        const metadata = {
            'myst-revealjs': { theme: 'nonexistent' }
        } as unknown as INotebookMetadata;

        expect(readSlideshowConfig(metadata).theme).toBe('white');
    });

    it('falls back to default for invalid transition name', () => {
        const metadata = {
            'myst-revealjs': { transition: 'flip' }
        } as unknown as INotebookMetadata;

        expect(readSlideshowConfig(metadata).transition).toBe('slide');
    });

    it('falls back to defaults for wrong types', () => {
        const metadata = {
            'myst-revealjs': {
                controls: 'yes',
                width: '960',
                scroll: 1
            }
        } as unknown as INotebookMetadata;

        const config = readSlideshowConfig(metadata);
        expect(config.controls).toBe(true);
        expect(config.width).toBe(960);
        expect(config.scroll).toBe(false);
    });

    it('preserves valid fields and falls back for invalid ones', () => {
        const metadata = {
            'myst-revealjs': {
                theme: 'dracula',
                transition: 'invalid',
                controls: false
            }
        } as unknown as INotebookMetadata;

        const config = readSlideshowConfig(metadata);
        expect(config.theme).toBe('dracula');
        expect(config.transition).toBe('slide');
        expect(config.controls).toBe(false);
    });
});

describe('getThemeCss', () => {
    it('returns coreCss and themeCss for a valid theme', () => {
        const result = getThemeCss('black');
        expect(result).toHaveProperty('coreCss');
        expect(result).toHaveProperty('themeCss');
    });

    it('returns the same coreCss regardless of theme', () => {
        const a = getThemeCss('black');
        const b = getThemeCss('white');
        expect(a.coreCss).toBe(b.coreCss);
    });

    it('falls back to default theme for invalid theme name', () => {
        const valid = getThemeCss('white');
        const invalid = getThemeCss('nonexistent');
        expect(invalid.themeCss).toBe(valid.themeCss);
    });

    it('covers all VALID_THEMES', () => {
        for (const theme of VALID_THEMES) {
            const result = getThemeCss(theme);
            expect(result.themeCss).toBeDefined();
        }
    });
});
