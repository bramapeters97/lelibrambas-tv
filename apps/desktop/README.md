# LELIBRAMBAS+ desktop shell

This workspace wraps the TV web build in a deliberately small Electron process. The renderer remains the same Vite/React TV application in development and production; Electron does not own a second UI implementation.

The browser favicon is also used as the desktop window icon and Windows package icon.

## Commands

- `yarn desktop:dev` from the monorepo root compiles the Electron main process, starts the TV Vite server on `http://127.0.0.1:5173`, and opens the shell. Vite supplies renderer hot-module replacement.
- `yarn desktop:build` builds the TV renderer and Electron main process, then verifies the bundled asset references.
- `yarn desktop:package` is the preferred root command for creating the portable Windows x64 executable under `apps/desktop/release`.
- `yarn workspace @lelibrambas/desktop smoke` runs the policy/runtime smoke suite.
- `yarn workspace @lelibrambas/desktop smoke:electron` launches a hidden production-mode window against the built TV renderer and exits after the page title loads.
- `yarn workspace @lelibrambas/desktop dist:portable` creates the default portable Windows x64 executable under `apps/desktop/release`.
- `yarn workspace @lelibrambas/desktop dist:nsis` creates the optional per-user NSIS installer.

The package intentionally pins Electron `43.4.0` and stable electron-builder `26.15.7` exactly.

## Input contract

Arrow keys, Enter, Space, Escape, Backspace, `R`, `M`, `S`, and `P` pass through unchanged to the TV renderer, which already implements spatial navigation, back, restart, mute, search, and playback behavior. An unmodified `F` is the only key consumed by the shell; it toggles native fullscreen. Modified shortcuts such as Ctrl+F remain untouched.

## Security boundary

- Renderer preferences explicitly enable context isolation and Chromium sandboxing while disabling Node.js, worker Node.js, webviews, insecure mixed execution, drag navigation, and filesystem-capable bridges.
- There is no preload API and no IPC surface. The main process only loads the loopback Vite origin in development or the packaged `tv-dist` directory through the private `lelibrambas://app` protocol in production.
- Development URLs are restricted to plain HTTP loopback origins. Production paths are traversal-checked before local reads.
- New windows, downloads, webviews, external navigation, redirects, device permissions, and runtime permission requests are denied.
- Packaged HTML receives a CSP that permits local scripts only. Media, images, and service requests may use HTTP(S) so the renderer can reach the configured local media service; remote script execution remains blocked.
