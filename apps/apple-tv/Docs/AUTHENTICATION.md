# Authentication contract

The website’s Cloudflare Access browser cookie cannot be safely copied into a native tvOS app. The Apple TV app therefore uses an isolated device-code gateway while preserving the same allowlisted-access intent.

1. Apple TV requests a short-lived device authorization.
2. The gateway returns an opaque device code, a human-entered code, an expiry, polling interval, and HTTPS verification URL.
3. The TV displays the code and a locally generated QR representation of the verification URL.
4. The user opens the URL on a separate authenticated browser and approves or denies the TV.
5. Apple TV polls no faster than the server-provided interval.
6. Approval returns a scoped, expiring app session; denial and expiry fail closed.
7. The session record is stored with Keychain Services using this-device-only accessibility.
8. `401`/expiry clears local state and returns to activation.

The app does not contain Cloudflare service tokens, allowlisted addresses, passwords, reviewer credentials, or a Release authentication bypass. The isolated gateway is responsible for cryptographically random codes, hashing codes at rest, one-time redemption, expiry, rate limiting, session rotation, and authorization on catalog/playback proxy endpoints.

App Review needs a dedicated reviewer path through the real activation service. Put temporary reviewer instructions and credentials only in App Store Connect review notes, never in source. Revoke them after review.
