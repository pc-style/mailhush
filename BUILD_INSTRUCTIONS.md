# Build and release instructions

## Requirements

- macOS, Linux, or Windows with WSL
- [Bun 1.2.9](https://bun.sh/) (the version pinned in `package.json`)
- Git, for creating a source archive

## Build and check

From a clean checkout of the release commit:

```bash
bun install --frozen-lockfile
bun run test
bun run typecheck
bun run build
bun run package
bun run build:firefox
bun run package:firefox
```

The commands create unpacked builds and `chrome-mv3-prod.zip` / `firefox-mv2-prod.zip` under the ignored `build/` directory. No publishing credentials are required to build or package the extension.

## Source archive

Create the source archive from the committed tree rather than checking an archive into Git:

```bash
bun run package:source
```

This creates `build/mailhush-source-<version>.zip` with the extension source, lockfile, configuration, assets, and build documentation selected from `HEAD`. It excludes untracked files, local environment files, deployment links, dependencies, and build output. Commit all intended release changes before running it; the archive deliberately represents `HEAD`, not uncommitted work.

## Website

The website is an independent Astro project:

```bash
npm --prefix website/why ci
npm --prefix website/why run build
```

Its output is `website/why/dist/`. To deploy it, connect `website/why` to a hosting project and use that directory's build command. Hosting account/project IDs and credentials must stay in the host or CI secret store; do not commit `.vercel/`, `.env*`, tokens, or service-account files.

## Release automation

Tags matching `v*` trigger `.github/workflows/release.yml`, which builds both packages and attaches them to a GitHub Release. Firefox submission occurs only when the repository's `SUBMIT_KEYS` secret contains valid JSON. The workflow never requires that secret for ordinary builds, and contributors should not put publishing credentials in source archives or local files.

---

### Regarding `innerHTML` warnings

The validation warnings regarding "Unsafe assignment to innerHTML" are false positives originating from the Preact / React-DOM internals used by the Plasmo popup bundle. MailHush does not use `innerHTML` or `dangerouslySetInnerHTML` in its source code for user-facing data rendering.
