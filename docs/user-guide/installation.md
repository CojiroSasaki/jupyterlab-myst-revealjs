# Installation

## Requirements

- JupyterLab >= 4.0.0
- [jupyterlab-myst](https://github.com/jupyter-book/jupyterlab-myst)

## Install

```bash
pip install jupyterlab-myst-revealjs
```

This installs the prebuilt extension. No Node.js is required.

## Optional dependencies

### jupyterlab-gridwidth

For cell width control (`gridwidth-*` tags) to preview in the notebook view:

```bash
pip install jupyterlab-gridwidth
```

The gridwidth tags work in slideshow mode regardless of whether
jupyterlab-gridwidth is installed. The optional dependency only affects the
notebook view.

## Uninstall

```bash
pip uninstall jupyterlab-myst-revealjs
```
