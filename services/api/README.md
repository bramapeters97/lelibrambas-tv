# LELIBRAMBAS+ Worker API

This package is a private-by-default Cloudflare Worker architecture. It uses generated binding types plus native D1, R2, and Stream bindings; it does not call Cloudflare REST APIs from the Worker. No resource has been created or deployed.

Routes cover the private catalogue, progress, watchlist, expiring device pairing, denial, revocation, token rotation, signed Stream playback, secure direct uploads, safe two-phase replacement, upload status, authenticated/idempotent Stream webhooks, and R2 artwork. Pairing returns a pending device token once to the requesting device; D1 stores only its SHA-256 digest, and authorization begins only after admin approval. Pairing creation/status are guarded by an atomic D1-backed fixed-window rate limiter.

Generate bindings and validate locally:

```powershell
yarn workspace @lelibrambas/api generate:types
yarn workspace @lelibrambas/api typecheck
yarn workspace @lelibrambas/api test
yarn workspace @lelibrambas/api build
```

`build` is Wrangler's dry-run bundle only. There is intentionally no deploy script.

Before future production use:

1. Replace the placeholder D1 database ID and bucket/customer delivery names.
2. Create resources deliberately in the private family Cloudflare account.
3. Apply `infra/d1/migrations/0001_initial.sql`.
4. Store `ADMIN_API_TOKEN` and `STREAM_WEBHOOK_SECRET` with Wrangler secrets. Never put values in config or source.
5. Re-run `wrangler types`, tests, and the dry-run build.
6. Review authentication, retention, rate limits, and private Stream settings before an explicitly authorized deployment.
