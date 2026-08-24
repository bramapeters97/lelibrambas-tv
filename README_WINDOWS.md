# Clean Windows setup

This is the supported setup for the web viewer, Library Manager, Electron shell, and importer.
Native iPhone and tvOS compilation require a Mac.

## 1. Install the base tools

Install [Git for Windows](https://git-scm.com/download/win), [Node.js 24 LTS](https://nodejs.org/en/download), and optionally [FFmpeg](https://ffmpeg.org/download.html#build-windows) and [HandBrakeCLI](https://handbrake.fr/downloads2.php) for the workflows that need them.

Open a fresh 64-bit PowerShell window:

```powershell
node --version
corepack --version
corepack enable
corepack prepare yarn@1.22.22 --activate
corepack yarn --version
```

`package.json` and the setup script enforce Node 22.13 or newer through Node 24; Node 24 LTS is recommended. Expo SDK 57's official minimum is Node 22.13.x. Do not install a separate floating global Yarn version. If `corepack` is absent, install the official Node 24 LTS distribution that includes it, or install an explicitly reviewed and pinned Corepack version; do not use an unversioned global install.

## 2. Install the workspace

Clone the repository, then open PowerShell in its root directory (the directory containing `package.json`):

```powershell
corepack yarn setup
```

`start` performs a frozen-lockfile setup when needed, then launches the app. Dependencies and temporary package caches live under `%LOCALAPPDATA%\LeliBramBasPlus\runtime`, with only a `node_modules` junction in the project. Completed caches are removed automatically. On Windows ARM64 it can keep a private x64 FFmpeg helper in that external runtime for demo generation; that helper does not replace system FFmpeg for the importer.

```powershell
corepack yarn typecheck
corepack yarn test
corepack yarn build:web
corepack yarn build:admin
```

The repository may live in OneDrive, but syncing `node_modules` can be slow. Real archive sources must be locally hydrated before import; select **Always keep on this device** in File Explorer.

## 3. Run the applications

```powershell
corepack yarn dev             # TV preview and Library Manager
corepack yarn dev:tv-web      # http://127.0.0.1:5173
corepack yarn dev:admin       # http://127.0.0.1:4174
corepack yarn desktop:dev
```

The servers intentionally bind to loopback. The Library Manager is a local prototype, not a remotely authenticated admin site.

## 4. FFmpeg and HandBrakeCLI

Extract official Windows builds to stable directories and add their executable folders to the current shell. Adjust these examples:

```powershell
$env:Path = "C:\Tools\ffmpeg\bin;C:\Tools\HandBrake;$env:Path"
ffmpeg -version
ffprobe -version
HandBrakeCLI --version
```

Add those folders to the user `Path` through **System Properties > Environment Variables** for future shells. FFmpeg and FFprobe are required for reliable scan/conversion. HandBrakeCLI is optional; without it the importer records its conservative sequential-VOB fallback. Neither tool is used to bypass disc encryption.

Continue with [Video import](README_VIDEO_IMPORT.md).

## 5. Electron and Windows artifacts

`desktop:dev` compiles the Electron main process, starts its own TV Vite server, and opens the shell.

```powershell
corepack yarn desktop:dev
corepack yarn desktop:build
corepack yarn workspace @lelibrambas/desktop smoke
corepack yarn workspace @lelibrambas/desktop smoke:electron
corepack yarn desktop:package
corepack yarn workspace @lelibrambas/desktop dist:nsis
```

`desktop:build` only compiles the TV renderer and Electron main process and verifies the packaged asset references. The preferred portable packaging command is `desktop:package`; `dist:nsis` is the optional installer path.

Outputs under `apps/desktop/release/` are `LeliBramBasPlus-1.0.0-x64-portable.exe` and `LeliBramBasPlus-Setup-1.0.0-x64.exe`. No publisher certificate or update service is configured, so they are unsigned and may trigger SmartScreen. The portable x64 artifact completed and passed its hidden `--smoke-test` on the current Windows ARM64 host through emulation; normal interactive use, SmartScreen behavior, and the optional NSIS install/uninstall path remain unvalidated.

## 6. Keyboard-to-remote controls

| Key                 | Action                                 |
| ------------------- | -------------------------------------- |
| Arrow keys          | Move focus                             |
| Enter               | Select                                 |
| Space               | Select or play/pause where appropriate |
| Escape or Backspace | Back                                   |
| `F`                 | Toggle native Electron full screen     |
| `R`                 | Restart the focused player item        |
| `M`                 | Mute/unmute                            |
| `S`                 | Open search outside the player         |
| `P`                 | Play/pause in the player               |

The Electron process consumes only unmodified `F`; the remaining keys pass to the renderer. Hover and a pointer are never required.

## 7. Common failures

- **Wrong Yarn or duplicate `PATH`/`Path`:** prefer root `corepack yarn ...` commands; root scripts invoke CLI files through the selected Node process.
- **Port in use:** stop the process using `5173`, `4173`, or `4174`; Vite uses strict ports.
- **Playwright browser missing:** run `corepack yarn playwright install chromium` before `corepack yarn test:e2e`.
- **OneDrive file cannot be probed:** hydrate it and run `prepare` again; do not reuse a manifest that marks it unavailable.

## 8. Full local validation

```powershell
corepack yarn validate
```

This runs type checking, lint, formatting validation, automated tests, and both web production builds. Electron packaging, native iPhone/tvOS builds, and Cloudflare remain separate evidence tracks; see [TESTING.md](TESTING.md).

Official reference: [Expo SDK compatibility](https://docs.expo.dev/versions/latest/).
