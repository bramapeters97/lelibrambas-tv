# Testing and verification

This guide describes configured commands and coverage, not a historical pass report. A script or artifact directory existing is not proof of success; record the exact command, exit code, host, and produced artifact for the current commit.

## Automated commands

Run from the project root in PowerShell:

| Command                                                       | What it currently checks                                              |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `corepack yarn typecheck`                                     | Each TypeScript project across apps, packages, API, D1, and importer. |
| `corepack yarn lint`                                          | ESLint for the workspace.                                             |
| `corepack yarn format:check`                                  | Prettier check.                                                       |
| `corepack yarn test`                                          | Vitest plus compiled Electron policy/path/input smoke tests.          |
| `corepack yarn build:web`                                     | TV React DOM typecheck and Vite production bundle.                    |
| `corepack yarn build:admin`                                   | Admin typecheck and Vite production bundle.                           |
| `corepack yarn validate`                                      | The six checks above, sequentially.                                   |
| `corepack yarn catalog:test`                                  | Excel/JSON row, schema, poster, category, and determinism checks.     |
| `corepack yarn test:e2e`                                      | Playwright against a Vite preview on `127.0.0.1:4173`.                |
| `corepack yarn test:stream`                                   | Opt-in real Stream HLS/CORS smoke using ignored public viewer config. |
| `corepack yarn test:stream:electron`                          | Opt-in packaged custom-origin Stream/CSP playback smoke.              |
| `corepack yarn workspace @lelibrambas/desktop smoke`          | Compiled Electron policy/path/input tests.                            |
| `corepack yarn workspace @lelibrambas/desktop smoke:electron` | Hidden Electron window loads packaged renderer and expected title.    |
| `corepack yarn workspace @lelibrambas/api build`              | Wrangler bundle dry-run; does not deploy.                             |

The Expo entry in `apps/tv/App.tsx` dispatches between the smaller tvOS shell and the phone branch.
The phone branch covers profile selection, Home, Search, Collections, Saved, catalogue details,
and the bundled demo player. These target commands are outside `validate`:

| Command                         | Target and evidence boundary                                              |
| ------------------------------- | ------------------------------------------------------------------------- |
| `corepack yarn dev:mobile`      | `EXPO_TV=0` Expo web LAN preview for iPhone Safari; web evidence only.    |
| `corepack yarn mobile:prebuild` | Clean ignored native generation with `EXPO_TV=0`; not a successful build. |
| `corepack yarn ios:mobile`      | `EXPO_TV=0` local Xcode/device build; requires a Mac and signing.         |
| `corepack yarn tv:prebuild`     | Clean ignored native generation with `EXPO_TV=1`; not a successful build. |

`app.config.ts` uses `EXPO_TV` to switch between tvOS and iPhone plugin targets and orientation. The
root tvOS prebuild script sets it explicitly through its workspace script. Regenerate cleanly when switching iPhone and tvOS
targets; do not treat a previously generated native folder as evidence for the other target. The
native configuration and commands cover iPhone and tvOS only.

Wrangler type generation and its dry-run bundle are platform-blocked on the current Windows Arm64 host because the bundled `workerd` binary is unsupported there. Re-run them on a supported host; the fallback binding snapshot is not generated-build evidence.

Install Playwright's browser once if no compatible binary is present:

```powershell
corepack yarn playwright install chromium
corepack yarn test:e2e
```

## Current coverage

The catalogue validation script checks Excel/JSON row parity, all seven keys and types, unique
integer IDs, four categories, safe resolvable poster paths, fallback existence, deterministic output,
and removal of the old viewer placeholder fixtures. Vitest also covers JSON loading failures, poster
fallback behavior, Cloudflare web/native playback resolution, selected-row URL preservation,
player/progress/pairing helpers, geometry-based focus, and TV watchlist state. The remaining suites
cover the Library Manager, provider contracts, API, D1, importer, and Electron policies.

Playwright covers profile-to-home-to-details-to-player selection, exact selected-row Stream URL
handoff, visible arrow focus, search/watchlist, all four collections, poster-backed hero rendering,
and rendered catalogue ID/count parity with the generated JSON. Tests reset local storage and use
deterministic capture routes.

Importer conversion tests use a fake process runner and temporary fixtures. They prove orchestration/safety, not that a particular installed FFmpeg build correctly decodes every family codec or damaged disc.

## Not included in `validate`

- Playwright E2E and screenshot capture.
- Interactive Electron fullscreen/input QA and Windows NSIS install/uninstall. The hidden production shell and portable x64 artifact smoke tests passed locally.
- A real FFmpeg/FFprobe/HandBrakeCLI import.
- Automated coverage of the phone-specific profile/Home/Search/Collections/Saved/details/player
  flow.
- iPhone Safari touch/layout/video QA or a native iOS build, device install, signing, safe areas,
  lifecycle, fullscreen, and `expo-video` behavior.
- tvOS/Xcode build, Siri Remote, Apple TV hardware, signing, or App Store metadata.
- Deployed Cloudflare bindings, authentication under load, rate limiting, migration against remote D1, Stream upload/transcode/playback, or R2 lifecycle.
- Performance, long-duration playback, network interruption, accessibility audit, and private-data review.

## Manual release matrix

Before calling a surface ready, record date, revision, device/OS, exact command, and artifact hash.

1. Web: Edge and Chrome at 1920x1080 and 1280x720; keyboard-only complete flow; reduced motion; 200% admin zoom.
2. Electron: packaged portable artifact, fullscreen/input, denied navigation/download, offline local assets, and clean exit.
3. iPhone Safari: same trusted LAN, current Mobile Safari, portrait/landscape, touch, text input,
   profile/Home/Search/Collections/Saved/details/player, and reload/session behavior.
4. Native iPhone: current supported Mac/Xcode and physical iPhone; signing/install, safe areas,
   native video/fullscreen/audio, VoiceOver, interruption, background/foreground, and memory
   pressure.
5. tvOS: current supported Xcode/tvOS simulator plus physical Apple TV before distribution.
6. Importer: a copied non-critical sample set, a dry-run review, interrupted/resumed conversion, checksum verify, and visual/audio spot checks. Never use the only copy of an archive as a test fixture.

Safari exercises the React Native Web rendering of the phone branch. It is not native iOS evidence,
and neither Safari nor a native phone pass establishes parity with the React DOM viewer or the
tvOS shell. See [iPhone preview and native development](README_IPHONE.md) for the LAN and Xcode
routes.

## Screenshots and artifacts

```powershell
corepack yarn screenshots
```

This captures synthetic web/admin states, not native tvOS UI. See [`docs/screenshots/README.md`](docs/screenshots/README.md). Playwright traces/reports, generated iOS content, Electron releases, and importer state are ignored by Git.

Open every final WebP at full size and reject captures with browser chrome, loading states, clipped focus, scrollbars, personal paths, real media, weak contrast, or stretched 4:3 content. File presence alone is not visual approval.
