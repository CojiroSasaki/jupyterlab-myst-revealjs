# jupyterlab-myst-revealjs

Live [reveal.js](https://revealjs.com/) slideshow for
[MyST Markdown](https://mystmd.org/) notebooks in
[JupyterLab](https://jupyterlab.readthedocs.io/).

## What is this?

jupyterlab-myst-revealjs is a JupyterLab extension that turns your notebook
into a live reveal.js slideshow. Markdown cells are rendered through
[jupyterlab-myst](https://github.com/jupyter-book/jupyterlab-myst), code cells
are real JupyterLab `CodeCell` widgets you can execute during the presentation,
and reveal.js handles navigation, transitions, and theming.

## Key features

- **Live code execution** — run code cells with Shift+Enter during the
  presentation and see results on the slide immediately.
- **MyST Markdown** — full MyST rendering (admonitions, math, figures, etc.)
  via jupyterlab-myst.
- **RISE-compatible cell metadata** — uses the same `slideshow.slide_type`
  cell metadata as RISE and nbconvert. Existing slide type assignments work
  without changes.
- **Jupyter Book compatible tags** — `hide-input`, `hide-output`, `hide-cell`,
  `remove-input`, `remove-output`, `remove-cell` work in slideshow mode.
- **reveal.js themes** — 6 bundled offline themes, plus custom CSS support.
- **Slide backgrounds** — per-slide background color/image via cell metadata.
- **Offline operation** — reveal.js is bundled; no CDN dependency.
- **No server extension** — pure frontend extension, install with `pip install`
  and you are done.

## How it works

The extension registers a `SlideshowWidgetFactory` in JupyterLab's
`DocumentRegistry`. When you open a slideshow view, a `SlideshowPanel` is
created that shares the same `DocumentContext` (model, kernel) as the notebook.
The `SlideBuilder` reads cell metadata and tags, assembles DOM nodes into
reveal.js `<section>` elements, and reveal.js takes over from there.

The notebook's DOM is never touched. The slideshow is a completely independent
view of the same underlying notebook model.
