# Cell Metadata

## Slide type

The `slideshow.slide_type` cell metadata defines the slide structure. This is
the same metadata used by RISE and nbconvert.

```json
{
  "slideshow": {
    "slide_type": "slide"
  }
}
```

| Value        | Behavior                                                  |
| ------------ | --------------------------------------------------------- |
| `"slide"`    | Starts a new horizontal `<section>`.                      |
| `"subslide"` | Starts a new vertical sub-slide within the current slide. |
| `"fragment"` | Displayed on click within the current slide.              |
| `"skip"`     | Excluded from the slideshow DOM.                          |
| `"-"`        | Continues the previous slide (default).                   |

The first cell implicitly starts a slide even without an explicit
`"slide"` type.

## Slide state

The `slideshow.slide_state` cell metadata overrides the notebook-level
`slide_state` for individual slides. This controls vertical alignment of
slide content.

```json
{
  "slideshow": {
    "slide_type": "slide",
    "slide_state": "middle"
  }
}
```

| Value      | Behavior                                    |
| ---------- | ------------------------------------------- |
| `"top"`    | Align content to the top of the slide.      |
| `"middle"` | Vertically center content within the slide. |
| `"bottom"` | Align content to the bottom of the slide.   |

When omitted, the slide uses the notebook-level `slide_state` setting
(default: `"middle"`). Like background attributes, `slide_state` applies
only to `"slide"` and `"subslide"` cells. Continuation cells (`"-"`) do
not carry this attribute.

A typical use case is setting `slide_state: "top"` globally for body slides
and overriding with `"middle"` on title or section divider slides.

## Slide backgrounds

Per-slide background settings are specified in the `slideshow` metadata with the
`slide_background_*` prefix. They are mapped to reveal.js `data-background-*`
attributes on the `<section>` element.

```json
{
  "slideshow": {
    "slide_type": "slide",
    "slide_background_color": "#1a1a2e",
    "slide_background_image": "url(image.png)",
    "slide_background_size": "cover",
    "slide_background_position": "center",
    "slide_background_repeat": "no-repeat",
    "slide_background_opacity": "0.5"
  }
}
```

| Metadata key                | reveal.js attribute        |
| --------------------------- | -------------------------- |
| `slide_background_color`    | `data-background-color`    |
| `slide_background_image`    | `data-background-image`    |
| `slide_background_size`     | `data-background-size`     |
| `slide_background_position` | `data-background-position` |
| `slide_background_repeat`   | `data-background-repeat`   |
| `slide_background_opacity`  | `data-background-opacity`  |

Background attributes are set on the `<section>` that the cell starts. They
apply only to `"slide"` and `"subslide"` cells. Continuation cells (`"-"`) do
not carry background attributes — set them on the cell that starts the slide.

### Dark backgrounds

reveal.js automatically detects dark backgrounds and adds a
`has-dark-background` class to the slide. The extension uses this class to
switch markdown cell text colors to white. Code cells retain their JupyterLab
styling regardless of background color.
