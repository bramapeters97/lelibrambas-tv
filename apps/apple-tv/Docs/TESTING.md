# Testing and CI

## Local Mac

```bash
./Scripts/build-simulator.sh
./Scripts/test.sh
./Scripts/verify-unsigned-archive.sh
./Scripts/assert-repository-isolation.sh
```

The simulator and unsigned-archive commands validate that the resulting app bundle contains the exact fallback `media_catalog.json`, the tvOS `artwork/generic_cinema_2.png` fallback, official studio brand resource, and the byte-identical web-viewer introduction jingle. Unit tests verify the ident's one-second background-only phase, unchanged logo timing, three-second completed-logo hold, ordered phases, per-cycle play-once behavior, background cancellation, inactive-state stability, background-to-active recreation, and audio-failure fallback. They also cover strict live-API decoding, integer and numeric-string IDs, source ordering, atomic bundled fallback, fresh requests, remote and bundled artwork resolution, exact profile definitions, the 16:9 card contract, the deduplicated catalogue-ordered All movies shelf, profile-isolated Resume/Restart persistence, timestamp and completion rules, trailer hero selection, preview policies, distinct item video sources, direct playback resolution, Search suggestions, and player retry. UI tests verify production launch runs the native ident before showing the local profile selector, selecting a profile reaches Home without activation, a background return replays the ident and requires profile selection again, and the Search/Full Library hierarchies render in deterministic fixture mode.

## GitHub Actions

`.github/workflows/tvos-ci.yml` runs for tvOS source, the production catalogue, bundled artwork, and the workflow itself. Its macOS job verifies deterministic Xcode project generation, repository isolation, simulator build, Swift package tests, tvOS unit/UI tests, screenshots, and an unsigned generic-device archive. It uses no Apple credentials or gateway secrets.

## Required physical-device checks

- Cold-launch through the full ident and audible jingle, select a profile, background the app from profiles/Home/details/playback, and confirm every return replays the ident and requires a profile again. Confirm a transient inactive interruption does not restart the flow, and in-app profile switching does not replay the ident.
- Catalogue, backdrop, landscape thumbnail, and fallback artwork loading.
- HLS/MP4/Cloudflare playback, play/pause, +/-10-second seek, scrub, audio, interruption, and error recovery.
- Focus order and Back behavior on every screen.
- 1080p and 4K layout, overscan/safe areas, and text readability.
- Home ambient preview after two seconds near 40 seconds, detail preview after one second near 120 seconds, cancellation, and full playback from the start.
