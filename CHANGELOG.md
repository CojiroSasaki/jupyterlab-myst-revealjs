# Changelog

## 0.1.0 — MVP

### Features

- Present MyST Markdown notebooks as reveal.js slideshows within JupyterLab
- Toolbar button on notebook to launch slideshow view
- Cells with `slideshow.slide_type: slide` start a new slide; `skip` excludes cell from slideshow (metadata-level control, cf. `remove-cell` tag)
- MyST Markdown content (figures, admonitions, math, etc.) rendered natively via jupyterlab-myst
- Live code execution (Shift+Enter) within slideshow with output reflected in slides
- `hide-input` tag: hides code input area
- `remove-cell` tag: excludes cell from slideshow entirely
- `gridwidth-*` tags: controls cell width (`gridwidth-1-2`, `gridwidth-1-3`, `gridwidth-2-3`)
- Fullscreen slideshow via `F` key (reveal.js built-in)

### Architecture

- Markdown cells are rendered to DOM nodes for reveal.js by jupyterlab-myst via RenderMimeRegistry
- Code cells use JupyterLab's CodeCell widgets directly (not re-rendered via rendermime),
  enabling live execution with full CodeMirror editor and JupyterLab-native appearance
- SlideshowPanel and NotebookPanel share the same DocumentContext (model, kernel)
- reveal.js CSS is scoped within SlideshowPanel's DOM tree
