# Rental-Mac release-day runbook

This is the chronological handoff. Nothing in this document authorizes deployment, signing, upload, or publication; the owner must deliberately perform those external actions.

## Before renting the Mac

Complete from a trusted browser/Windows machine:

1. Enroll in the Apple Developer Program and enable strong two-factor authentication.
2. Accept current developer and App Store Connect agreements; verify the intended user has Account Holder/Admin/App Manager access as needed.
3. Reserve explicit App ID `com.lelibrambas.plus`. Confirm this is intentionally distinct from any pre-existing prototype identifier.
4. Create the tvOS App Store Connect record using `../AppStore/APP_RECORD_SETUP.md`; record its Apple ID privately.
5. Finalize support contact/URLs, privacy decisions, content-rights confirmations, rating answers, icon/top-shelf art, metadata, and screenshots.
6. Confirm the latest `.github/workflows/tvos-ci.yml` run is green. A workflow file merely present in Git is not proof.
7. Install TestFlight on the physical Apple TV and prepare the Apple ID invitation/redeem route.
8. Have Apple two-factor authentication and recovery access available; never paste credentials into the repository or shell history.

## On the rented Mac

Use a fresh macOS user if the rental provider supports it. Clone only from the trusted repository origin.

```bash
git clone <REPOSITORY_URL>
cd <REPOSITORY_DIRECTORY>/apps/apple-tv
./Scripts/doctor.sh
./Scripts/bootstrap-mac.sh
```

Then:

1. Open Xcode **Settings > Accounts** and sign in to the Apple Developer account.
2. Open `LeliBrambasTV.xcodeproj`, select the `LeliBrambasTV` target, and verify automatic signing sees the intended team and bundle ID. Do not alter targets/build phases manually; regenerate from `project.yml` if needed.
3. Configure only the Apple Developer team. The single public production catalogue endpoint is built in; no local catalogue/poster fallback, alternate endpoint, gateway, activation, or API-secret environment variables are needed:

```bash
export APPLE_DEVELOPMENT_TEAM="REPLACE_WITH_10_CHARACTER_TEAM_ID"
./Scripts/doctor.sh --release
```

4. Re-run verification and capture candidate screenshots:

```bash
./Scripts/build-simulator.sh
./Scripts/test.sh
./Scripts/verify-unsigned-archive.sh
./Scripts/capture-app-store-screenshots.sh
./Scripts/assert-repository-isolation.sh
```

5. Visually review every generated screenshot. Confirm no private names, emails, codes, media, paths, tokens, or unlicensed artwork appear.
6. Choose a new monotonically increasing build number, archive, and open Organizer. The archive command allows Xcode to obtain or refresh the required automatic-signing profile for the selected account and team:

```bash
./Scripts/archive.sh --version 1.0.0 --build-number <NEW_BUILD_NUMBER>
./Scripts/upload-testflight.sh "BuildArtifacts/Archives/LeliBrambasTV-1.0.0-<NEW_BUILD_NUMBER>.xcarchive"
```

7. In Organizer validate, choose **Distribute App > App Store Connect > Upload**, review the report, and explicitly confirm Upload.
8. In App Store Connect verify processing, answer export compliance based on the reviewed code/legal determination, attach the build to an internal group, and follow `TESTFLIGHT_RUNBOOK.md`.

## After upload

1. Confirm build processing and TestFlight availability before ending the rental.
2. Invite the intended internal tester and verify the invitation/redeem path.
3. Physical-device testing can happen later over TestFlight; the Mac and Apple TV need not share a LAN.
4. Record device-only bugs without private catalog details.
5. Run project cleanup; include archives only after confirming the upload exists and the archive is no longer needed:

```bash
./Scripts/cleanup-rental-mac.sh --include-archives
```

6. Sign out of Xcode, App Store Connect, Apple Developer, and source-control browser sessions. Remove only the account added to this rented Mac.
7. Review Trash before emptying it, remove the rented Mac from trusted sessions if appropriate, then terminate the rental instance.

## UNAVOIDABLE MANUAL APPLE STEPS

- Apple Developer enrollment, agreements, roles, two-factor authentication, and account login.
- App ID reservation, App Store Connect record creation, and Team selection.
- Signing certificate/provisioning authorization and Xcode’s signed archive validation.
- Human review and confirmation of the Organizer upload.
- Final privacy, export, content-rights, rating, pricing/availability, territory, review-access, and release decisions.
- TestFlight group invitation/redeeming and physical Apple TV acceptance.
- App Review submission, responses, and unlisted-distribution request.

Everything else—source, targets, schemes, configuration templates, project generation, simulator build/tests, unsigned device compile, screenshot capture, archive command, and cleanup—is prepared in the repository.
