# Windows deployment runbook (manual approval gate)

These steps provision only the new Apple TV gateway. They do not edit or deploy the existing web Worker, API Worker, routes, database, or Windows application. Run them only after the repository owner explicitly authorizes Cloudflare provisioning and deployment.

## 1. Prepare local tooling

Use Node 24 LTS and PowerShell. From a clean clone:

```powershell
cd services\apple-tv-gateway
npm ci --workspaces=false
npx wrangler --version
npm run types --workspaces=false
npm run check --workspaces=false
```

The `--workspaces=false` flag is mandatory because the parent repository uses Yarn workspaces. Confirm the root `yarn.lock` remains unchanged.

## 2. Create a local-only Wrangler configuration

Copy `wrangler.jsonc` to the ignored `wrangler.local.jsonc`. Do not commit it. Leave `workers_dev` and `preview_urls` disabled. Later, add only the intended custom domain route to this local file.

```powershell
Copy-Item -LiteralPath .\wrangler.jsonc -Destination .\wrangler.local.jsonc
npx wrangler login
npx wrangler d1 create lelibrambas-apple-tv-gateway-auth
```

Copy the returned D1 `database_id` into `wrangler.local.jsonc`. This is the only database used by the gateway. Do not point the binding at an existing production database.

Add a custom-domain route in the local file only after DNS ownership is confirmed, for example using the deployment's real gateway host. Do not route the existing application hostname to this Worker.

## 3. Configure Cloudflare Access

Create a self-hosted Access application covering only the gateway activation path, equivalent to:

```text
gateway-host.example/activate*
```

Use the existing authorized-email policy. Do not protect `/v1/device/*`, `/v1/catalog`, `/v1/media/*`, or `/v1/artwork/*` with browser Access because Apple TV cannot complete that browser-cookie flow.

Record the Access team HTTPS origin and the new application's audience tag. The Worker validates both values and the live JWKS independently.

Create a Cloudflare Access service token that can read only the existing upstream origin. Keep its client ID/secret outside Git and configure a Service Auth policy for that upstream. Do not reuse an administrator API token if a narrower service token is possible.

## 4. Set Worker secrets

Each command prompts securely. Use the local config explicitly:

```powershell
npx wrangler secret put PUBLIC_ORIGIN --config .\wrangler.local.jsonc
npx wrangler secret put UPSTREAM_ORIGIN --config .\wrangler.local.jsonc
npx wrangler secret put UPSTREAM_CATALOG_PATH --config .\wrangler.local.jsonc
npx wrangler secret put ACCESS_TEAM_DOMAIN --config .\wrangler.local.jsonc
npx wrangler secret put ACCESS_AUD --config .\wrangler.local.jsonc
npx wrangler secret put UPSTREAM_ACCESS_CLIENT_ID --config .\wrangler.local.jsonc
npx wrangler secret put UPSTREAM_ACCESS_CLIENT_SECRET --config .\wrangler.local.jsonc
npx wrangler secret put ARTWORK_SIGNING_KEY --config .\wrangler.local.jsonc
npx wrangler secret put ALLOWED_EMAIL_SHA256 --config .\wrangler.local.jsonc
```

For `ALLOWED_EMAIL_SHA256`, normalize each allowed address by trimming and lowercasing it, SHA-256 hash its UTF-8 bytes, encode lowercase hex, and join multiple digests with commas. Do not paste the plaintext list into source control or Wrangler variables.

Generate `ARTWORK_SIGNING_KEY` from at least 32 cryptographically random bytes. Do not reuse a password or any Access credential.

`PUBLIC_ORIGIN`, `UPSTREAM_ORIGIN`, and `ACCESS_TEAM_DOMAIN` must be HTTPS origins without paths. `UPSTREAM_CATALOG_PATH` must be the one absolute catalog path. Set `ALLOWED_MEDIA_HOST_SUFFIXES` in the local Wrangler file to only the actual media delivery domain suffixes required by the catalog.

## 5. Validate, migrate, then deploy

First perform a side-effect-free bundle validation:

```powershell
npx wrangler deploy --dry-run --config .\wrangler.local.jsonc --outdir .\dist
```

After owner approval for the remote database mutation:

```powershell
npx wrangler d1 migrations apply lelibrambas-apple-tv-gateway-auth --remote --config .\wrangler.local.jsonc
```

After a separate owner approval for deployment:

```powershell
npx wrangler deploy --config .\wrangler.local.jsonc
```

No command in this repository runs either remote step automatically.

## 6. Post-deployment checks

1. Confirm `/health` returns only the service name and `ok`.
2. Confirm `/activate` redirects unauthenticated browsers into Cloudflare Access.
3. Confirm a valid Access session reaches the activation form.
4. Confirm an unlisted email is blocked by both the Access policy and Worker hash list.
5. Create a device challenge and approve it; verify the second token exchange fails.
6. Verify catalog artwork, HLS playback, token refresh, expiry, logout, and rate-limit responses.
7. Confirm logs contain no codes, tokens, emails, IPs, assertions, or signed media URLs.
8. Put the final gateway origin and activation origin only in the Apple app's local release configuration; do not commit production values.
