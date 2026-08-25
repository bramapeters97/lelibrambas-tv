# Troubleshooting

## Xcode or simulator not found

Open Xcode once, accept the license, install a stable tvOS platform/runtime in Xcode Settings > Platforms, then run `./Scripts/doctor.sh`. CI deliberately rejects a beta Xcode.

## XcodeGen checksum mismatch

Stop. Do not bypass the checksum. Confirm the repository still pins version 2.46.0 and compare the official release asset. A changed archive requires a reviewed checksum update; never accept an unexpected binary on a rented Mac.

## Release configuration failure

Signed archives require real HTTPS gateway and activation endpoints through `APPLE_TV_API_BASE_URL` and `APPLE_TV_ACTIVATION_BASE_URL`. Placeholder, `.invalid`, `.example`, localhost, HTTP, fixture, reviewer, debug-menu, or auth-bypass settings are intentionally rejected.

## Signing failure

Sign into Xcode, ensure the Account Holder has accepted current agreements, reserve `com.lelibrambas.plus`, select the correct team, and confirm automatic signing can create a tvOS App Store profile. Do not download certificates from untrusted sources or commit signing files.

## Activation never completes

Check the expiry and polling response, then inspect gateway logs using only redacted request IDs. Do not log the device code, session token, email, signed playback URL, or authorization headers. Request a new code after expiry.

## Video fails on a physical Apple TV

Confirm the returned URL is HTTPS and resolves to the repository’s supported HLS or MP4 media. Verify the session is current and that signed playback URLs have not expired. Reproduce with one synthetic fixture before inspecting private content.

## Screenshot dimensions are rejected

Use an Apple TV simulator configured for 1920×1080 and rerun `./Scripts/capture-app-store-screenshots.sh`. The script rejects incorrect dimensions or alpha, but a person must still inspect focus, cropping, private information, and artwork rights.
