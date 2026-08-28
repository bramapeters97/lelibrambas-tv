# ADR 0001: Expo SDK 57 iPhone and tvOS stack

Status: accepted, 17 August 2026.

## Decision

Pin the Expo app to this exact set:

| Package                                     | Exact version                    | Role/status                                                                     |
| ------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| `expo`                                      | `57.0.13`                        | SDK/runtime; intentionally newer than the critical `57.0.9` fix.                |
| `react`, `react-dom`                        | `19.2.3`                         | SDK 57 compatible React; DOM powers the rich web preview.                       |
| `react-native`                              | `npm:react-native-tvos@0.86.2-0` | RN 0.86.2-compatible fork retained solely for the native tvOS target.           |
| `react-native-web`                          | `0.21.2`                         | Phone Safari preview; the rich viewer remains direct React DOM.                 |
| `expo-video`                                | `57.0.2`                         | Bundled native tvOS/iPhone playback; also rendered by the phone web preview.    |
| `expo-image`                                | `57.0.3`                         | tvOS-capable image package, compatibility-pinned but not yet used by the shell. |
| `react-native-reanimated`                   | `4.5.1`                          | SDK 57 tvOS-capable animation package; not yet used by the shell.               |
| `react-native-worklets`                     | `0.10.1`                         | Required Reanimated generation.                                                 |
| `@react-native-async-storage/async-storage` | `2.2.0`                          | Native device persistence dependency.                                           |
| `@react-native-tvos/config-tv`              | `0.1.6`                          | CNG target switch between tvOS and iPhone generation.                           |

Use Yarn Classic `1.22.22` through Corepack with one frozen lockfile. Use Node 24 LTS; Expo SDK 57's compatibility table requires Node 22.13.x or newer, and both `package.json` and project setup accept Node 22.13 or newer through Node 24.

## Evidence and rationale

Expo's current compatibility table maps SDK 57 to React Native 0.86, React 19.2.3, React Native Web 0.21.0, React Native TV `0.86-stable`, and Node 22.13.x. React Native TV publishes the matching 0.86 line as the `react-native` alias; exact `0.86.2-0` avoids an unreviewed floating stable tag. This repository retains that shared upstream fork only for tvOS; native application targets are limited to iPhone and tvOS.

React Native TV strongly recommends [Yarn](https://classic.yarnpkg.com/) and warns against global React Native installs. Corepack plus the exact Yarn Classic pin keeps the monorepo on one deterministic workspace lockfile without a global `react-native` or `react-native-tvos` CLI.

Expo's 13 August SDK 57 update says `expo@57.0.9` moved to React Native 0.86.2 and fixed the Hermes V1 memory regression affecting Worklets/Reanimated imports. `57.0.13` retains that fix. Expo's SDK 57 module map supports the selected Expo package generations.

The Expo TV guide lists AsyncStorage, Image, Reanimated, and Video as TV-capable and explains the React Native TV alias, config plugin, clean prebuild, Apple TV commands, and separate tvOS provisioning profile. `expo-video`'s SDK 57 page supports tvOS and web and recommends `~57.0.2`.

## Rendering and navigation

`apps/tv/App.tsx` dispatches on `Platform.isTV`. Its tvOS branch uses `Pressable`,
`TVFocusGuideView`, `useTVEventHandler`, explicit screen state, and `expo-video`; it remains a small
profile/home/player shell while native focus and playback are validated. Its phone branch renders
`apps/tv/mobile/MobileApp.tsx`, with profile selection, Home, Search, Collections, Saved, catalogue
details, and a bundled demo player.

The full product prototype is a separate React DOM/Vite SPA used by browser QA, Playwright,
screenshots, and Electron. React Native Web renders the Expo phone branch in its Safari preview but
does not render that rich SPA. Safari is web evidence, not native iOS evidence. A browser, phone, or
tvOS pass does not establish parity with another surface; no such parity is currently claimed.

No Expo Router or React Navigation dependency is installed. Explicit state is adequate for the
current native flows. Expo lists React Navigation as compatible with tvOS, so it is the preferred
first evaluation if native flows outgrow explicit state. The Expo `with-router-tv` example is
reference material, not a dependency manifest to copy blindly.

`apps/tv/app.config.ts` derives the Apple target from `EXPO_TV`: `1`/`true` produces the tvOS plugin
target and landscape orientation; other values produce the iPhone target and default orientation.
The root `tv:prebuild` and workspace `tvos` commands explicitly set `EXPO_TV=1`. The mobile
development, prebuild, and iOS scripts explicitly set `EXPO_TV=0`. Both prebuild paths generate iOS
content only, and CNG output must be regenerated cleanly when changing Apple targets.

## Platform constraints

- The config plugin sets a tvOS deployment target of 17.0. Xcode/tvOS Simulator and signing require a Mac.
- `corepack yarn dev:mobile` provides a LAN Expo web preview for iPhone Safari. It is not an iOS
  binary and cannot validate native `expo-video`, lifecycle, safe areas, signing, or installation.
- The App Store Expo Go available to a physical iPhone currently supports SDK 54, so its QR route
  cannot load this SDK 57 project. A compatible native iPhone build requires Xcode on a Mac or a
  separately approved EAS/signing/source-upload workflow.
- Windows local EAS Build is unsupported. Native iPhone and tvOS local builds remain Mac-only.
- Expo Go is not this project's native runtime and `expo-dev-client` is not installed.

## Upgrade policy

Do not independently upgrade Expo, React Native TV, React, Expo modules, Reanimated, or Worklets.
Treat them as one compatibility set: review the new Expo matrix/changelog and React Native TV
stable branch, update exact pins/lockfile, regenerate the iOS project, and rerun phone web, native
iPhone, and tvOS checks. Test playback features on each target rather than inferring
them from package badges or another surface.

## Primary sources

- [Expo SDK compatibility table](https://docs.expo.dev/versions/latest/)
- [Expo SDK 57 release and 57.0.9 regression fix](https://expo.dev/changelog/sdk-57)
- [Expo TV guide](https://docs.expo.dev/guides/building-for-tv/)
- [Expo development-build FAQ](https://docs.expo.dev/develop/development-builds/faq/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo physical-iPhone EAS guide](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/)
- [Expo SDK 57 bundled native modules](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json)
- [Expo Video for SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/video/)
- [Expo Image for SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/image/)
- [Expo Reanimated for SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/)
- [React Native TV repository](https://github.com/react-native-tvos/react-native-tvos)
- [React Native TV config plugin](https://github.com/react-native-tvos/config-tv/tree/main/packages/config-tv)
- [Expo local EAS Build limitations](https://docs.expo.dev/build-reference/local-builds/)
