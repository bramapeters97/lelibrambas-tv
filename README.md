# LeliBramBas+

Open PowerShell in the cloned repository root (the directory containing `package.json`), then run:

```powershell
corepack yarn start
```

The setup command repairs workspace dependency links, installs the frozen Yarn lockfile when
needed, and starts the viewer at `http://127.0.0.1:5173` plus the local Library Manager at
`http://127.0.0.1:4174`. Stop both with `Ctrl+C`, or press `q` and Enter in terminals that do
not translate `Ctrl+C` into a Windows console signal.

The checked-in catalogue contains 35 fictional placeholders. To enable the same intentionally
public Cloudflare Stream test video for every item, copy the two
`VITE_STREAM_PLACEHOLDER_*` examples from `.env.example` to an ignored
`apps/tv/.env.local`, replace both placeholders, and restart. Never put a secret or private signed
URL in a `VITE_` variable.

Run the complete local verification suite with:

```powershell
corepack yarn validate
corepack yarn test:e2e
```

## Publish the browser viewer with Cloudflare Pages

Connect this repository to a Cloudflare Pages project and use these build settings once:

| Setting                    | Value                         |
| -------------------------- | ----------------------------- |
| Production branch          | `main`                        |
| Root directory             | Leave blank (repository root) |
| Build command              | `corepack yarn build`         |
| Build output directory     | `apps/tv/dist`                |
| Build environment variable | `YARN_VERSION=1.22.22`        |

The checked-in `.node-version` selects Node 24.19.0, while `YARN_VERSION` and the root
`package.json` select Yarn 1.22.22. Each production-branch push then rebuilds and publishes the
browser viewer. Attach `lelibrambas.com` to this Pages project under **Custom domains**; the domain
does not change the build command or output directory.

Do not select `apps/tv` as the Pages root directory. This is a Yarn workspace, so dependency
installation and the build must start at the repository root. Cloudflare serves the generated
`apps/tv/dist/index.html`; the Library Manager and native apps are not part of this deployment.

With the public test asset configured and network access available, verify the real HLS path with
`corepack yarn test:stream`. On Windows, `corepack yarn test:stream:electron` verifies the same
asset through the packaged Electron protocol and content-security policy.

For the phone UI and the quickest iPhone test route, see
[iPhone preview and native development](README_IPHONE.md).
