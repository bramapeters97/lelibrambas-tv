# Testing and CI

## Local Mac

```bash
./Scripts/build-simulator.sh
./Scripts/test.sh
./Scripts/verify-unsigned-archive.sh
./Scripts/assert-repository-isolation.sh
```

The simulator and unsigned-archive commands validate that the resulting app bundle contains the exact production `media_catalog.json`, the `artwork/` directory, `generic_cinema_2.png`, official studio brand resource, and the byte-identical web-viewer introduction jingle. Unit tests verify the ident's text, timing, ordered phases, play-once behavior and audio-failure fallback alongside local catalogue loading, exact profile definitions, the 16:9 card contract, trailer hero selection, preview policies, fallback artwork, distinct item video sources, direct playback resolution, Search suggestions, and player retry. UI tests verify production launch runs the native ident before showing the local profile selector, selecting a profile reaches Home without activation, and the Search/Full Library hierarchies render in deterministic fixture mode.

## GitHub Actions

`.github/workflows/tvos-ci.yml` runs for tvOS source, the production catalogue, bundled artwork, and the workflow itself. Its macOS job verifies deterministic Xcode project generation, repository isolation, simulator build, Swift package tests, tvOS unit/UI tests, screenshots, and an unsigned generic-device archive. It uses no Apple credentials or gateway secrets.

## Required physical-device checks

- Launch and relaunch through the full ident and audible jingle to the local profile selector, then select each profile and switch profiles from Home without replaying the ident.
- Catalogue, backdrop, landscape thumbnail, and fallback artwork loading.
- HLS/MP4/Cloudflare playback, play/pause, +/-10-second seek, scrub, audio, interruption, and error recovery.
- Focus order and Back behavior on every screen.
- 1080p and 4K layout, overscan/safe areas, and text readability.
- Home ambient preview after two seconds near 40 seconds, detail preview after one second near 120 seconds, cancellation, and full playback from the start.
