# Configuration

Tracked configuration contains no secrets. `Config/Base.xcconfig`, `Debug.xcconfig`, and `Release.xcconfig` define stable build policy. `MoviesAPIConfiguration.defaultURL` contains the public production catalogue endpoint; Debug and tests may override it with `LELIBRAMBAS_MOVIES_API_URL`. Release ignores that process override. The tvOS app needs no gateway, activation, account, session, token, or secret endpoint configuration.

| Local value                        | Purpose                               | Allowed in Git? |
| ---------------------------------- | ------------------------------------- | --------------- |
| `DEVELOPMENT_TEAM`                 | Apple signing team selected in Xcode  | No              |
| signing certificate/profile        | Managed by Xcode and the user’s login | Never           |
| App Store Connect credentials/keys | Upload authorization                  | Never           |

`bootstrap-mac.sh` copies `Signing.xcconfig.example` to its ignored local filename only when that file is absent. It never fills or overwrites values.

For a signed archive:

```bash
export APPLE_DEVELOPMENT_TEAM="REPLACE_WITH_TEAM_ID"
./Scripts/archive.sh --version 1.0.0 --build-number 1
```

Release uses only `MoviesAPIConfiguration.defaultURL` for its catalogue and accepts poster artwork only from absolute HTTPS `poster_url` values. It bundles no catalogue JSON, local poster directory, alternate endpoint, or offline catalogue fallback. The archive script rejects fixture/debug/reviewer compilation conditions, validates this API-only resource policy, and refuses to overwrite an existing archive.
