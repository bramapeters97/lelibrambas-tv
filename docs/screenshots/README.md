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

## Responsive streaming presentation

The React DOM viewer loads `src/streaming.css` after its base styles. This shared presentation applies to the desktop web/Electron viewer and mobile browsers; it does not change the native Expo or Apple TV screens. It preserves catalogue artwork, profile progress, collection order and playback behaviour.

Desktop keeps the icon rail, with larger landscape cards and a full-width search field above the results. The remote-friendly search keyboard remains available through the “On-screen keyboard” disclosure. Mobile retains bottom navigation, uses larger swipeable cards and two-column result grids, and provides 44px information buttons. Search uses the phone's native keyboard. Home artwork fades into the content rather than sitting behind a small, cropped text block.

For layout review, check home, search, collections, library, details and Play Next at 1920×1080, 1280×720, 390×844 and 320×720, plus 844×390 playback. Check keyboard focus, long titles, horizontal overflow, card information buttons and bottom navigation clearance. Use fictional catalogue content for saved review images.
