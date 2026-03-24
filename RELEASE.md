# Making a new release of jupyterlab-myst-revealjs

## Release process

Releases are published to PyPI automatically via GitHub Actions when a GitHub Release is created.

### Steps

1. Update the version in `package.json`:

   ```bash
   npm version <new-version> --no-git-tag-version
   ```

2. Update `CHANGELOG.md` with the new version and changes.

3. Commit and push:

   ```bash
   git add package.json CHANGELOG.md
   git commit -m "Prepare release v<new-version>"
   git push
   ```

4. Create a GitHub Release:
   - Go to the repository's Releases page
   - Click "Create a new release"
   - Create a new tag `v<new-version>`
   - Add release notes (copy from CHANGELOG.md)
   - Click "Publish release"

5. The `publish.yml` workflow will automatically build and publish the package to PyPI via Trusted Publisher (OIDC).

6. Verify the release on [PyPI](https://pypi.org/project/jupyterlab-myst-revealjs/).
