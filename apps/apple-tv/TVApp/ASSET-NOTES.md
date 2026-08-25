# Apple TV development artwork

The asset catalog contains synthetic development artwork only. The tvOS brand `Contents.json` files
reference raster PNGs generated from the accompanying text-based SVG sources, providing the required
structures and target dimensions without checking in personal photographs or private media:

- small layered app icon: `400 × 240` at 1x and `800 × 480` at 2x;
- App Store layered app icon: `1280 × 768`;
- Top Shelf image: `1920 × 720` at 1x and `3840 × 1440` at 2x;
- wide Top Shelf image: `2320 × 720` at 1x and `4640 × 1440` at 2x.

The SVG files are editable sources and are deliberately not referenced by the tvOS brand asset
metadata. Before signing or distribution, replace the generated PNGs with approved, flattened/layered
production artwork exported in the exact formats required by the current App Store and Xcode. Keep the
asset names and roles stable so the build configuration does not drift. The generated placeholders
are not release artwork and must never be populated with private family photographs or media frames.
