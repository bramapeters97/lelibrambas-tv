# Screenshot production

`corepack yarn screenshots` runs `scripts/capture-screenshots.mjs`. It starts a loopback Vite server for the React DOM TV preview (`4173`), opens fixed deterministic routes in headless Chromium, waits for the target surface/fonts, and writes WebP review artifacts to the repository root:

`assets/lelibrambas-plus/screenshots/`

The script prefers an installed Microsoft Edge or Google Chrome executable on Windows. If neither exists, install Playwright Chromium first:

```powershell
corepack yarn playwright install chromium
corepack yarn screenshots
```

Seven captures use a 1920x1080 viewport: studio ident, profiles, home, hubs, details, player, and timeline. An eighth home capture uses 1280x720. Filenames are numbered `01-` through `08-` for stable review ordering.

These are browser screenshots, not native tvOS captures. They contain the fictional catalogue, CSS artwork, and generated demo media only. The script never scans importer folders or private media. Review every image before publication anyway, and never replace the deterministic routes with real family state.
