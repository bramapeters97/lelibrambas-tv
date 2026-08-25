# LeliBrambas+ for Apple TV

This directory contains the isolated, native SwiftUI/AVKit tvOS application. It does not wrap the website and neither the web viewer nor the Windows Electron app depends on it. The deterministic Xcode project is generated from `project.yml` with the verified XcodeGen 2.46.0 release.

## Fast path on a Mac

Requirements: stable Xcode 16 or newer with a tvOS 17-or-newer SDK/simulator runtime, Command Line Tools, Git, and internet access for the first XcodeGen download.

When preparing the commit from Windows, preserve the required Unix script modes with:

```powershell
git add --chmod=+x apps/apple-tv/Scripts/*.sh
```

The dedicated tvOS workflow rejects a commit if any of these scripts is not mode `100755`.

```bash
cd apps/apple-tv
./Scripts/doctor.sh
./Scripts/bootstrap-mac.sh
```

`bootstrap-mac.sh` creates ignored local `Config/Signing.xcconfig` and `Config/Secrets.xcconfig` files only when absent; it never overwrites populated local configuration. The Debug simulator build uses synthetic fixture content only when launched with test-only arguments. Release builds have no authentication bypass.

Before a signed archive, set local team and production gateway values, then run:

```bash
export APPLE_DEVELOPMENT_TEAM="REPLACE_WITH_TEAM_ID"
export APPLE_TV_API_BASE_URL="https://REPLACE_WITH_GATEWAY_HOST"
export APPLE_TV_ACTIVATION_BASE_URL="https://REPLACE_WITH_ACTIVATION_HOST"
./Scripts/doctor.sh --release
./Scripts/archive.sh --version 1.0.0 --build-number 1
./Scripts/upload-testflight.sh "BuildArtifacts/Archives/LeliBrambasTV-1.0.0-1.xcarchive"
```

The final command opens Xcode Organizer; it does not upload by itself. Review and explicitly confirm Apple’s upload dialog.

## Useful commands

```bash
./Scripts/generate-project.sh
./Scripts/verify-project-generation.sh
./Scripts/build-simulator.sh
./Scripts/test.sh
./Scripts/verify-unsigned-archive.sh
./Scripts/capture-app-store-screenshots.sh
./Scripts/assert-repository-isolation.sh
```

Configuration, architecture, testing, TestFlight, and rented-Mac procedures are under `Docs/`. Submission drafts are under `AppStore/`. No production URLs, signing material, credentials, private media, or real account data belong in Git.

Current release gates and unavoidable owner-supplied values are summarized in [Docs/MAC_DAY_RUNBOOK.md](Docs/MAC_DAY_RUNBOOK.md).
