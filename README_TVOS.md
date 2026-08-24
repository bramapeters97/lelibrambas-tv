# tvOS development and Mac handoff

The source tree and web preview can be tested on Windows, but a real tvOS build, Apple TV Simulator, signing, and device installation require macOS with Xcode. Windows cannot provide Xcode or the tvOS Simulator.

## Repository configuration

`apps/tv/app.config.ts` declares bundle identifier `studios.lelibrambas.plus`, the New Architecture,
tvOS deployment target `17.0`, and the `expo-video` config plugin. It derives the plugin target and
orientation from `EXPO_TV`: `1`/`true` selects TV and landscape; other values select phone and the
default orientation.

`apps/tv/App.tsx` dispatches on `Platform.isTV`. A tvOS build renders its focused
profile/home/player TV shell, plays a bundled synthetic MP4, and uses React Native TV focus/remote
primitives. A phone build instead renders `apps/tv/mobile/MobileApp.tsx`, whose flows are profile,
Home, Search, Collections, Saved, catalogue details, and the demo player. Neither branch is the
complete React DOM viewer, and no parity between these surfaces is claimed.

## Mac prerequisites and run

Use a Mac supported by a current Xcode compatible with Expo SDK 57. Expo's TV guide requires Xcode 16+ and tvOS SDK 17+; Apple publishes exact host requirements on its [Xcode support page](https://developer.apple.com/support/xcode/). Install the tvOS platform if missing:

```powershell
xcodebuild -version
xcodebuild -downloadAllPlatforms
```

Install Node 24 LTS, enable Corepack, clone the same revision, then:

```powershell
corepack enable
corepack prepare yarn@1.22.22 --activate
corepack yarn setup
corepack yarn workspace @lelibrambas/tv prebuild:tv
corepack yarn workspace @lelibrambas/tv tvos
```

The last command runs `expo run:ios` with `EXPO_TV=1`, compiles, and targets the active Apple TV simulator. Generated `apps/tv/ios/` content is ignored; regenerate it from `app.config.ts` after SDK/plugin changes.

The root `tv:prebuild` script and the workspace `prebuild:tv`/`tvos` scripts explicitly select
`EXPO_TV=1`. This prevents the default phone configuration from being mistaken for a tvOS project.
Switching back from `mobile:prebuild` requires a clean TV prebuild.

The Windows development workspace does not contain a generated `apps/tv/ios` project. Until the macOS command exits successfully and an identified simulator/device is exercised, report **configured for tvOS; build and runtime unverified**.

## Required native QA

- Siri Remote focus, select, Menu/Back, and Play/Pause.
- Local `expo-video` playback, pause/resume, containment, audio, and errors.
- Safe-area behavior at 1080p and 4K simulator/device settings.
- Cold launch, background/foreground, memory pressure, and a physical Apple TV before distribution.
- Any future HLS, subtitle, alternate-audio, caching, or signed-token flow.

Web/Playwright results do not substitute for these checks. That includes the iPhone Safari LAN
preview: it is React Native Web evidence, not tvOS or native iPhone evidence.

## Signing and distribution gaps

No Apple Developer team, App Store Connect record, tvOS provisioning profile, EAS project, icons/top-shelf assets, privacy metadata, or release automation is configured. Expo documents that tvOS can reuse an iOS-family bundle ID and distribution certificate, but requires a separate tvOS provisioning profile. EAS cannot create that profile automatically; create it in the Apple Developer portal and supply it deliberately.

There is no `eas.json`. Cloud EAS could be added later with an Expo account, reviewed profile, and explicit authorization. Local EAS Build is unsupported on Windows, and Windows still cannot locally build or simulate tvOS.

Official references: [Expo TV](https://docs.expo.dev/guides/building-for-tv/), [Expo iOS Simulator](https://docs.expo.dev/workflow/ios-simulator/), [Expo local builds](https://docs.expo.dev/build-reference/local-builds/), and [Apple Xcode support](https://developer.apple.com/support/xcode/).
