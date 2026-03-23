# Configuration

Slideshow settings are stored in the notebook metadata under the `myst-revealjs`
key. Edit them via **Edit → Notebook Metadata** in JupyterLab.

## Example

```json
{
    "myst-revealjs": {
        "theme": "white",
        "transition": "fade",
        "controls": true,
        "progress": true,
        "slideNumber": false,
        "center": true,
        "width": 960,
        "height": 700,
        "scroll": false
    }
}
```

## Options reference

| Option | Type | Default | Description |
|---|---|---|---|
| `theme` | string | `"white"` | reveal.js theme name. See [Themes](themes.md) for available themes. |
| `transition` | string | `"slide"` | Slide transition effect: `none`, `fade`, `slide`, `convex`, `concave`, `zoom`. |
| `controls` | boolean | `true` | Show navigation arrows. |
| `progress` | boolean | `true` | Show progress bar. |
| `slideNumber` | boolean | `false` | Show slide number. |
| `center` | boolean | `true` | Vertically center slide content. |
| `width` | number | `960` | Slide width in pixels. |
| `height` | number | `700` | Slide height in pixels. |
| `scroll` | boolean | `false` | Enable scroll mode for overflowing slides. When `true`, slides whose content exceeds the viewport get a scrollbar. |

## Validation

Invalid values (e.g., an unrecognized theme name or a non-boolean for
`controls`) are silently replaced with their defaults. Partial settings are
supported — only the options you specify are overridden.
