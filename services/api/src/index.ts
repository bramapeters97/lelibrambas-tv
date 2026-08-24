import { CloudflareStreamProvider } from '@lelibrambas/media';
import { createApiApp } from './app.js';
import { D1CatalogRepository, D1DeviceRepository, D1RateLimiter } from './d1-repositories.js';
import { R2ArtworkAdapter } from './r2-artwork.js';

function createProductionApp(env: Env) {
  const media = new CloudflareStreamProvider({
    binding: env.STREAM,
    deliveryDomain: env.STREAM_DELIVERY_DOMAIN,
  });
  return createApiApp({
    media,
    catalog: new D1CatalogRepository(env.DB),
    devices: new D1DeviceRepository(env.DB),
    rateLimiter: new D1RateLimiter(env.DB),
    artwork: new R2ArtworkAdapter(env.ARTWORK),
    adminToken: env.ADMIN_API_TOKEN,
    webhookSecret: env.STREAM_WEBHOOK_SECRET,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return createProductionApp(env).fetch(request);
  },
} satisfies ExportedHandler<Env>;

export { createApiApp } from './app.js';
export * from './contracts.js';
export * from './ports.js';
export * from './security.js';
export * from './d1-repositories.js';
export * from './r2-artwork.js';
