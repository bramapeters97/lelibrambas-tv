# App Store screenshot plan

Apple currently accepts 1–10 tvOS screenshots at 1920×1080 or 3840×2160 without transparency. Confirm the specification on submission day in [App Store Connect screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications).

Generate deterministic Debug-only fixture screens on a Mac:

```bash
cd apps/apple-tv
./Scripts/capture-app-store-screenshots.sh
```

The script dynamically resolves/boots an Apple TV simulator, builds and installs Debug, launches compile-time-guarded fixture routes, and captures PNGs. Xcode's `pngcrush -reduce` losslessly removes a redundant fully opaque alpha plane when CoreSimulator emits one; a file with real transparency remains alpha-bearing and is rejected. Output must use a native 1920×1080/3840×2160 tvOS size, and the script selects the matching directory from the simulator framebuffer.

It also saves `BuildArtifacts/SimulatorPreview/00-tvos-home.png` before launching the app. That image is internal proof that the app was installed into a real CoreSimulator runtime; it is not an App Store product screenshot and must not be submitted.

| Filename                             | Scene                             | Required review                                               |
| ------------------------------------ | --------------------------------- | ------------------------------------------------------------- |
| `1920x1080/01-profile-selector.png`  | Local three-profile selector      | Exact names/colors, wordmark, and focus visibility            |
| `1920x1080/02-home.png`              | Branded trailer hero/home         | Official studio art, hierarchy, focus, and safe-area crop     |
| `1920x1080/03-content-shelves.png`   | Multiple collection/media shelves | 16:9 crop, spacing, synthetic labels, focus visibility        |
| `1920x1080/04-media-details.png`     | Detail screen                     | Metadata readability, backdrop/gradient, Play action          |
| `1920x1080/05-collections.png`       | Collections feature view          | Four-card grouping, margins, focus order                      |
| `1920x1080/06-settings.png`          | Settings                          | Version, live/fallback content status, focus order             |
| `1920x1080/07-search.png`            | Search                            | Web hierarchy, default field focus, suggestions and grid       |
| `1920x1080/08-full-library.png`      | Full Library                      | Catalogue hierarchy, title count, landscape grid and spacing   |

Before upload:

- inspect at full size on a television-like display;
- confirm every person/image/title is synthetic or explicitly cleared;
- confirm no email, live code, token, signed URL, filesystem path, request details, or debugging UI appears;
- avoid adding slogans/claims over product screenshots;
- compare focus ring, colors, typography, safe areas, and cropping to the shipping build;
- use only the strongest 1–10 images and preserve their unedited capture provenance.

The repository does not generate 4K marketing upscales. A `3840x2160/` candidate is accepted only when the simulator/runtime actually renders at that native size and passes the same opacity validation.
