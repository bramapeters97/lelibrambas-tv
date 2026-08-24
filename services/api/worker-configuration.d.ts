// Fallback binding snapshot for the Windows ARM64 development host.
// Regenerate with `yarn workspace @lelibrambas/api generate:types` on a Wrangler-supported host.
interface Env {
  DB: D1Database;
  ARTWORK: R2Bucket;
  STREAM: StreamBinding;
  STREAM_DELIVERY_DOMAIN: string;
  ADMIN_API_TOKEN: string;
  STREAM_WEBHOOK_SECRET: string;
}
