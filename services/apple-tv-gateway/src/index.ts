import { CloudflareAccessIdentityVerifier } from './access.js';
import { createGatewayApp } from './app.js';
import { loadGatewayConfig } from './config.js';
import { ConfigurationError } from './errors.js';
import { D1GatewayStore } from './storage.js';
import { ConfiguredUpstreamCatalog } from './upstream.js';

function configurationFailure(): Response {
  return Response.json(
    {
      error: { code: 'SERVICE_NOT_CONFIGURED', message: 'The Apple TV service is not configured.' },
    },
    {
      status: 503,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff',
      },
    },
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const config = loadGatewayConfig(env);
      const store = new D1GatewayStore(env.DB);
      const app = createGatewayApp({
        store,
        upstream: new ConfiguredUpstreamCatalog(config),
        identityVerifier: new CloudflareAccessIdentityVerifier(config),
        config,
      });
      return await app.fetch(request, {
        waitUntil(promise) {
          ctx.waitUntil(promise);
        },
      });
    } catch (error) {
      if (error instanceof ConfigurationError) {
        console.error(
          JSON.stringify({
            message: 'Gateway configuration is incomplete',
            path: new URL(request.url).pathname,
            errorType: error.name,
          }),
        );
        return configurationFailure();
      }
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;

export { createGatewayApp } from './app.js';
export { D1GatewayStore } from './storage.js';
