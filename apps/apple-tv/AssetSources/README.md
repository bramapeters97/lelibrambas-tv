# Apple TV brand source

The tvOS app icon, App Store icon, hero, and Top Shelf exports use the repository-root
`lelibrambas-studios.png` as their official source. The root image is intentionally read-only.

The committed PNGs in `TVApp/Assets.xcassets/App Icon & Top Shelf Image.brandassets/` are
center-cropped, size-correct exports of that source. Background layers are opaque; middle and
foreground layers are transparent so the valid Apple TV layered icon structure remains intact
without adding substitute artwork.

The in-app navigation mark is a vector copy of the existing web viewer's `CinemaIcon` path and is
stored in `TVApp/Assets.xcassets/WebNavigationMark.imageset/`.
