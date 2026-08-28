# Troubleshooting

## Xcode or simulator not found

Open Xcode once, accept the license, install a stable tvOS platform/runtime in Xcode Settings > Platforms, then run `./Scripts/doctor.sh`. CI deliberately rejects a beta Xcode.

## XcodeGen checksum mismatch

Stop. Do not bypass the checksum. Confirm the repository still pins version 2.46.0 and compare the official release asset. A changed archive requires a reviewed checksum update.

## Release configuration failure

Run `./Scripts/validate-bundled-content.sh`. Release requires the production API loader and must not contain a local catalogue, poster directory, or alternate catalogue endpoint. The production API endpoint is built in and public; no activation endpoint or secret configuration is required.

## Signing failure

Sign into Xcode, ensure the Account Holder has accepted current agreements, reserve `com.lelibrambas.plus`, select the correct team, and confirm automatic signing can create a tvOS App Store profile. Do not download certificates from untrusted sources or commit signing files.

## Catalogue or poster fails to load

Confirm the Apple TV can reach the configured public movies API and each item’s absolute HTTPS `poster_url`, then regenerate the Xcode project and run `./Scripts/build-simulator.sh`. A catalogue failure should show the existing retry action. Missing or failed item artwork uses the existing code-rendered placeholder; no local movie catalogue or poster PNG is required.

## Video fails on a physical Apple TV

Confirm the selected item’s `stream_video_id` is HTTPS and resolves to supported HLS, MP4, or Cloudflare Stream playback. The catalogue request occurs at startup; there is no gateway or catalogue request between selection and AVPlayer.

## Screenshot dimensions are rejected

Use an Apple TV simulator configured for 1920×1080 and rerun `./Scripts/capture-app-store-screenshots.sh`. The script rejects incorrect dimensions or alpha, but a person must still inspect focus, cropping, private information, and artwork rights.
