# Contributor and agent instructions

These rules apply within `projects/lelibrambas-plus/`.

## Product boundary

LeliBramBas+ is a private family archive prototype. Keep every checked-in fixture fictional/synthetic. Never add real family media, photographs, filenames, OneDrive paths, importer manifests, tokens, account IDs, signing keys, device tokens, or production URLs.

Treat every pre-existing root portfolio file as read-only. Never edit the root `index.html`, existing project categories/navigation, GitHub Pages configuration, or existing assets. The standalone case-study paths are separately scoped work and must remain unpublished. An unlinked page is not protected.

Without a new explicit owner instruction, never push, merge, open a pull request, deploy, provision cloud resources, apply remote migrations, store remote secrets, upload media, sign/publish an app, or access a personal OneDrive account.

## Architecture facts to preserve

- `apps/tv/src/` is the complete React DOM/Vite/Electron viewer.
- `apps/tv/App.tsx` is a smaller native Expo/React Native TV shell.
- `apps/admin` persists a local demo snapshot and simulates importer/cloud jobs; it does not execute the CLI or Worker.
- `tools/video-importer` is the real local import path and must remain source-preserving.
- `services/api`/`infra` are unprovisioned adapters. A Wrangler dry-run is allowed; a deployment is not implicit.
- Generated `apps/tv/android/` and `apps/tv/ios/` are disposable CNG outputs and ignored.

## Toolchain invariants

Use Node 24 LTS (`package.json` and setup accept 22.13 or newer through 24), Corepack, Yarn Classic `1.22.22`, and the frozen lockfile. Do not replace exact TV pins with ranges or floating `latest`. The accepted stack is documented in `docs/decisions/0001-tv-stack.md`.

On Windows PowerShell, prefer root commands:

```powershell
corepack yarn setup
corepack yarn typecheck
corepack yarn lint
corepack yarn format:check
corepack yarn test
corepack yarn build:web
corepack yarn build:admin
corepack yarn validate
```

Run Playwright, Electron smoke, native builds, or importer integration checks when the changed area requires them; they are not included in `validate`.

## Change rules

1. Inspect the relevant `package.json` script and implementation before documenting or invoking it.
2. Preserve exact pins and one `yarn.lock`; use Expo's SDK matrix and TV guide before any native dependency change.
3. Do not claim web feature parity on Android TV/tvOS without native evidence.
4. Keep server-only code/secrets out of Vite/Electron renderer bundles; never use `VITE_` for privileged values.
5. Do not make the admin server listen publicly without adding/reviewing authentication and origin controls.
6. Importer output must stay outside source. Keep dry-run side-effect free, use `.partial` promotion, atomic state, bounded concurrency, and no source deletion.
7. Do not weaken Electron sandbox/context isolation/navigation/permission controls to solve a content issue.
8. Do not edit generated native folders as the source of truth; change `app.config.ts`/plugins and regenerate.
9. Update architecture/security/testing/platform docs when behavior, commands, bindings, artifacts, or support claims change.
10. Keep unrelated user changes intact and avoid destructive Git commands.

## Before handoff

- State exactly what was tested and what was not.
- Check that fixtures/screenshots are synthetic and paths contain no personal source data.
- Verify no `.env`, manifest/state, native build, Electron release, Playwright report, or private media was staged accidentally.
- Treat cloud deploy, app signing/submission, and public publication as separate approval gates.
- Confirm explicitly that nothing was pushed, merged, published, uploaded, or deployed.
