# Security model

## Trust boundaries

The Apple TV is an untrusted public client. It receives only a one-time device code, a short-lived display code, and an app-specific bearer session after a human approves the request. It never receives Cloudflare Access service credentials, the Access assertion used by the browser, the artwork signing key, or an upstream administrative token.

The `/activate` path must be covered by a Cloudflare Access self-hosted application. The Worker still verifies the `Cf-Access-Jwt-Assertion` itself: RS256 signature, matching `kid` from the team's live JWKS, issuer, audience, token type, expiry/not-before/issued-at bounds, email claim, and a second hashed email allow-list. It does not trust `Cf-Access-Authenticated-User-Email` by itself.

The device API paths must remain reachable by tvOS and therefore must not be placed behind browser Cloudflare Access. They are protected by high-entropy codes, one-time exchange, D1-backed rate limits, per-device poll throttling, short expiry, and scoped sessions.

## Secrets and data at rest

D1 stores:

- SHA-256 digests of device codes and user codes;
- SHA-256 digests of bearer session tokens;
- SHA-256 identity digests and a masked email hint;
- hashed rate-limit keys, never source IP addresses;
- device display names, state, and timestamps.

Raw session tokens are created only in request memory. Approval stores identity state but no session token. The first eligible poll atomically inserts the new token digest and consumes the authorization in one D1 batch. A replay cannot retrieve another raw token. Session rotation atomically inserts a replacement digest and revokes the old digest.

Set these with `wrangler secret put`; never commit them:

- `PUBLIC_ORIGIN`
- `UPSTREAM_ORIGIN`
- `UPSTREAM_CATALOG_PATH`
- `ACCESS_TEAM_DOMAIN`
- `ACCESS_AUD`
- `ALLOWED_EMAIL_SHA256`
- `UPSTREAM_ACCESS_CLIENT_ID`
- `UPSTREAM_ACCESS_CLIENT_SECRET`
- `ARTWORK_SIGNING_KEY`

`ALLOWED_EMAIL_SHA256` is a comma-separated list of lowercase SHA-256 hex digests of trimmed, lowercased addresses. Keeping both the Cloudflare Access policy and this Worker list aligned provides defense in depth.

## Proxy restrictions

The service is not a generic proxy:

- the catalog request always targets one configured HTTPS origin and one configured path;
- upstream redirects are rejected;
- upstream catalog and playback JSON are size bounded before parsing;
- artwork must be referenced by the current catalog, stay on the configured upstream origin, and have a valid expiring HMAC;
- playback is selected by an integer catalog ID, never a caller-provided URL;
- playback hosts are constrained to configured DNS suffixes and only HTTPS HLS/MP4 URLs are returned;
- response headers that could leak upstream cookies or credentials are not forwarded.

## Abuse controls

D1 implements atomic fixed-window limits for challenge creation, polling, activation, catalog, playback, artwork, and token rotation. Device polling also updates `last_poll_at` conditionally and returns `429 SLOW_DOWN` with `Retry-After` when a client polls early. Display codes use eight characters from a 32-character unambiguous alphabet (40 bits) and expire after ten minutes by default.

The activation form uses a secure, host-only, HTTP-only, SameSite Strict CSRF cookie and a matching hidden form value. The page has a restrictive CSP, no JavaScript, no third-party resources, no referrer, and cannot be framed.

## Logging

Structured logs include only request ID, HTTP method, route path, and error class. They never include authorization headers, assertions, codes, tokens, full email addresses, service-token values, signed playback URLs, response bodies, or client IP addresses.

## Operational rotation

- Rotate the artwork HMAC key to invalidate all outstanding artwork URLs.
- Rotate upstream Access service credentials through Cloudflare and update Worker secrets together.
- Update the Access team domain/audience only when the Access application changes.
- App sessions expire after at most 30 days by configuration. `/v1/sessions/refresh` rotates them early; `/v1/sessions/current` revokes them.
- To invalidate all app sessions after an incident, revoke rows in D1 through an audited operator procedure or replace the D1 database. No admin mutation endpoint is exposed.
