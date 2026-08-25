# Asset status

## Production branding source

The tvOS asset catalog is structurally complete and uses the official repository-root
`lelibrambas-studios.png` image as its visual source:

- layered small app icon at 400 x 240 and 800 x 480;
- layered App Store icon at 1280 x 768;
- Top Shelf artwork at 1920 x 720 and 3840 x 1440;
- wide Top Shelf artwork at 2320 x 720 and 4640 x 1440;
- launch and accent colors;
- the exact web navigation cinema mark as a template vector.

Each image-stack layer has its own `Content.imageset`, and the referenced raster dimensions match the tvOS asset-catalog roles. Background and Top Shelf PNGs are opaque; foreground and middle icon layers retain transparency so the required layered structure remains valid. The background layer carries the official flattened artwork; the transparent upper layers intentionally provide minimal parallax. `AssetSources/README.md` records provenance without duplicating or altering the root source.

## Release gate

The checked-in icon and Top Shelf imagery is the requested production branding. Before signing a distribution archive, the owner must still review the focused icon and Top Shelf crops on real Apple TV hardware or Simulator and confirm distribution rights. Preserve the existing asset names, roles, dimensions, layer order, and alpha requirements.

Do not use private family photographs, media frames, personal filenames, or other archive content as app-icon or Top Shelf artwork. Xcode's asset compiler and App Store Connect must validate the current production assets on the rented Mac.

## Screenshot status

No App Store screenshot is claimed as final from this Windows host. The deterministic Debug fixture states and `Scripts/capture-app-store-screenshots.sh` produce dimension-checked, opaque 1920 x 1080 or 3840 x 2160 captures on a tvOS simulator. Final screenshots must be reviewed with the approved artwork visible before upload.
