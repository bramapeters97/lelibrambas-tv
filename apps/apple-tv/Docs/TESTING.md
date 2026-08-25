# Testing and CI

## Local Mac

```bash
./Scripts/build-simulator.sh
./Scripts/test.sh
./Scripts/verify-unsigned-archive.sh
./Scripts/assert-repository-isolation.sh
```

`build-simulator.sh` resolves an available Apple TV simulator dynamically and builds with `CODE_SIGNING_ALLOWED=NO`. `test.sh` first runs the local `LeliBrambasCore` Swift package tests, then boots the simulator, runs the shared scheme’s app unit and UI tests serially, and writes an `.xcresult` bundle. CI calls the same two phases as separately named steps for clearer diagnostics. `verify-unsigned-archive.sh` compiles Release for generic tvOS without signing; its `.xcarchive` is a compilation artifact only and cannot be uploaded or installed.

## GitHub Actions

`.github/workflows/tvos-ci.yml` runs only for `apps/apple-tv/**`, the isolated `services/apple-tv-gateway/**`, and its own workflow file. A locked Node 24 job typechecks, tests, and performs a Wrangler dry-run build of the gateway without credentials or deployment. The macOS job uses the `macos-26` hosted image, selects a non-beta Xcode, records Xcode/Swift/runtime versions, verifies XcodeGen, proves that two consecutive project generations are byte-identical, checks isolation, builds, tests, and compiles an unsigned generic-device archive. Diagnostics are retained for seven days even after failure; successful unsigned validation artifacts are also retained for seven days.

GitHub runner images change over time, so the job records the exact image/toolchain in every run. GitHub documents that hosted images and included software are updated regularly: [GitHub-hosted runners](https://docs.github.com/en/actions/concepts/runners/github-hosted-runners).

The workflow needs no Apple credentials and defines no secrets. A green unsigned CI run does not validate signing, App Store processing, physical Apple TV playback, remote-control feel, network/CDN behavior, or review approval.

## Required physical-device checks

- Fresh activation, denial, expiry, session restoration, and logout.
- Catalog/backdrop/poster loading on household networking.
- HLS/MP4 startup, play/pause, ±10-second seek, scrub, audio, interruption, and error recovery.
- Focus order and Back behavior on every screen.
- 1080p and 4K layout, overscan/safe areas, and text readability at viewing distance.
- Relaunch after token expiry and after loss of network.
