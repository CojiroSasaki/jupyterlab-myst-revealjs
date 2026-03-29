# Changelog

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
