# iPhone preview and native development

The Expo entry in `apps/tv/App.tsx` selects the tvOS shell when `Platform.isTV` is true and the
phone UI in `apps/tv/mobile/MobileApp.tsx` otherwise. The phone UI currently covers profile
selection, Home, Search, Collections, Saved, catalogue details, and the bundled demo player.

This is a mobile adaptation, not feature parity with the React DOM TV viewer. It uses only the
checked-in synthetic catalogue, artwork, and demo video. Saved-item and profile changes live in
memory for the current session; there is no personal-archive, importer, or cloud connection.

## Test now in iPhone Safari over Wi-Fi

This is the quickest route from the current Windows workspace. It renders the phone branch through
Expo web; it does not install an iOS app.

1. Put the PC and iPhone on the same trusted Wi-Fi network. Avoid guest networks, client isolation,
   VPNs, and public Wi-Fi.
2. From the repository root, start the LAN preview:

   ```powershell
   corepack yarn dev:mobile
   ```

3. Find the numeric LAN host that Metro displays. If the web line says
   `http://localhost:8081`, replace `localhost` with that LAN host while keeping port `8081`. For
   example, a displayed Metro address using `192.168.1.23:8081` becomes
   `http://192.168.1.23:8081` in Safari.
4. Open that HTTP address manually in iPhone Safari and keep the terminal running. If Windows asks,
   allow Node only on **Private networks**. Stop the command when testing is finished.

Do **not** scan the terminal QR code for this project. That QR launches Expo Go, whereas the App
Store build of Expo Go for a physical iPhone currently supports SDK 54 and this repository pins SDK 57. Expo explains the physical-iPhone constraint in its
[development-build FAQ](https://docs.expo.dev/develop/development-builds/faq/). Safari does not use
Expo Go.

Use Safari to review touch targets, responsive layout, navigation, search, session-only Saved
behavior, and basic bundled-video playback. A Safari pass is React Native Web evidence only: it
does not validate native `expo-video`, iOS safe areas, fullscreen transitions, lifecycle behavior,
performance, device installation, or signing, and it does not establish parity with the tvOS or rich
web viewers.

## Build a native app on a Mac with Xcode

Use a Mac supported by the chosen Xcode release, the same repository revision, Node 24 LTS,
Corepack, Yarn `1.22.22`, and an attached iPhone. Apple lists host compatibility on its
[Xcode support page](https://developer.apple.com/support/xcode/).

After `corepack yarn setup`, run from the repository root:

```powershell
corepack yarn mobile:prebuild
corepack yarn workspace @lelibrambas/tv ios:mobile
```

`mobile:prebuild` cleanly regenerates the ignored iOS project with `EXPO_TV=0`. The workspace
command also sets `EXPO_TV=0`, then asks Expo/Xcode to build for a connected device. If Xcode asks
for signing, select an intentional development team and review the bundle identifier before
continuing. Enable iOS Developer Mode only when prompted for this local build; see Expo's
[iOS Developer Mode guide](https://docs.expo.dev/guides/ios-developer-mode/).

The generated `apps/tv/ios/` directory is disposable CNG output and must not be committed as source
of truth. Running the tvOS prebuild later regenerates it for the tvOS target. Record the Mac, Xcode
and iOS versions, command exit status, selected device, and exercised flows before describing the
native app as verified.

## Native iPhone build from Windows with EAS

Windows cannot perform the local Xcode build. Expo's
[development-build overview](https://docs.expo.dev/develop/development-builds/introduction/) and
[physical-iPhone EAS guide](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/)
describe the cloud route, but it is intentionally not configured or invoked here.

That route requires a separate owner approval gate before any work begins because it would add an
Expo/EAS project and build profile, require an Expo account and
[Apple Developer Program](https://developer.apple.com/programs/) signing access, register a device
and credentials, and upload a source snapshot to Expo's builders. The repository also has no
`eas.json` and does not install `expo-dev-client`; both choices need review. Any future EAS profile
must explicitly keep `EXPO_TV=0`, and monorepo commands must use the app directory as documented in
Expo's [monorepo build guide](https://docs.expo.dev/build-reference/build-with-monorepos/).

No EAS command, account link, credential creation, device registration, source upload, or remote
build is authorized by this guide.

## Security and QA boundary

- Use only the repository's fictional fixtures and bundled synthetic media. Do not point the phone
  preview at personal archive paths or add tokens, account IDs, signing material, or production
  URLs.
- The LAN command makes the preview reachable to peers on the local network. Use a trusted private
  network, do not add a tunnel or port-forward, and stop Metro afterward.
- HTTP LAN traffic is not production transport. The preview has no authentication and is not a
  distribution mechanism.
- Test portrait and landscape, small and large iPhone sizes, VoiceOver labels, text input, back and
  fullscreen behavior, audio, interruption/background-resume, and memory pressure in the eventual
  native build.
- Native iPhone, tvOS, Electron, and React DOM results are separate evidence. Passing
  one surface never establishes parity or release readiness for another.
- The shared React Native TV dependency is retained solely for the separate tvOS target.
