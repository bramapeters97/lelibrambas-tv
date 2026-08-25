# Apple TV production branding

The tvOS icon, App Store icon, Top Shelf imagery, and Home hero use the official repository-root
`lelibrambas-studios.png` source. The source is not modified. Size-correct center crops are committed
inside the existing Apple TV brand asset catalog:

- layered app icon: `400 x 240` at 1x and `800 x 480` at 2x;
- layered App Store icon: `1280 x 768`;
- Top Shelf image: `1920 x 720` at 1x and `3840 x 1440` at 2x;
- wide Top Shelf image: `2320 x 720` at 1x and `4640 x 1440` at 2x.

Background layers and Top Shelf images are opaque. Middle and foreground icon layers are transparent,
preserving Apple's layered asset structure without overlaying substitute branding. The in-app
`WebNavigationMark` is the exact vector path used by the existing web viewer's navigation rail.

Review focus masking and Top Shelf crops in the Apple TV Simulator before App Store submission. The
larger Top Shelf exports necessarily upscale the 1536 x 1024 official source.
