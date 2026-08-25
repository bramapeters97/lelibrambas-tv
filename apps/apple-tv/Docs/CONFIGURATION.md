# Configuration

Tracked configuration contains no secrets. `Config/Base.xcconfig`, `Debug.xcconfig`, and `Release.xcconfig` define stable build policy. The tvOS app needs no gateway, activation, account, session, token, or API endpoint configuration.

| Local value                         | Purpose                              | Allowed in Git? |
| ----------------------------------- | ------------------------------------ | --------------- |
| `DEVELOPMENT_TEAM`                  | Apple signing team selected in Xcode | No              |
| signing certificate/profile         | Managed by Xcode and the user’s login | Never           |
| App Store Connect credentials/keys  | Upload authorization                 | Never           |

`bootstrap-mac.sh` copies `Signing.xcconfig.example` to its ignored local filename only when that file is absent. It never fills or overwrites values.

For a signed archive:

```bash
export APPLE_DEVELOPMENT_TEAM="REPLACE_WITH_TEAM_ID"
./Scripts/archive.sh --version 1.0.0 --build-number 1
```

Release always bundles `../../data/media_catalog.json` and `../../artwork/`. The archive script rejects fixture/debug/reviewer compilation conditions, validates those bundled resources, and refuses to overwrite an existing archive.
