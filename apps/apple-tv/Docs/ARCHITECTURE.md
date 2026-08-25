# Native Apple TV architecture

The Apple TV target is an isolated SwiftUI application. `TVApp` owns the 10-foot interface and tvOS focus behavior. `Packages/LeliBrambasCore` owns reusable catalogue models, organization, redaction helpers, and media URL resolution.

```text
App launch -> bundled media_catalog.json -> local profile selector -> AppModel -> SwiftUI Home
Movie selection -> item.stream_video_id -> PlaybackURLResolver -> AVPlayerViewController
Poster path -> bundled artwork/ resource -> 16:9 native card -> UIImage
```

The three-profile selector is session-local presentation state only. There is no tvOS gateway, activation, account, remote session, token, Keychain credential, API catalogue call, or web view. Playback uses `AVPlayer`/`AVPlayerViewController`, so transport controls, +/-10-second seeking, audio selection, and fullscreen behavior remain native to tvOS. Cloudflare Stream watch/iframe URLs are converted locally to their HLS manifest URL; direct HTTPS HLS and MP4 remain supported. The Home hero mirrors the web viewer's two-second/40-second muted ambient trailer. Detail previews independently wait one second and seek safely toward 120 seconds. Neither preview mode changes full playback, which always starts from the beginning.

`project.yml` is the source of truth for `LeliBrambasTV.xcodeproj`. Release bundles the tracked `../../data/media_catalog.json` file, `../../artwork/` directory, and read-only `../../lelibrambas-studios.png` brand source. Debug permits synthetic fixture catalogue content only through compile-time-guarded test and screenshot launch arguments.
