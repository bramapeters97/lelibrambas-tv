# LELIBRAMBAS+ desktop shell

This workspace wraps the TV web build in a deliberately small Electron process. The renderer remains the same Vite/React TV application in development and production; Electron does not own a second UI implementation. A packaged build first uses the web bundle's canonical origin for the existing Cloudflare Access email/code check, then switches to its bundled renderer only after a successful protected response and a non-expired Access cookie are both present.

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

Arrow keys, Enter, Space, Escape, Backspace, `R`, `M`, `S`, and `P` pass through unchanged to the TV renderer, which already implements spatial navigation, back, restart, mute, search, and playback behavior. `F11` is the only key consumed by the shell; it toggles native fullscreen while ordinary text input remains untouched.

The window opens at 1600x900 with a 960x540 minimum and no forced aspect-ratio lock, so standard Windows resizing, snapping, maximizing, and fullscreen behavior remain available. Desktop-only injected CSS suppresses accidental page-text selection and image dragging while preserving selection inside editable fields.

## Security boundary

- Renderer preferences explicitly enable context isolation and Chromium sandboxing while disabling Node.js, worker Node.js, webviews, insecure mixed execution, drag navigation, and filesystem-capable bridges.
- There is no preload API and no IPC surface. The main process loads the loopback Vite origin in development. A packaged build authenticates against the HTTPS canonical origin declared by `tv-dist/index.html`, then loads that same bundle locally through the private `lelibrambas://app` protocol.
- Development URLs are restricted to plain HTTP loopback origins. Production paths are traversal-checked before local reads.
- During authentication, top-level navigation is restricted to the protected application origin, the exact Cloudflare Access team host learned from its redirect, and a script-free local retry page. The session cookie is checked locally and against the protected origin on window focus and every five minutes; an expired cookie returns to the same email/code flow, while network/login failures show the fail-closed retry page without exposing the renderer. No credentials, tokens, or allowed addresses are bundled.
- New windows, downloads, webviews, unrelated external navigation, device permissions, and unrelated runtime permission requests are denied. Authentication redirects, secure Cloudflare Stream subframe redirects, and fullscreen requests from the app or an allowed Stream frame are the narrow exceptions needed for login and playback.
- Packaged HTML receives a CSP that permits local scripts only. Images, media, and service requests are limited to local resources and HTTPS Cloudflare Stream delivery hosts; remote script execution remains blocked.
