# Future iPhone and iPad compatibility

## App Store and bundle strategy

The tvOS app uses `com.lelibrambas.plus`. If Apple confirms that identifier is available and the owner
registers it for the existing or intended App Store Connect record, a later iPhone/iPad platform can be
added to that same record. Do not create a `.tvos` suffix unless an already-registered identifier makes
it unavoidable. Registration and platform addition remain manual Apple-account actions.

## Reusable implementation

`Packages/LeliBrambasCore` is intentionally UI-independent and can be linked by a future native iOS
target. It already contains:

- Codable catalog, media, activation, and session models;
- HTTPS request construction and typed error mapping;
- device-authorization, catalog, session, and playback service protocols;
- Keychain-backed session persistence;
- category grouping, ordering, and featured selection;
- playback URL validation and Cloudflare Stream-to-HLS resolution;
- redacted diagnostics helpers.

The isolated gateway contract can serve both tvOS and a future iOS target. Any future client must keep
the same short-lived activation/session scope and must not embed service credentials.

## Platform-specific UI

The current SwiftUI views are tvOS-specific by design: focus-driven shelves, Siri Remote navigation,
10-foot spacing, Top Shelf assets, and `AVPlayerViewController` transport-bar customization should not
be copied directly to iPhone or iPad. A future mobile target should build its own touch-first navigation,
compact layouts, pointer/keyboard adaptations, and mobile playback presentation while reusing the Core
services and models.

Suggested future structure:

```text
apps/apple-tv/Packages/LeliBrambasCore
        ├── LeliBrambasTV (existing tvOS target)
        └── LeliBrambasMobile (future iOS/iPadOS target)
```

Before adding that target, confirm App Store Connect platform compatibility, provisioning, privacy
answers, supported orientations, device-specific assets, and whether the activation UX should use the
same device-code flow or an approved native sign-in presentation.
