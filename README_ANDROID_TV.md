# Android TV development

A supported Windows x64 host can build and run the TV branch selected by `apps/tv/App.tsx`. The
current Windows Arm64 workspace verified project generation and configuration only; it does not
establish an emulator or APK result. The richer `apps/tv/src/` viewer is React DOM and is not what
`expo run:android` installs.

`App.tsx` dispatches on `Platform.isTV`. TV builds render the smaller profile/home/player shell;
phone builds render `apps/tv/mobile/MobileApp.tsx`, with profile, Home, Search, Collections, Saved,
catalogue details, and demo-player flows. These surfaces share data and intent, but no feature
parity is claimed.

## Pinned native stack

The project pins Expo `57.0.13`, React `19.2.3`, `react-native-tvos` `0.86.2-0`, `expo-video` `57.0.2`, `expo-image` `57.0.3`, Reanimated `4.5.1`, Worklets `0.10.1`, AsyncStorage `2.2.0`, and the TV config plugin `0.1.6`. See [ADR 0001](docs/decisions/0001-tv-stack.md).

Expo's SDK 57 matrix maps to React Native 0.86, React Native TV `0.86-stable`, React 19.2.3, and Node 22.13+. SDK 57 uses the Android 16/API 36 toolchain; React Native TV 0.86 supports Android API 24 and newer. The dedicated application ID is `studios.lelibrambas.plus`.

## Install Android Studio and API 36

1. Install [Android Studio](https://developer.android.com/studio/install.html) on Windows x64 and enable hardware virtualization.
2. Install Microsoft OpenJDK 17 or use Android Studio's compatible bundled JetBrains Runtime. Android Gradle Plugin 8.x requires Java 17; see [Android's JDK guide](https://developer.android.com/build/jdks).
3. In **SDK Manager**, install Android 16 (`API 36`), SDK Platform 36, Build-Tools 36.x, Platform-Tools, Command-line Tools, and Android Emulator.
4. In API 36 package details, install an **Android TV** or **Google TV** x86_64 system image. Expo permits TV images API 31 or newer; API 36 aligns the emulator with this SDK's toolchain.
5. In **Device Manager**, create a television AVD using that image and start it.

Google's current Android Studio Windows requirements do not support Windows Arm hosts. On such a machine, project generation may still be inspected, but emulator and debug-build validation must move to a supported x64 Windows, macOS, or Linux host.

Set the default SDK path in the current PowerShell session:

```powershell
$leliAndroidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:ANDROID_HOME = $leliAndroidSdk
$env:Path = "$leliAndroidSdk\platform-tools;$leliAndroidSdk\emulator;$env:Path"
adb --version
adb devices
```

Persist `ANDROID_HOME` and those two path entries as Windows user environment variables, then reopen PowerShell. Prefer the Windows-hosted SDK/emulator rather than mixing WSL Node with Windows ADB.

## Generate and run

With the TV AVD running:

```powershell
corepack yarn tv:prebuild
corepack yarn android:tv
```

`app.config.ts` switches target and orientation from `EXPO_TV`: `1`/`true` selects TV and
landscape; other values select phone and the default orientation. It also enables the New
Architecture and requests Flipper removal. The root `tv:prebuild` and `android:tv` scripts reach
workspace scripts that explicitly set `EXPO_TV=1`. Prebuild regenerates ignored native projects
from config; do not hand-maintain `apps/tv/android/`. A deliberate clean equivalent is:

```powershell
corepack yarn workspace @lelibrambas/tv prebuild:tv
corepack yarn workspace @lelibrambas/tv android:tv
```

`expo run:android` builds, installs, and starts Metro. A successful debug build normally leaves `apps/tv/android/app/build/outputs/apk/debug/app-debug.apk`; it is not a signed Play Store bundle.

Build that APK without installing it:

```powershell
Push-Location .\apps\tv\android
.\gradlew.bat assembleDebug
Pop-Location
```

Do not claim success unless Gradle exits 0 and this exact file exists:

```text
apps\tv\android\app\build\outputs\apk\debug\app-debug.apk
```

Expo Go is not the target, and `expo-dev-client` is not installed. Rebuild after native dependency/config changes; JavaScript-only changes can use Metro once the binary is installed.

The iPhone Safari LAN preview uses the phone branch through React Native Web. Passing that preview
is neither Android TV nor native iPhone evidence and cannot establish parity with this TV shell.

## Native QA

- D-pad focus remains visible across profiles and the Play action.
- Select and Back/Menu work; Play/Pause controls the bundled synthetic MP4.
- `contain` preserves original aspect ratio rather than stretching 4:3 media.
- Text stays within TV-safe margins at living-room distance.
- Generated manifest includes TV launcher intent/category.

The TV branch does not reproduce the rich web viewer's discovery screens, catalogue rails,
watchlist, full overlay, or Cloudflare playback. The separate phone branch has mobile-specific
Search, Collections, and Saved flows, but those do not add features to the TV branch. `expo-image`
and Reanimated are compatibility-pinned but not imported by the shell. Subtitle/audio-track
behavior and hardware playback require device testing.

Web Playwright and Electron results do not substitute for D-pad/Siri-style focus, native `expo-video`, TV launcher, install, or back/menu testing.

## Distribution gaps

No release keystore, TV banner/icon, Play listing, privacy declaration, EAS project, or release pipeline exists. Add and review them before creating a signed AAB. Windows local EAS Build is not officially supported; use `expo run:android` locally. Cloud EAS would be a separate configuration and authorization.

Official references: [Expo TV](https://docs.expo.dev/guides/building-for-tv/), [Expo Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/), [Android TV setup](https://developer.android.com/training/tv/get-started/create), and [Expo local-build limits](https://docs.expo.dev/build-reference/local-builds/).
