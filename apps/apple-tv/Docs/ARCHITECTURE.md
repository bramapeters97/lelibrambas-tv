# Native Apple TV architecture

## Boundary

The Apple TV target is an isolated SwiftUI application. `TVApp` owns the 10-foot interface and tvOS focus behavior. `Packages/LeliBrambasCore` owns platform-reusable models, API transport, device authorization state, secure session persistence, catalog organization, and media URL resolution. The local package may later be reused by an iPhone/iPad target without coupling any JavaScript application to Swift.

```text
SwiftUI tvOS views
        |
     AppModel
        |
LeliBrambasCore protocols
   |        |          |
device   catalog    playback
 auth    gateway     gateway
        HTTPS only
```

Playback uses `AVPlayer`/`AVPlayerViewController`, so transport controls, seeking, audio selection, and fullscreen behavior remain native to tvOS. Remote artwork and video are loaded only over HTTPS. Authentication uses a device-code exchange and stores only the resulting scoped session record in a this-device-only Keychain item.

## Project generation

`project.yml` is the source of truth for `LeliBrambasTV.xcodeproj` and the shared `LeliBrambasTV` scheme. `Scripts/bootstrap-xcodegen.sh` downloads XcodeGen 2.46.0 from its official release, verifies SHA-256 `4d9e34b62172d645eed6457cac13fc222569974098ef4ee9c3368bedf0196806`, and installs it inside ignored `.tools/`. See the [XcodeGen documentation](https://yonaskolb.github.io/XcodeGen/) and [2.46.0 release](https://github.com/yonaskolb/XcodeGen/releases/tag/2.46.0).

No CocoaPods, external runtime SDK, analytics SDK, advertising SDK, or web view is used.

## Build configurations

- Debug: permits synthetic fixture services only through compile-time-guarded launch arguments used by tests and screenshot capture.
- Release: excludes fixture implementations and rejects localhost, development, or placeholder gateway endpoints at archive time.
- Bundle identifier: `com.lelibrambas.plus`.
- Deployment target: tvOS 17.0.
- Marketing version: 1.0.0; build number is supplied per archive.

Configuration values and signing material remain local; see `CONFIGURATION.md`.
