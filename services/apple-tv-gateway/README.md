# LeliBrambas+ Apple TV gateway

This is an additive, isolated Cloudflare Worker for native tvOS authentication. It exists because the current viewer is protected by browser-based Cloudflare Access and a native Apple TV must not embed an Access service token or reuse a browser cookie.

Nothing in this directory is deployed automatically. The checked-in Wrangler configuration has no public route, disables `workers.dev`, uses a synthetic D1 identifier, and contains no production URL, account identifier, email address, or secret.

## Runtime contract

| Method        | Path                                          | Authentication                                         | Purpose                                                            |
| ------------- | --------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| `POST`        | `/v1/device/authorizations`                   | Rate limited                                           | Create a ten-minute device challenge                               |
| `GET`         | `/v1/device/authorizations/{device_code}`     | Opaque device code + throttling                        | Poll pending/approved/denied/expired state; returns a session once |
| `GET`, `POST` | `/activate`                                   | Cloudflare Access JWT + hashed email allow-list + CSRF | Human approval or denial page                                      |
| `GET`         | `/v1/catalog`                                 | Bearer session                                         | Return the sanitized tvOS catalog and signed artwork links         |
| `POST`        | `/v1/media/{integer_id}/playback`             | Bearer session                                         | Return one allow-listed HLS/MP4 playback URL                       |
| `GET`         | `/v1/artwork/{integer_id}/{poster\|backdrop}` | Short-lived HMAC URL                                   | Stream only artwork already referenced by the catalog              |
| `POST`        | `/v1/sessions/refresh`                        | Bearer session                                         | Atomically rotate a session token                                  |
| `DELETE`      | `/v1/sessions/current`                        | Bearer session                                         | Revoke the current session                                         |
| `GET`         | `/health`                                     | Public                                                 | Non-sensitive health response                                      |

Every API response uses a `{ "data": ... }` envelope or a safe `{ "error": ... }` envelope. Responses containing authentication state are `no-store`.

## Local validation

The dependency versions intentionally match versions already present in the repository's frozen root `yarn.lock`. To use the gateway's own npm lock without asking npm to operate on the parent Yarn workspace, always disable workspace discovery:

```powershell
cd services\apple-tv-gateway
npm ci --workspaces=false
npm run types --workspaces=false
npm run check --workspaces=false
```

Do not run a bare `npm install` from this directory. The repository root declares `services/*` as Yarn workspaces. The checked-in `package-lock.json` is generated and validated from an external copy so the root lockfile remains untouched.

For local Worker execution, copy `.dev.vars.example` to `.dev.vars`, use synthetic local values, and apply the local D1 migration:

```powershell
npm run migrate:local --workspaces=false
npm run dev --workspaces=false
```

Local placeholders deliberately fail the production configuration guard. Unit tests inject synthetic dependencies and never call production.

## Design boundary

- The gateway does not change or depend on source files in the web, Windows, or existing API applications.
- Raw device codes, user codes, session tokens, email addresses, IP addresses, and upstream credentials are never written to D1.
- The upstream origin and catalog path are deployment secrets. Client input never selects a URL.
- Catalog entries are sanitized. Direct stream identifiers are removed before the catalog reaches tvOS.
- Artwork is resolved again by numeric catalog ID after an HMAC is verified; a signed URL cannot select an arbitrary origin path.
- Playback hosts must match `ALLOWED_MEDIA_HOST_SUFFIXES`. A hostname suffix is matched on a DNS label boundary.

See [Docs/SECURITY.md](Docs/SECURITY.md), [Docs/INTEGRATION.md](Docs/INTEGRATION.md), and [Docs/DEPLOYMENT_WINDOWS.md](Docs/DEPLOYMENT_WINDOWS.md) before provisioning anything.
