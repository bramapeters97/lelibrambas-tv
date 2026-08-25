# LELIBRAMBAS+

Open PowerShell in the cloned repository root (the directory containing `package.json`), then run:

```powershell
corepack yarn start
```

The setup command repairs workspace dependency links, installs the frozen Yarn lockfile when
needed, and starts the viewer at `http://127.0.0.1:5173`. Stop it with `Ctrl+C`, or press `q`
and Enter in terminals that do not translate `Ctrl+C` into a Windows console signal.

## Local media catalogue

The viewer catalogue is generated, never maintained as a React array:

```text
media_catalog_populated.xlsx
        ↓
corepack yarn catalog:generate
        ↓
data/media_catalog.json
```

`media_catalog_populated.xlsx` remains the editable source and is never loaded by the browser.
The generator reads its first worksheet, validates all seven columns and field types, normalizes
the owner-approved `OTHER` category spelling to `OTHERS`, sorts records by numeric `id`, resolves
poster filenames against the repository-root `artwork/` directory, and writes deterministic JSON.
Commit `data/media_catalog.json` after regenerating it.

The repository-root `artwork/` directory is the artwork source of truth. Local JSON poster values
use the platform-neutral `artwork/<filename>.png` contract. A missing or ambiguously absent poster
uses `artwork/generic_cinema_2.png`. The browser maps those values to
`/artwork/<filename>.png`; it never uses `../artwork` or a local filesystem path.

Run either command after editing the workbook or artwork:

```powershell
corepack yarn content:prepare
# or separately
corepack yarn catalog:generate
corepack yarn artwork:sync
```

`artwork:sync` copies root artwork and the generated catalogue into the Vite public directory.
The generated runtime copies are ignored; the root artwork and `data/media_catalog.json` remain
canonical. `content:prepare` runs automatically before the root and TV workspace development and
production-build commands.

Start the local viewer with `corepack yarn start`, or run its Vite command directly with:

```powershell
corepack yarn dev:tv-web
```

Run the complete local verification suite with:

```powershell
corepack yarn validate
corepack yarn test:e2e
```

## Publish the browser viewer with Cloudflare Workers Builds

Connect this repository to the `lelibrambas-tv` Worker and use these build settings once:

| Setting                    | Value                          |
| -------------------------- | ------------------------------ |
| Production branch          | `main`                         |
| Root directory             | `/`                            |
| Build command              | `corepack yarn build`          |
| Deploy command             | `npx wrangler deploy`          |
| Version command            | `npx wrangler versions upload` |
| Build environment variable | `YARN_VERSION=1.22.22`         |
| Build environment variable | `NODE_VERSION=24.19.0`         |

The checked-in `.node-version` selects Node 24.19.0, while `YARN_VERSION` and the root
`package.json` select Yarn 1.22.22. The root `wrangler.jsonc` names the Worker, supplies its required
compatibility date, points Workers Static Assets at `apps/tv/dist`, and enables SPA navigation.
Each production-branch push then rebuilds and publishes the browser viewer. Attach
`lelibrambas.com` to this Worker under **Settings > Domains & Routes > Custom Domain**.

Do not select `apps/tv` as the build root directory. This is a Yarn workspace, so dependency
installation, the build, and Wrangler must start at the repository root. Cloudflare serves the generated
`apps/tv/dist/index.html`; native apps are not part of this deployment.

With network access available, `corepack yarn test:stream` verifies the first generated movie's
secure Cloudflare Stream player. On Windows, `corepack yarn test:stream:electron` verifies that
the packaged Electron protocol passes the same selected catalogue row to its Stream iframe.

For the phone UI and the quickest iPhone test route, see
[iPhone preview and native development](README_IPHONE.md).
