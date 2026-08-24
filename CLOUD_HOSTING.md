# Cloud hosting boundary

Nothing in this repository is provisioned or deployed. The Cloudflare code is a production-shaped adapter with placeholder identifiers, unit tests, a D1 migration, and a Wrangler dry-run build. It is not connected to the checked-in viewer or Library Manager.

The rich viewer can use one existing public Cloudflare Stream video as temporary synthetic
playback. Set `VITE_STREAM_PLACEHOLDER_ASSET_ID` and
`VITE_STREAM_PLACEHOLDER_HLS_URL` in an ignored `apps/tv/.env.local` file or as build-time host
variables. Vite exposes both values to every viewer, so use only an intentionally public test asset;
never use credentials or a signed/private URL. Without both values, the checked-in synthetic
catalogue remains visible but safely reports playback as unavailable. Chromium/Electron playback
uses the locally bundled `hls.js`; Safari uses native HLS.

After configuring those public values, `corepack yarn test:stream` builds the production viewer and
confirms that the manifest loads and playback advances in Chromium. It is intentionally separate
from the offline-safe `validate` command because it requires the external test stream.

`apps/tv/public/_headers` supplies a restrictive policy for static platforms that honor the
Cloudflare Pages-style `_headers` file. Other hosts must apply equivalent response headers in their
own configuration; merely uploading the built files does not make a host consume that file.

Build the static viewer from the repository root with `corepack yarn build:web`. The deployable
output is `apps/tv/dist`; the two public Stream variables must be present when that build runs.
The Library Manager is intentionally local-only and must not be published without authentication
and origin controls.

## Intended topology

| Service           | Intended private responsibility                                                                                          | Current repository state                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Worker            | Catalogue/progress/watchlist, device pairing/revocation, signed playback, admin media/artwork operations, Stream webhook | Routes and tests exist; no deploy script or deployed URL.            |
| D1 (`DB`)         | Videos, profiles, progress, watchlists, devices/pairings, media state, webhook receipts                                  | Initial migration/tests exist; config ID is all-zero placeholder.    |
| R2 (`ARTWORK`)    | Approved custom artwork only                                                                                             | Binding/bucket name template exists; no bucket provisioned.          |
| Stream (`STREAM`) | Private video ingest/transcode/delivery                                                                                  | Native binding adapter exists; no assets/customer domain configured. |

Source archives and importer manifests do not belong in Cloudflare. Upload only reviewed viewing copies. R2 is for artwork, not video; Stream assets require signed URLs.

## Actual Worker configuration contract

`services/api/wrangler.jsonc` declares:

- bindings: `DB`, `ARTWORK`, `STREAM`;
- var: `STREAM_DELIVERY_DOMAIN`;
- secrets: `ADMIN_API_TOKEN`, `STREAM_WEBHOOK_SECRET`;
- observability enabled with sampled traces;
- compatibility date `2026-08-17` and `nodejs_compat`.

`.env.example` lists additional provisioning/future-client values. Several are not read by the Worker today. Do not copy it wholesale into a renderer or assume it is an executable deployment config.

## Local validation only

```powershell
corepack yarn workspace @lelibrambas/api generate:types
corepack yarn workspace @lelibrambas/api typecheck
corepack yarn workspace @lelibrambas/api test
corepack yarn workspace @lelibrambas/api build
```

The last command is `wrangler deploy --dry-run`; it writes a bundle under `services/api/dist` and does not publish. `wrangler dev` can exercise supported local bindings on a compatible host, but realistic D1/R2/Stream integration still needs explicit local/remote resource setup.

Wrangler's bundled `workerd` does not support the current Windows Arm64 development host. On that host, type generation and the dry-run bundle are platform-blocked; `services/api/worker-configuration.d.ts` is a clearly labelled fallback snapshot. Repeat generation and the dry run on a Wrangler-supported host before deployment, and do not report the attempted Windows Arm run as successful.

## Deliberate future deployment checklist

Do not perform these steps without authorization and a private Cloudflare account owner present.

1. Choose data residency, retention, backup, deletion, cost limits, and family access/incident policies.
2. Create a private D1 database, artwork R2 bucket, and Stream configuration; replace every placeholder ID/domain.
3. Apply and review `infra/d1/migrations/0001_initial.sql` against a staging database first.
4. Create long random `ADMIN_API_TOKEN` and `STREAM_WEBHOOK_SECRET` values in the reviewed Worker secret flow; never commit them. Cloudflare's current documentation states that `wrangler secret put` creates a new version and deploys it immediately, so treat that command as an authorised remote deployment action, not harmless preparation.
5. Configure Stream to require signed URLs and register the authenticated webhook route.
6. Review/tune the implemented D1 pairing limits, extend abuse controls to other routes, and add explicit CORS/origin policy, operator identity/roles, audit logging, alerts, and restore tests.
7. Connect a staging client through a documented API base URL without bundling privileged credentials.
8. Run contract/security/load/device playback tests, then review logs for personal data.
9. Only then add an intentional deploy workflow with approvals and rollback.

The current adapter creates signed-only direct uploads, emits short-lived signed HLS, and treats replacement as upload-new/delete-old-after-ready. Preserve that two-phase behavior; never delete the old asset before the replacement is verified.

## Protected case-study hosting

The portfolio remains unchanged and unpublished. If a future case study is synthetic and intentionally public, publish only after manual content/privacy review. If it contains private context, GitHub Pages is unsuitable because an unlinked path is still public. Put it behind real authentication such as Cloudflare Access or another identity-aware reverse proxy, with `no-store` caching and no embedded secrets/media URLs.

Primary Cloudflare references: [Workers bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [Stream direct creator uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/), and [Stream signed URLs](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/).
