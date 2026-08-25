# Asset status

## Build-ready development assets

The tvOS asset catalog is structurally complete and contains synthetic development artwork only:

- layered small app icon at 400 × 240 and 800 × 480;
- layered App Store icon at 1280 × 768;
- Top Shelf artwork at 1920 × 720 and 3840 × 1440;
- wide Top Shelf artwork at 2320 × 720 and 4640 × 1440;
- launch and accent colors;
- code-native brand mark and wordmark assets.

Each image-stack layer has its own `Content.imageset`, and the referenced raster dimensions match the
tvOS asset-catalog roles. Background and Top Shelf PNGs are opaque; foreground and middle icon layers
retain transparency for parallax. Editable SVG sources sit beside the generated PNGs but are not
referenced by the asset catalog.

## Release gate

The checked-in icon and Top Shelf imagery is explicitly labeled development art. It is suitable for
compilation, tests, and internal screenshots, but it is not final App Store artwork. Before signing a
distribution archive, the owner must replace it with approved production exports while preserving the
existing asset names, roles, dimensions, layer order, and alpha requirements.

Do not use private family photographs, media frames, personal filenames, or other archive content as
app-icon or Top Shelf artwork. Xcode's asset compiler and App Store Connect must validate the final
replacement on the rented Mac.

## Screenshot status

No App Store screenshot is claimed as final from this Windows host. The deterministic Debug fixture
states and `Scripts/capture-app-store-screenshots.sh` are ready to produce dimension-checked, opaque
1920 × 1080 captures on a tvOS simulator. Final screenshots must be reviewed after approved artwork is
installed and before upload.
