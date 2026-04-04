import type { ICellModel } from '@jupyterlab/cells';
import type { INotebookModel } from '@jupyterlab/notebook';
import type { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import type { Cell } from '@jupyterlab/cells';

// ── Module mocks (must precede SlideBuilder import) ─────

jest.mock('@jupyterlab/cells', () => {
  class MockCodeCell {
    node: HTMLElement;
    isAttached = false;
    private _classes: string[] = [];
    constructor() {
      this.node = document.createElement('div');
      this.node.className = 'jp-CodeCell';
    }
    initializeState() {
      /* noop */
    }
    addClass(cls: string) {
      this._classes.push(cls);
      this.node.classList.add(cls);
    }
    hasClass(cls: string) {
      return this._classes.includes(cls);
    }
    dispose() {
      /* noop */
    }
  }
  return { CodeCell: MockCodeCell };
});

jest.mock('@jupyterlab/notebook', () => ({}));
jest.mock('@jupyterlab/rendermime', () => ({ MimeModel: class {} }));
jest.mock('@lumino/widgets', () => ({
  Widget: {
    attach: jest.fn((widget: any, container: HTMLElement) => {
      if (widget.node) {
        container.appendChild(widget.node);
      }
      widget.isAttached = true;
    }),
    detach: jest.fn((widget: any) => {
      widget.node?.remove();
      widget.isAttached = false;
    })
  }
}));

// Import after mocks are registered
import { SlideBuilder } from '../slidebuilder';
import { Widget } from '@lumino/widgets';

// ── Mock helpers ────────────────────────────────────────

/**
 * Create a minimal cell model stub.
 */
function createCellModel(
  type: 'markdown' | 'code',
  metadata: Record<string, unknown> = {},
  source = ''
): ICellModel {
  return {
    type,
    trusted: true,
    getMetadata: (key: string) => metadata[key],
    sharedModel: { getSource: () => source }
  } as unknown as ICellModel;
}

function createNotebookModel(cells: ICellModel[]): INotebookModel {
  return {
    cells: {
      get length() {
        return cells.length;
      },
      get: (index: number) => cells[index]
    }
  } as unknown as INotebookModel;
}

function createMockRendermime(): IRenderMimeRegistry {
  return {
    createRenderer: () => ({
      node: document.createElement('div'),
      renderModel: async () => {
        /* noop */
      }
    })
  } as unknown as IRenderMimeRegistry;
}

const mockContentFactory = {} as Cell.IContentFactory;

const defaultConfig = {
  theme: 'white',
  transition: 'slide',
  controls: true,
  progress: true,
  slide_number: false,
  slide_state: 'middle',
  width: 960,
  height: 700,
  scroll: false
};

function createBuilder(
  cells: ICellModel[],
  config = defaultConfig
): SlideBuilder {
  return new SlideBuilder({
    model: createNotebookModel(cells),
    rendermime: createMockRendermime(),
    contentFactory: mockContentFactory,
    tracker: { find: () => null } as any,
    context: {} as any,
    config
  });
}

async function buildSlidesWithConfig(
  cells: ICellModel[],
  config: typeof defaultConfig
): Promise<HTMLElement> {
  return createBuilder(cells, config).buildAll();
}

async function buildSlides(cells: ICellModel[]): Promise<HTMLElement> {
  return createBuilder(cells).buildAll();
}

/**
 * Get inner <section> elements (actual slide sections, not outer groups).
 */
function getInnerSections(slidesDiv: HTMLElement): HTMLElement[] {
  const sections: HTMLElement[] = [];
  for (const outer of Array.from(slidesDiv.children) as HTMLElement[]) {
    for (const inner of Array.from(outer.children) as HTMLElement[]) {
      if (inner.tagName === 'SECTION') {
        sections.push(inner);
      }
    }
  }
  return sections;
}

// ── Tests ───────────────────────────────────────────────

describe('SlideBuilder', () => {
  describe('slide structure', () => {
    it('builds a single slide from one markdown cell', async () => {
      const cells = [
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'slide' } },
          '# Title'
        )
      ];
      const dom = await buildSlides(cells);

      // One outer section containing one inner section
      expect(dom.children).toHaveLength(1);
      const outer = dom.children[0];
      expect(outer.tagName).toBe('SECTION');
      expect(outer.children).toHaveLength(1);
      expect(outer.children[0].tagName).toBe('SECTION');
    });

    it('splits cells into separate slides at slide boundaries', async () => {
      const cells = [
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'slide' } },
          '# Slide 1'
        ),
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'slide' } },
          '# Slide 2'
        ),
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'slide' } },
          '# Slide 3'
        )
      ];
      const dom = await buildSlides(cells);

      expect(dom.children).toHaveLength(3);
    });

    it('appends continuation cells to the current slide', async () => {
      const cells = [
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'slide' } },
          '# Title'
        ),
        createCellModel(
          'markdown',
          { slideshow: { slide_type: '-' } },
          'paragraph'
        ),
        createCellModel('markdown', {}, 'another paragraph')
      ];
      const dom = await buildSlides(cells);

      expect(dom.children).toHaveLength(1);
      const inner = getInnerSections(dom)[0];
      expect(inner.children).toHaveLength(3);
    });

    it('creates nested sections for subslides', async () => {
      const cells = [
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'slide' } },
          '# Main'
        ),
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'subslide' } },
          '# Sub 1'
        ),
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'subslide' } },
          '# Sub 2'
        )
      ];
      const dom = await buildSlides(cells);

      // One outer section with 3 inner sections
      expect(dom.children).toHaveLength(1);
      const outer = dom.children[0];
      expect(outer.children).toHaveLength(3);
      for (const child of Array.from(outer.children)) {
        expect(child.tagName).toBe('SECTION');
      }
    });

    it('wraps fragment cells with the fragment class', async () => {
      const cells = [
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'slide' } },
          '# Title'
        ),
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'fragment' } },
          'appear later'
        )
      ];
      const dom = await buildSlides(cells);

      const inner = getInnerSections(dom)[0];
      const fragmentNode = inner.children[1];
      expect(fragmentNode.classList.contains('fragment')).toBe(true);
    });

    it('groups "-" after fragment with the same data-fragment-index', async () => {
      const cells = [
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'slide' } },
          '# Title'
        ),
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'fragment' } },
          'left column'
        ),
        createCellModel(
          'markdown',
          { slideshow: { slide_type: '-' } },
          'right column'
        )
      ];
      const dom = await buildSlides(cells);

      const inner = getInnerSections(dom)[0];
      const fragmentNode = inner.children[1] as HTMLElement;
      const contNode = inner.children[2] as HTMLElement;
      expect(fragmentNode.classList.contains('fragment')).toBe(true);
      expect(contNode.classList.contains('fragment')).toBe(true);
      expect(fragmentNode.getAttribute('data-fragment-index')).toBe(
        contNode.getAttribute('data-fragment-index')
      );
    });

    it('wraps notes cells in an aside element', async () => {
      const cells = [
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'slide' } },
          '# Title'
        ),
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'notes' } },
          'speaker notes'
        )
      ];
      const dom = await buildSlides(cells);

      const inner = getInnerSections(dom)[0];
      const aside = inner.querySelector('aside.notes');
      expect(aside).not.toBeNull();
      expect(aside!.children).toHaveLength(1);
    });

    it('excludes skip cells from the DOM', async () => {
      const cells = [
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'slide' } },
          '# Title'
        ),
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'skip' } },
          'hidden'
        ),
        createCellModel(
          'markdown',
          { slideshow: { slide_type: '-' } },
          'visible'
        )
      ];
      const dom = await buildSlides(cells);

      const inner = getInnerSections(dom)[0];
      expect(inner.children).toHaveLength(2);
    });

    it('wraps implicit first cells (no slide_type) in a slide', async () => {
      const cells = [
        createCellModel('markdown', {}, 'no slide_type'),
        createCellModel('markdown', {}, 'also implicit')
      ];
      const dom = await buildSlides(cells);

      // One outer section, one inner section, two children
      expect(dom.children).toHaveLength(1);
      const inner = getInnerSections(dom)[0];
      expect(inner.children).toHaveLength(2);
    });

    it('returns an empty slides div for an empty notebook', async () => {
      const dom = await buildSlides([]);

      expect(dom.className).toBe('slides');
      expect(dom.children).toHaveLength(0);
    });
  });

  describe('background attributes', () => {
    it('converts slide_background_* to data-background-* attributes', async () => {
      const cells = [
        createCellModel('markdown', {
          slideshow: {
            slide_type: 'slide',
            slide_background_color: '#1a1a2e',
            slide_background_image: 'url(bg.png)',
            slide_background_size: 'cover'
          }
        })
      ];
      const dom = await buildSlides(cells);

      const inner = getInnerSections(dom)[0];
      expect(inner.getAttribute('data-background-color')).toBe('#1a1a2e');
      expect(inner.getAttribute('data-background-image')).toBe('url(bg.png)');
      expect(inner.getAttribute('data-background-size')).toBe('cover');
    });

    it('converts underscores to hyphens in attribute names', async () => {
      const cells = [
        createCellModel('markdown', {
          slideshow: {
            slide_type: 'slide',
            slide_background_position: 'center',
            slide_background_repeat: 'no-repeat',
            slide_background_opacity: '0.5'
          }
        })
      ];
      const dom = await buildSlides(cells);

      const inner = getInnerSections(dom)[0];
      expect(inner.getAttribute('data-background-position')).toBe('center');
      expect(inner.getAttribute('data-background-repeat')).toBe('no-repeat');
      expect(inner.getAttribute('data-background-opacity')).toBe('0.5');
    });

    it('does not set background attributes for continuation cells', async () => {
      const cells = [
        createCellModel('markdown', { slideshow: { slide_type: 'slide' } }),
        createCellModel('markdown', {
          slideshow: {
            slide_type: '-',
            slide_background_color: '#ff0000'
          }
        })
      ];
      const dom = await buildSlides(cells);

      const inner = getInnerSections(dom)[0];
      expect(inner.getAttribute('data-background-color')).toBeNull();
    });
  });

  describe('data-state attribute', () => {
    it('sets data-state from cell slide_state metadata', async () => {
      const cells = [
        createCellModel('markdown', {
          slideshow: { slide_type: 'slide', slide_state: 'top' }
        })
      ];
      const dom = await buildSlides(cells);

      const inner = getInnerSections(dom)[0];
      expect(inner.getAttribute('data-state')).toBe('top');
    });

    it('falls back to global slide_state when cell slide_state is absent', async () => {
      const cells = [
        createCellModel('markdown', {
          slideshow: { slide_type: 'slide' }
        })
      ];
      const dom = await buildSlides(cells);

      const inner = getInnerSections(dom)[0];
      expect(inner.getAttribute('data-state')).toBe('middle');
    });

    it('cell slide_state overrides global slide_state', async () => {
      const cells = [
        createCellModel('markdown', {
          slideshow: { slide_type: 'slide', slide_state: 'top' }
        })
      ];
      const config = { ...defaultConfig, slide_state: 'middle' };
      const dom = await buildSlidesWithConfig(cells, config);

      const inner = getInnerSections(dom)[0];
      expect(inner.getAttribute('data-state')).toBe('top');
    });

    it('does not set data-state from continuation cells', async () => {
      const cells = [
        createCellModel('markdown', { slideshow: { slide_type: 'slide' } }),
        createCellModel('markdown', {
          slideshow: { slide_type: '-', slide_state: 'top' }
        })
      ];
      const dom = await buildSlides(cells);

      const inner = getInnerSections(dom)[0];
      expect(inner.getAttribute('data-state')).toBe('middle');
    });
  });

  describe('tag processing', () => {
    it('includes remove-cell tagged cells in the slideshow DOM', async () => {
      const cells = [
        createCellModel(
          'markdown',
          { slideshow: { slide_type: 'slide' } },
          '# Title'
        ),
        createCellModel(
          'markdown',
          {
            slideshow: { slide_type: '-' },
            tags: ['remove-cell']
          },
          'kept in slideshow'
        )
      ];
      const dom = await buildSlides(cells);

      const inner = getInnerSections(dom)[0];
      expect(inner.children).toHaveLength(2);
    });

    it('applies hide-input class to code cells with hide-input tag', async () => {
      const builder = createBuilder([
        createCellModel('markdown', { slideshow: { slide_type: 'slide' } }),
        createCellModel('code', {
          slideshow: { slide_type: '-' },
          tags: ['hide-input']
        })
      ]);
      const dom = await builder.buildAll();
      builder.attachCodeCells();

      const inner = getInnerSections(dom)[0];
      expect(inner.querySelector('.jp-Slideshow-hideInput')).not.toBeNull();
    });

    it('applies hide-output class to code cells with hide-output tag', async () => {
      const builder = createBuilder([
        createCellModel('code', {
          slideshow: { slide_type: 'slide' },
          tags: ['hide-output']
        })
      ]);
      const dom = await builder.buildAll();
      builder.attachCodeCells();

      const inner = getInnerSections(dom)[0];
      expect(inner.querySelector('.jp-Slideshow-hideOutput')).not.toBeNull();
    });

    it('applies hide-cell class to code cells and markdown cells', async () => {
      const builder = createBuilder([
        createCellModel('markdown', {
          slideshow: { slide_type: 'slide' },
          tags: ['hide-cell']
        }),
        createCellModel('code', {
          slideshow: { slide_type: '-' },
          tags: ['hide-cell']
        })
      ]);
      const dom = await builder.buildAll();
      builder.attachCodeCells();

      const inner = getInnerSections(dom)[0];
      // Markdown cell wrapper
      expect(
        inner.querySelector(
          '.jp-Slideshow-markdownCell.jp-Slideshow-hideCell' +
            ', .jp-Slideshow-hideCell'
        )
      ).not.toBeNull();
      // Code cell
      expect(inner.querySelector('.jp-Slideshow-hideCell')).not.toBeNull();
    });

    it('applies remove-input and remove-output classes to code cells', async () => {
      const builder = createBuilder([
        createCellModel('code', {
          slideshow: { slide_type: 'slide' },
          tags: ['remove-input']
        }),
        createCellModel('code', {
          slideshow: { slide_type: '-' },
          tags: ['remove-output']
        })
      ]);
      const dom = await builder.buildAll();
      builder.attachCodeCells();

      const inner = getInnerSections(dom)[0];
      expect(inner.querySelector('.jp-Slideshow-removeInput')).not.toBeNull();
      expect(inner.querySelector('.jp-Slideshow-removeOutput')).not.toBeNull();
    });

    it('applies gridwidth class to cells', async () => {
      const cells = [
        createCellModel('markdown', {
          slideshow: { slide_type: 'slide' },
          tags: ['gridwidth-1-2']
        }),
        createCellModel('markdown', {
          slideshow: { slide_type: '-' },
          tags: ['gridwidth-1-3']
        })
      ];
      const dom = await buildSlides(cells);

      const inner = getInnerSections(dom)[0];
      expect(inner.querySelector('.gridwidth-1-2')).not.toBeNull();
      expect(inner.querySelector('.gridwidth-1-3')).not.toBeNull();
    });
  });

  describe('lifecycle', () => {
    it('sets isDisposed to true after dispose()', async () => {
      const builder = createBuilder([
        createCellModel('code', { slideshow: { slide_type: 'slide' } })
      ]);
      await builder.buildAll();

      expect(builder.isDisposed).toBe(false);
      builder.dispose();
      expect(builder.isDisposed).toBe(true);
    });

    it('attachCodeCells calls Widget.attach for unattached code cells', async () => {
      (Widget.attach as jest.Mock).mockClear();

      const builder = createBuilder([
        createCellModel('code', { slideshow: { slide_type: 'slide' } }),
        createCellModel('code', { slideshow: { slide_type: '-' } })
      ]);
      await builder.buildAll();
      builder.attachCodeCells();

      expect(Widget.attach as jest.Mock).toHaveBeenCalledTimes(2);
    });

    it('findFocusedCodeCell returns null when no cell is focused', async () => {
      const builder = createBuilder([
        createCellModel('code', { slideshow: { slide_type: 'slide' } })
      ]);
      await builder.buildAll();

      expect(builder.findFocusedCodeCell()).toBeNull();
    });

    it('findFocusedCodeCell returns the focused code cell', async () => {
      const builder = createBuilder([
        createCellModel('code', { slideshow: { slide_type: 'slide' } })
      ]);
      const dom = await builder.buildAll();
      document.body.appendChild(dom);

      // Focus the container element
      const container = dom.querySelector(
        '.jp-Slideshow-codeCellContainer'
      ) as HTMLElement;
      container.focus();

      const found = builder.findFocusedCodeCell();
      expect(found).not.toBeNull();

      document.body.removeChild(dom);
    });
  });
});
