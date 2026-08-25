# Configuration

Tracked configuration contains no secrets. `Config/Base.xcconfig`, `Debug.xcconfig`, and `Release.xcconfig` define stable build policy. Templates describe the local values that a release operator supplies:

| Local value                                            | Purpose                                 | Allowed in Git?                           |
| ------------------------------------------------------ | --------------------------------------- | ----------------------------------------- |
| `DEVELOPMENT_TEAM`                                     | Apple signing team selected in Xcode    | No                                        |
| `API_BASE_URL` / `APPLE_TV_API_BASE_URL`               | Deployed HTTPS Apple TV gateway         | Production URL: no, per repository policy |
| `ACTIVATION_BASE_URL` / `APPLE_TV_ACTIVATION_BASE_URL` | HTTPS page users open to approve the TV | Production URL: no, per repository policy |
| signing certificate/profile                            | Managed by Xcode and the user’s login   | Never                                     |
| App Store Connect credentials/API keys                 | Upload authorization                    | Never                                     |

`bootstrap-mac.sh` copies each `.example` to its ignored local filename only if that local file does not already exist. It never fills or overwrites values.

For a signed archive, prefer ephemeral shell values so the rented Mac retains less information. A completed ignored `Config/Secrets.xcconfig` is also supported when local policy requires it:

```bash
export APPLE_DEVELOPMENT_TEAM="REPLACE_WITH_TEAM_ID"
export APPLE_TV_API_BASE_URL="https://REPLACE_WITH_GATEWAY_HOST"
export APPLE_TV_ACTIVATION_BASE_URL="https://REPLACE_WITH_ACTIVATION_HOST"
./Scripts/archive.sh --version 1.0.0 --build-number 1
```

The archive script validates HTTPS, rejects localhost and placeholder domains, rejects fixture/debug/reviewer compilation conditions, and refuses to overwrite an existing archive. Debug fixture arguments are compile-time guarded and unavailable in Release.
