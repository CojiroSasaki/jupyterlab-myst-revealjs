# Architecture

This document describes the architecture of jupyterlab-myst-revealjs for
contributors and anyone interested in how the extension works internally.

## Design philosophy

Two lessons from prior work (RISE, jupyterlab-rise) drove the architecture:

1. **Do not mutate JupyterLab's notebook DOM.** JupyterLab has implicit
   assumptions (virtual rendering, heading collapse, etc.) that break when the
   DOM is modified externally.
2. **Do not create a separate app or URL.** Managing a standalone application's
   routing, initialization, and kernel connection independently leads to
   complexity explosion.

The solution: register a `WidgetFactory` in JupyterLab's `DocumentRegistry` to
provide a second, independent view of the same notebook.

## Component overview

```
┌──────────────────────────────────────────────────┐
│ JupyterLab                                       │
│                                                   │
│  DocumentRegistry                                 │
│  ├── NotebookWidgetFactory (built-in)             │
│  └── SlideshowWidgetFactory (this extension)      │
│                                                   │
│  ┌──────────────┐    ┌────────────────────┐       │
│  │ NotebookPanel│    │ SlideshowPanel     │       │
│  │ (built-in)   │    │ (this extension)   │       │
│  │              │    │                    │       │
│  │ Notebook     │    │ reveal.js DOM      │       │
│  │ view         │    │ Slideshow view     │       │
│  └──────┬───────┘    └────────┬───────────┘       │
│         │                     │                   │
│         └─────────┬───────────┘                   │
│                   │                               │
│          ┌────────┴────────┐                      │
│          │ DocumentContext │                      │
│          │ (shared)        │                      │
│          │ - NotebookModel │                      │
│          │ - SessionContext │                      │
│          │ - Kernel        │                      │
│          └─────────────────┘                      │
└──────────────────────────────────────────────────┘
```

`NotebookPanel` and `SlideshowPanel` have completely independent DOM trees. The
notebook's DOM is never touched.

## Compiler analogy

The extension's pipeline resembles a compiler:

- **Frontend** — reads `NotebookModel` cells, delegates markdown rendering to
  jupyterlab-myst (via `RenderMimeRegistry`) and code cell rendering to
  JupyterLab's `CodeCell` widgets.
- **Middle** — `SlideBuilder` assembles rendered DOM nodes into reveal.js
  `<section>` elements based on cell metadata and tags.
- **Backend** — reveal.js takes the `<section>` structure and handles
  navigation, transitions, and theming.

All operations are at the DOM level. No HTML string serialization occurs.

## Source modules

| Module                | Responsibility                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`        | Plugin definition, factory registration, `slideshow:open` command, toolbar button                                      |
| `src/factory.ts`      | `ABCWidgetFactory` subclass. `modelName: 'notebook'` shares context with `NotebookPanel`                               |
| `src/panel.ts`        | `DocumentWidget` subclass. Handles `contentChanged` rebuild, Shift+Enter execution, `i`/`o` toggle, custom CSS loading |
| `src/content.ts`      | reveal.js engine management (embedded mode). Injects theme CSS via scoped `<style>`, manages header/footer overlays    |
| `src/slidebuilder.ts` | Reads `NotebookModel` and builds reveal.js `<section>` DOM. Recursive descent parser                                   |
| `src/settings.ts`     | Reads `ISlideshowConfig` from notebook metadata `myst-revealjs` key. Provides theme CSS strings                        |
| `style/base.css`      | Layout, gridwidth, hide/remove tags, hljs theme, focus indicators                                                      |

## SlideBuilder grammar

`SlideBuilder` is implemented as a recursive descent parser with an LL(1)
grammar:

```
slides   → slide*
slide    → (SLIDE | implicit) subslide (SUBSLIDE subslide)*
subslide → cell*
cell     → ('-' | FRAGMENT | NOTES) content
```

- `skip` and `remove-cell` are filtered at the lexer stage.
- Parsing and DOM construction happen in a single pass (syntax-directed
  translation).

## CSS isolation

reveal.js core CSS and theme CSS are imported as `.raw.css` files (webpack
`asset/source`) — raw strings, not style-loader injected. Each
`SlideshowContent` instance injects them as `<style>` elements within its own
DOM subtree. This ensures:

- Multiple slideshow panels can have different themes.
- reveal.js styles do not leak into JupyterLab.

JupyterLab CSS variables (`--jp-content-font-color*`) are bridged to reveal.js
theme variables (`--r-main-color`) in `base.css`.

## Code cell rendering

JupyterLab `CodeCell` widgets are placed directly inside reveal.js `<section>`
elements using `Widget.attach()`. This preserves full editor functionality,
live execution, and JupyterLab's native appearance. `reveal.sync()` /
`reveal.layout()` are called after attachment completes.
