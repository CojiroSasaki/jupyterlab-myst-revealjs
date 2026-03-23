# Quick Start

## Opening a slideshow

1. Open a notebook (`.ipynb`) in JupyterLab.
2. Click the **slideshow button** in the notebook toolbar, or run the command
   `slideshow:open` from the Command Palette (Ctrl+Shift+C).

A new panel opens beside the notebook showing the slideshow view.

## Setting slide types

Each cell needs a slide type to define the slide structure. Use JupyterLab's
**Property Inspector** (right sidebar) to set the slide type for each cell:

- **Slide** — starts a new horizontal slide.
- **Sub-Slide** — starts a new vertical slide under the current slide.
- **Fragment** — appears on click within the current slide.
- **Skip** — excluded from the slideshow entirely.
- **-** (dash) — continues the previous slide (default).

## Executing code

Press **Shift+Enter** on a focused code cell to execute it. The output appears
on the slide immediately. The slideshow shares the same kernel as the notebook,
so variables and state are shared.

## Toggling code visibility

While a code cell is focused in the slideshow:

- Press **`i`** to toggle the code input visibility.
- Press **`o`** to toggle the code output visibility.

These are temporary overrides for the current session and do not modify cell
tags.

## Fullscreen and overview

- Press **`f`** to enter fullscreen mode. Press **Escape** to exit.
- Press **`o`** (when no code cell is focused) to toggle the slide overview.

## Keyboard navigation

Standard reveal.js navigation keys apply:

| Key          | Action             |
| ------------ | ------------------ |
| Right / Down | Next slide         |
| Left / Up    | Previous slide     |
| Space        | Next slide (wraps) |
| Escape       | Overview mode      |
