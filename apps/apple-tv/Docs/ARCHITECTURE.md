# Native Apple TV architecture

The Apple TV target is an isolated SwiftUI application. `TVApp` owns the 10-foot interface and tvOS focus behavior. `Packages/LeliBrambasCore` owns reusable catalogue models, organization, redaction helpers, and media URL resolution.

```text
App launch -> bundled native ident and jingle -> local profile selector -> bundled media_catalog.json -> AppModel -> SwiftUI Home
Movie selection -> item.stream_video_id -> PlaybackURLResolver -> AVPlayerViewController
Poster path -> bundled artwork/ resource -> 16:9 native card -> UIImage
```

The native ident mirrors the web viewer's 18-light, logo, title, and subtitle sequence, plays the same bundled jingle once on cold launch and once after every genuine background-to-active return, and advances safely even if audio playback is unavailable. Entering the background cancels the active ident sequence; returning active recreates it, clears the local profile, and requires the three-profile selector again. A transient inactive state only silences audio and does not reset the flow. The three-profile selector is local presentation state only. There is no tvOS gateway, activation, account, remote session, token, Keychain credential, API catalogue call, or web view. Playback uses `AVPlayer`/`AVPlayerViewController`, so transport controls, +/-10-second seeking, audio selection, and fullscreen behavior remain native to tvOS. Cloudflare Stream watch/iframe URLs are converted locally to their HLS manifest URL; direct HTTPS HLS and MP4 remain supported. The Home hero mirrors the web viewer's two-second/40-second muted ambient trailer. Detail previews independently wait one second and seek safely toward 120 seconds. Neither preview mode changes full playback, which always starts from the beginning.

`project.yml` is the source of truth for `LeliBrambasTV.xcodeproj`. Release bundles the tracked `../../data/media_catalog.json` file, `../../artwork/` directory, read-only `../../lelibrambas-studios.png` brand source, and a byte-identical copy of the existing web ident jingle as the `LaunchJingle` Apple data asset. Debug permits synthetic fixture catalogue content only through compile-time-guarded test and screenshot launch arguments.
