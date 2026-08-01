# Changelog

## v1.5.0 (2026-08-01)

Code cell rendering in slideshow mode has been reworked so that a cell — editor, prompts and outputs — scales as a single unit.

### Features

- Add three CSS custom properties for code cell font size, settable from `myst-revealjs.css`:
  - `--myst-revealjs-codecell-font-size` — input and output together
  - `--myst-revealjs-input-font-size` — input only, takes precedence over the shared one
  - `--myst-revealjs-output-font-size` — output only, takes precedence over the shared one

  They cover the editor, the execution prompts, text output, rendered HTML, and the tables inside it. Left unset, each side keeps its JupyterLab default. Declare them on `.reveal .slides` for the whole deck or on a `section` for a single slide.

### Bug Fixes

- Code cell outputs no longer ignore the font size set around them. JupyterLab declares absolute sizes on `.cm-editor`, on the prompts, on `.jp-RenderedHTMLCommon`, and on the tables inside it, and every one of those cuts the inheritance chain. The most visible symptom was a pandas DataFrame table staying at its default size while the rest of the cell was scaled down. Those declarations now resolve relative to the input and output wrappers.

### Behavior Changes

- With none of the new properties set, text output and the tables inside HTML output render at 14px instead of 13px, as does the output prompt. This unifies JupyterLab's split between UI and content font size defaults, a distinction that carries no meaning on a slide. Custom CSS that sets sizes explicitly is unaffected; only appearance that relied on the defaults shifts.
- Execution prompt width is now proportional to the cell font size instead of a fixed 64px, so prompts such as `In [12]:` are not clipped by an ellipsis when the font is enlarged.

### Documentation

- New "Code cell font size" section in the theming guide.
- The reference slideshow in `examples/` gains a DataFrame slide that shows text output and HTML output side by side.

## v1.4.2 (2026-06-06)

### Bug Fixes

- Figure cross-reference tooltip: when the referenced figure lives on a different (hidden) slide, its measured width was `0` (reveal.js hides off-screen slides with `display: none`), collapsing the tooltip to about one character wide. The tooltip now falls back to the visible slide container width when the source width is unmeasurable, so cross-slide figure references render at full width. Same-slide references keep mirroring the source's rendered width.

## v1.4.1 (2026-04-26)

### Bug Fixes

- Figure cross-reference tooltip: when the source figure lives in a width-constrained ancestor (e.g. `gridwidth-1-2`), the tooltip image previously rendered at its natural size and could overflow the slide viewport. The tooltip now mirrors the source's rendered width via `max-width`, so the cloned image stays at the same visual size as on the slide.

## v1.4.0 (2026-04-26)

### Features

- Add figure cross-reference hover tooltip: hovering over `[](#fig:label)` references shows the referenced figure in a tooltip, including cross-slide references
- Tooltip placement now adapts to the slide viewport — flips above the link when there is no room below, and clips horizontally to stay inside the slide. This also improves the existing equation tooltip behavior near slide edges

### Internal

- Rename internal CSS class `jp-Slideshow-eqTooltip` to `jp-Slideshow-refTooltip` (used by both equation and figure tooltips). Note for users with custom CSS targeting this class

## v1.3.0 (2026-04-05)

### Features

- Add equation reference hover tooltip: hovering over `{eq}` references shows the referenced equation in a tooltip, including cross-slide references

## v1.2.0 (2026-04-04)

### Breaking Changes

- Replace `center` (boolean) with `slide_state` (string: `"top"`, `"middle"`, `"bottom"`) for vertical alignment control
- Rename `slideNumber` to `slide_number` in notebook metadata (all `myst-revealjs` keys are now snake_case)

### Features

- Per-slide vertical alignment via `slideshow.slide_state` cell metadata, overriding the notebook-level `slide_state` default
- `data-state` attribute on `<section>` elements for custom CSS hooks via `slideshow.slide_state` cell metadata

## v1.1.0 (2026-03-29)

### Changes

- Change `"-"` slide_type semantics to RISE-compatible behavior: continuation cells now inherit the preceding cell's slide type. In particular, `"-"` after a `fragment` cell appears simultaneously with it (same `data-fragment-index`), enabling natural use of `gridwidth` and `fragment` together.

## v1.0.2 (2026-03-28)

### Bug Fixes

- Fix cross-slide equation references by cloning NotebookPanel MyST DOM instead of independent rendering
- Fix heading scrollbar and spacing issues with CJK fonts by setting `line-height: 1.5`

## v1.0.1 (2026-03-24)

### Bug Fixes

- Add missing runtime dependencies (`jupyterlab`, `jupyterlab-myst`) to `pyproject.toml` so they are automatically installed with `pip install jupyterlab-myst-revealjs`

## v1.0.0 (2026-03-24)

Initial release.

### Features

- Present MyST Markdown notebooks as reveal.js slideshows within JupyterLab
- Toolbar button on notebook to launch slideshow view
- Slide types: `slide`, `subslide`, `fragment`, `notes`, `skip`
- Live code execution (Shift+Enter) with output reflected in slides
- MyST Markdown content (figures, admonitions, math, etc.) rendered via jupyterlab-myst
- Jupyter Book compatible tags: `hide-input`, `hide-output`, `hide-cell`, `remove-input`, `remove-output`
- `gridwidth-*` tags for cell width control (`gridwidth-1-2`, `gridwidth-1-3`, `gridwidth-2-3`)
- 6 built-in reveal.js themes (black, black-contrast, dracula, serif, white, white-contrast)
- Slide background color/image via `slideshow.slide_background_*` cell metadata
- Custom CSS loading (`myst-revealjs.css` from notebook directory)
- Header/footer overlay (CSS-based, customizable via `myst-revealjs.css`)
- Scrollable slides (`scroll: true`)
- Configurable via notebook metadata (`myst-revealjs` key)
- `i`/`o` keys: toggle input/output visibility on focused code cell
- Fullscreen (`F`) and Overview (`O`) via reveal.js built-in
