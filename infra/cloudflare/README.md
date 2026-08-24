# Cloudflare production boundary

Cloudflare resources are represented only as local configuration and adapters. Nothing in this directory provisions or deploys resources.

- D1 stores catalogue, device, profile, progress, watchlist, pairing, import/conversion, and webhook state.
- R2 stores custom artwork only. Private videos stay in Cloudflare Stream.
- The Worker uses direct bindings for D1, R2, and Stream rather than REST calls from the Worker.
- Stream direct-upload sessions require signed URLs, and webhook requests are authenticated before processing.
- Required secret names are declared in `services/api/wrangler.jsonc`; values must be supplied with Wrangler secrets or ignored local `.dev.vars` files.

Before any future deployment, replace placeholder D1/R2 names and IDs, create the resources deliberately, run `wrangler types`, apply migrations, configure secrets, and complete a privacy/security review.
