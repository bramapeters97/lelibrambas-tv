# Testing and CI

## Local Mac

```bash
./Scripts/build-simulator.sh
./Scripts/test.sh
./Scripts/verify-unsigned-archive.sh
./Scripts/assert-repository-isolation.sh
```

The simulator and unsigned-archive commands validate that the resulting app bundle contains the exact production `media_catalog.json`, the `artwork/` directory, `generic_cinema_2.png`, and the official studio brand resource. Unit tests verify local catalogue loading, exact profile definitions, the 16:9 card contract, trailer hero selection, one-second/120-second preview policy, fallback artwork, distinct item video sources, and direct playback resolution. UI tests verify production launch shows the local profile selector and that selecting a profile reaches Home without activation.

## GitHub Actions

`.github/workflows/tvos-ci.yml` runs for tvOS source, the production catalogue, bundled artwork, and the workflow itself. Its macOS job verifies deterministic Xcode project generation, repository isolation, simulator build, Swift package tests, tvOS unit/UI tests, screenshots, and an unsigned generic-device archive. It uses no Apple credentials or gateway secrets.

## Required physical-device checks

- Launch and relaunch to the local profile selector, then select each profile and switch profiles from Home.
- Catalogue, backdrop, landscape thumbnail, and fallback artwork loading.
- HLS/MP4/Cloudflare playback, play/pause, +/-10-second seek, scrub, audio, interruption, and error recovery.
- Focus order and Back behavior on every screen.
- 1080p and 4K layout, overscan/safe areas, and text readability.
- Detail preview delay, muted playback near 120 seconds, cancellation, and full playback from the start.
