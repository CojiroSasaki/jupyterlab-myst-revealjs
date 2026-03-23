import { expect, test } from '@jupyterlab/galata';
import path from 'path';

const NOTEBOOK = 'e2e_test.ipynb';

/**
 * Helper: open notebook as slideshow and wait for reveal.js to initialize.
 * Returns a locator for the .reveal element.
 */
async function openSlideshow(
    page: any,
    tmpPath: string
): Promise<ReturnType<typeof page.locator>> {
    await page.notebook.openByPath(`${tmpPath}/${NOTEBOOK}`);
    await page.notebook.activate(NOTEBOOK);

    await page.evaluate(async () => {
        await window.jupyterapp.commands.execute('slideshow:open');
    });

    const revealDiv = page.locator('.jp-SlideshowContent .reveal');
    await expect(revealDiv).toBeVisible({ timeout: 10000 });
    return revealDiv;
}

test.describe('jupyterlab-myst-revealjs', () => {
    test.beforeEach(async ({ page, tmpPath }) => {
        await page.contents.uploadFile(
            path.resolve(__dirname, `notebooks/${NOTEBOOK}`),
            `${tmpPath}/${NOTEBOOK}`
        );
    });

    test('should open slideshow with reveal.js sections', async ({
        page,
        tmpPath
    }) => {
        await openSlideshow(page, tmpPath);

        const sections = page.locator(
            '.jp-SlideshowContent .reveal .slides > section'
        );
        await expect(sections).toHaveCount(3);
    });

    test('should navigate between slides', async ({ page, tmpPath }) => {
        const revealDiv = await openSlideshow(page, tmpPath);

        // First section should be present
        const firstSection = page.locator(
            '.jp-SlideshowContent .reveal .slides > section:first-child'
        );
        await expect(firstSection).toHaveClass(/present/);

        // Click the reveal div to ensure focus for keyboard navigation
        await revealDiv.click();
        await page.keyboard.press('ArrowRight');

        // Second section should become present
        const secondSection = page.locator(
            '.jp-SlideshowContent .reveal .slides > section:nth-child(2)'
        );
        await expect(secondSection).toHaveClass(/present/, { timeout: 5000 });
    });

    test('should execute code cell with Shift+Enter', async ({
        page,
        tmpPath
    }) => {
        const revealDiv = await openSlideshow(page, tmpPath);

        // Navigate to slide 2 (code cell)
        await revealDiv.click();
        await page.keyboard.press('ArrowRight');

        // Wait for navigation to complete
        const secondSection = page.locator(
            '.jp-SlideshowContent .reveal .slides > section:nth-child(2)'
        );
        await expect(secondSection).toHaveClass(/present/, { timeout: 5000 });

        // Click the code cell to focus it
        const codeCell = page.locator(
            '.jp-SlideshowContent .reveal .slides > section.present .jp-CodeCell'
        );
        await expect(codeCell).toBeVisible({ timeout: 5000 });
        await codeCell.click();

        // Execute with Shift+Enter
        await page.keyboard.press('Shift+Enter');

        // Wait for output to appear with the result of 1 + 1
        const output = page.locator(
            '.jp-SlideshowContent .reveal .slides > section.present .jp-OutputArea-output'
        );
        await expect(output).toBeVisible({ timeout: 30000 });
        await expect(output).toContainText('2');
    });
});
