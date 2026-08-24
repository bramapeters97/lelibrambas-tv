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

With the public test asset configured and network access available, verify the real HLS path with
`corepack yarn test:stream`. On Windows, `corepack yarn test:stream:electron` verifies the same
asset through the packaged Electron protocol and content-security policy.

For the phone UI and the quickest iPhone test route, see
[iPhone preview and native development](README_IPHONE.md).
