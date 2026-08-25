# TestFlight-first runbook

TestFlight is the beta and physical-device validation route, not the intended permanent distribution mechanism. Apple currently makes builds testable for up to 90 days and supports tvOS internal and external testing; confirm current limits in [Apple’s TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview) before release.

## 1. Prepare and upload

1. Create the App Store Connect record described in `../AppStore/APP_RECORD_SETUP.md` before upload.
2. On the Mac, run `./Scripts/doctor.sh --release`, simulator tests, screenshot review, and a unique signed archive.
3. Run `./Scripts/upload-testflight.sh <archive-path>`.
4. In Xcode Organizer choose **Distribute App > App Store Connect > Upload**.
5. Review signing, symbols, bundle ID `com.lelibrambas.plus`, version, and build number, then explicitly confirm Upload.
6. In App Store Connect open **My Apps > LeliBrambas+ > TestFlight** and wait for processing. Resolve every compliance or processing question; do not guess at encryption answers.

## 2. Configure TestFlight

1. Under **TestFlight > Additional > Test Information**, paste the reviewed fields from `../AppStore/TESTFLIGHT_METADATA.md`; replace every placeholder.
2. Start with an **internal testing** group containing only trusted App Store Connect users. Add the processed tvOS build to that group.
3. For a non-App-Store-Connect family tester, create an external group, provide Beta App Review information, and submit the first build for TestFlight App Review when prompted.
4. Do not expose a public invitation link unless its broader sharing risk is understood.

## 3. Install on Apple TV

These paths do not require the rented Mac to share the Apple TV’s network.

### Email invitation

1. Install **TestFlight** from the App Store on Apple TV.
2. Open the email invitation on a phone, tablet, or computer and choose **View in TestFlight**.
3. Copy the redemption code shown on the resulting page.
4. On Apple TV open TestFlight, choose **Redeem**, and enter that code.
5. Select LeliBrambas+ and install.

### Public-link invitation

1. Install TestFlight on both an iPhone/iPad and Apple TV, signed into the same App Store account.
2. Open the public link on the iPhone/iPad and accept the beta.
3. Open TestFlight on Apple TV; the accepted app should appear for installation.

Apple publishes these tvOS-specific steps at [testflight.apple.com](https://testflight.apple.com/).

## 4. Physical-device acceptance

- Confirm launch goes directly to Home without an activation screen or startup network request.
- Relaunch and confirm the bundled production catalogue opens again without account or session state.
- Confirm bundled PNG artwork loads and a missing poster uses `generic_cinema_2.png`.
- Play supported HLS/MP4 content; test play/pause, ±10-second seeking, scrubber, volume/audio routing, interruption, Back, and error recovery.
- Check focus, safe areas, typography, and crop at 1080p and 4K where devices permit.
- Email tester feedback to the configured feedback address; tvOS does not provide the same screenshot feedback flow as all other platforms.

After validation, expire or retire obsolete beta builds and proceed through normal App Review plus the unlisted-distribution request.
