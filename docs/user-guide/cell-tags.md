# Cell Tags

Cell tags control the visibility of code cells and their layout. All tags follow
the [Jupyter Book convention](https://jupyterbook.org/en/stable/content/metadata.html)
and behave consistently across slideshow, web, and PDF output.

## Visibility tags

These tags work on code cells. Use JupyterLab's **Cell Tags** sidebar or
**Property Inspector** to add them.

| Tag | Effect |
|---|---|
| `hide-input` | Hides the code input area. Togglable with `i` key during the presentation. |
| `hide-output` | Hides the code output area. Togglable with `o` key during the presentation. |
| `hide-cell` | Hides the entire cell. Togglable with `i`/`o` keys. |
| `remove-input` | Removes the code input from the slideshow DOM. Not togglable. |
| `remove-output` | Removes the code output from the slideshow DOM. Not togglable. |
| `remove-cell` | Removes the entire cell from the slideshow DOM. |

The distinction between `hide-*` and `remove-*`:
- **`hide-*`** applies `display: none` via CSS. The element exists in the DOM
  and can be toggled back during the presentation.
- **`remove-*`** excludes the element from the slideshow DOM entirely. It cannot
  be toggled.

:::{note}
A code cell with `hide-input` that has not been executed will appear invisible
on the slide (no input, no output). Execute the cell to see its output.
:::

## Layout tags

| Tag | Effect |
|---|---|
| `gridwidth-1-2` | Cell width 50% |
| `gridwidth-1-3` | Cell width 33% |
| `gridwidth-2-3` | Cell width 67% |

Gridwidth tags enable side-by-side cell layout within a slide. Place two cells
with complementary widths (e.g., `gridwidth-1-3` and `gridwidth-2-3`) on the
same slide to create a two-column layout.

These tags are compatible with
[jupyterlab-gridwidth](https://github.com/timkpaine/jupyterlab-gridwidth),
which provides a visual width control in the notebook view.
