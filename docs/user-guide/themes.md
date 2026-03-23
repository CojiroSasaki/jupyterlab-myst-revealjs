# Themes

## Bundled themes

The extension bundles 6 reveal.js themes that work offline (no Google Fonts
dependency):

| Theme | Description |
|---|---|
| `white` | White background, dark text (default) |
| `white-contrast` | High-contrast variant of white |
| `black` | Black background, light text |
| `black-contrast` | High-contrast variant of black |
| `serif` | Serif font family, warm tones |
| `dracula` | Dark theme with Dracula color palette |

Set the theme in notebook metadata:

```json
{
    "myst-revealjs": {
        "theme": "dracula"
    }
}
```

### Why only 6 themes?

The extension is designed for offline operation — conference venues and
classrooms often have unreliable network. Themes that depend on Google Fonts
(`moon`, `league`, `sky`, `solarized`, etc.) are excluded from the bundle.

## Custom CSS

For further customization, create a file named `myst-revealjs.css` in the same
directory as the notebook. The extension loads it automatically via the
JupyterLab Contents API.

### Header and footer

The extension generates empty `.jp-Slideshow-header` and `.jp-Slideshow-footer`
overlay elements on every slide. Style them in your custom CSS:

```css
.jp-Slideshow-header::after {
    content: 'My Presentation Title';
    font-size: 0.5em;
    color: #666;
}

.jp-Slideshow-footer::after {
    content: 'Author Name — 2026';
    font-size: 0.4em;
    color: #999;
}
```

### Using online themes

If you need a Google Fonts–dependent reveal.js theme, you can load the font and
override styles in `myst-revealjs.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=League+Gothic&display=swap');

.reveal {
    --r-heading-font: 'League Gothic', sans-serif;
}
```

:::{warning}
Custom CSS that sets `section { background: ... }` will visually conflict with
`slide_background_*` cell metadata. Use cell metadata for per-slide backgrounds.
:::
