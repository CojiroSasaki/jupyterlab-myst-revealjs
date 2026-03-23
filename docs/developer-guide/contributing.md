# Contributing

## Prerequisites

- Python >= 3.10
- Node.js >= 18
- [uv](https://docs.astral.sh/uv/) (recommended) or pip

## Development setup

```bash
# Clone the repository
git clone https://github.com/CojiroSasaki/jupyterlab-myst-revealjs.git
cd jupyterlab-myst-revealjs

# Create a virtual environment and install dependencies
uv venv
uv pip install -e ".[dev]"
jlpm install
jlpm build

# Link the extension for development
jupyter labextension develop . --overwrite
```

## Development workflow

Run JupyterLab and the TypeScript watcher in separate terminals:

```bash
# Terminal 1: watch TypeScript and rebuild on changes
jlpm watch

# Terminal 2: start JupyterLab
uv run jupyter lab
```

Saved changes are rebuilt automatically. Refresh the browser to load them.

## Testing

### Unit tests (Jest)

```bash
jlpm test
```

Tests are in `src/__tests__/`. They cover `SlideBuilder` (slide structure,
background attributes, tag processing) and `settings` (config validation,
theme CSS).

### E2E tests (Playwright + Galata)

```bash
cd ui-tests
jlpm install
jlpm test
```

E2E tests verify JupyterLab integration: slideshow opening, navigation, and
live code execution.

## Linting

```bash
jlpm lint:check    # check only
jlpm lint          # check and fix
```

This runs ESLint, Stylelint, and Prettier.

## Building for production

```bash
jlpm build:prod
```
