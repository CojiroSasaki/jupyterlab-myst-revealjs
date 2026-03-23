# Migration from RISE

This guide helps users of [RISE](https://rise.readthedocs.io/) or
[jupyterlab-rise](https://github.com/jupyterlab-contrib/rise) migrate to
jupyterlab-myst-revealjs.

## What stays the same

- **Cell metadata**: `slideshow.slide_type` is fully compatible. Your existing
  slide/subslide/fragment/notes/skip assignments work without changes.
- **Slide structure**: The same horizontal/vertical slide model from reveal.js.
- **Keyboard navigation**: Standard reveal.js keys (arrows, Space, Escape).
- **Live code execution**: Shift+Enter executes code on the slide.

## What changes

| RISE | jupyterlab-myst-revealjs |
|---|---|
| Mutates the notebook DOM | Independent panel (notebook DOM untouched) |
| `livereveal` notebook metadata key | `myst-revealjs` notebook metadata key |
| Classic Notebook or standalone `/rise/` URL | JupyterLab panel via `DocumentRegistry` |
| `jupyter_contrib_nbextensions` for hide/layout | Jupyter Book tags (`hide-input`, `gridwidth-*`) |
| Google Fonts themes available | Offline themes only (6 bundled); online fonts via custom CSS |
| Chalkboard plugin | Not available (plugin lacks ESM support) |
| Speaker view via `window.open()` | Not available (planned as JupyterLab panel) |

## Metadata migration

If your notebook uses the `livereveal` metadata key:

```json
{
    "livereveal": {
        "theme": "serif",
        "transition": "fade"
    }
}
```

Rename it to `myst-revealjs`:

```json
{
    "myst-revealjs": {
        "theme": "serif",
        "transition": "fade"
    }
}
```

The option names within the key are the same (both pass through to reveal.js).

## Cell tags migration

If you used `jupyter_contrib_nbextensions` extensions:

| Old approach | New approach |
|---|---|
| Hide Input extension | `hide-input` cell tag |
| Hide Input All extension | `hide-input` tag on each cell |
| Split Cell extension | `gridwidth-1-2` cell tag |

## New capabilities

Features available in jupyterlab-myst-revealjs that RISE does not have:

- **MyST Markdown rendering** — admonitions, figures with captions, cross-references, math, and all MyST directives.
- **Per-slide backgrounds** — `slide_background_color`, `slide_background_image` via cell metadata.
- **Custom CSS loading** — `myst-revealjs.css` in the notebook directory.
- **Header/footer** — CSS-driven overlays on every slide.
- **Scroll mode** — overflowing slides get scrollbars (`scroll: true`).
- **Jupyter Book compatibility** — the same tags (`hide-input`, `remove-cell`, etc.) work in Jupyter Book output.
