# Security and privacy

LELIBRAMBAS+ is private-by-design, but this repository is a prototype, not a completed security accreditation. Its public-safe fixtures are synthetic. Real media, personal paths, tokens, signing keys, device state, and cloud identifiers must stay outside Git and browser bundles.

## Trust boundaries

### Browser viewers

The rich viewer is a Vite application. Profile, progress, and watch state use browser
`localStorage`; this is convenience persistence, not encrypted storage or access control.

### Electron

The Electron shell enables context isolation, Chromium sandboxing, web security, and safe dialogs; it disables Node in renderer/workers, webviews, mixed content, drag navigation, and DevTools in packaged mode. It exposes no preload API or IPC.

Development accepts only a plain HTTP loopback origin. Production uses traversal-checked `lelibrambas://app` assets. New windows, downloads, webviews, external navigation/redirects, device permissions, and permission requests are denied. Packaged HTML receives a CSP that allows local scripts and HTTPS media traffic only to Cloudflare Stream delivery hosts; frames, insecure HTTP, and WebSockets remain blocked.

### Importer and local filesystem

Source traversal skips symbolic links. Output inside source, path escape, and identical source/output are rejected. Final media is promoted from `.partial` only after successful FFmpeg output. The CLI never deletes sources.

Manifests and state contain absolute paths, checksums, filenames, and inferred family metadata. Keep them on an access-controlled machine, outside sync/public folders where practical. Repository importer directories are ignored, but an ignored file can still be copied or uploaded manually. Viewing copies are private media too.

### Worker API

The unprovisioned Worker architecture currently provides:

- public health, pairing creation/status, and signed webhook endpoints;
- bearer admin authentication with timing-resistant comparison;
- a random device token returned once at pairing creation, with only its SHA-256 hash stored; authorization starts only after admin approval;
- six-character, 10-minute pairing codes with admin approval/denial, token rotation, and revocation;
- atomic D1 fixed-window limits for pairing creation and status polling, keyed by a hash of the connecting address;
- authenticated, timestamp-checked, idempotent Cloudflare Stream webhooks;
- signed-only direct uploads and short-lived signed HLS playback;
- Zod request validation, 1 MB JSON limit, 15 MB artwork limit, traversal-safe R2 keys, and `no-store` JSON responses.

Before production, review and tune the existing pairing limits, extend abuse controls to the rest of the API, and add explicit CORS/origin policy, security headers, audit/alerting, token recovery, retention/deletion procedures, least-privilege admin roles, backups, and dependency/runtime review. Six-character codes still depend on effective online throttling and monitoring. The current single `ADMIN_API_TOKEN` is an architectural placeholder, not a complete operator identity model.

## Secrets and configuration

The Worker config actually consumes bindings `DB`, `ARTWORK`, and `STREAM`; variable `STREAM_DELIVERY_DOMAIN`; and secrets `ADMIN_API_TOKEN` and `STREAM_WEBHOOK_SECRET`.

`.env.example` contains non-secret placeholders for the current Worker settings and the optional
public viewer test stream. The two `VITE_STREAM_PLACEHOLDER_*` values are deliberately public:
Vite bundles them into the browser application. Never put a signed playback token, API token,
account credential, or private asset identifier in either value. Real resource IDs, account
credentials, API tokens, and private signing keys are excluded; direct D1, R2, and Stream bindings
are configured separately in `services/api/wrangler.jsonc`.

Never prefix server secrets with `VITE_` or place them in `apps/*`. The nested ignore file covers `.env` and `.env.local`, but not every possible secret filename; in particular, do not create `.dev.vars`, production environment files, private keys, or certificates inside the repository unless the ignore policy is first reviewed and extended. Use Wrangler's secret store only in a deliberately authorised deployment. Cloudflare account/API tokens should be scoped to the minimum resources and should not be available inside the Worker when a native binding suffices.

## Public case study

The root portfolio index is intentionally unchanged and no publication is authorized. Synthetic screenshots can be public-safe after review, but an unlinked static page is still reachable if deployed. GitHub Pages provides no per-page authentication. A future private case study needs an authenticated host or identity-aware edge proxy; a truly public case study must contain only synthetic content and no operational endpoints/identifiers.

## Incident checklist

If private media or a credential is committed, stop publication, rotate/revoke the credential, remove public access, assess downloaded/forked history, and use an approved history-rewrite process only after coordinating with all collaborators. Deleting the latest file revision alone does not remove it from Git history.

See [Cloud hosting](CLOUD_HOSTING.md), [Video import](README_VIDEO_IMPORT.md), and the [Electron README](apps/desktop/README.md).
