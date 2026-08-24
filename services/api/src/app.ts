import {
  MediaProviderError,
  type MediaAssetStatus,
  type MediaProvider,
  type ProviderWebhookEvent,
} from '@lelibrambas/media';
import { ZodError, type ZodType } from 'zod';
import {
  PairingApprovalSchema,
  PairingDenialSchema,
  PairingRequestSchema,
  PlaybackRequestSchema,
  ProgressRequestSchema,
  StreamWebhookSchema,
  UploadRequestSchema,
} from './contracts.js';
import type { ArtworkStore, CatalogRepository, DeviceRepository, RateLimiter } from './ports.js';
import {
  generateDeviceToken,
  generatePairingCode,
  safeStringEqual,
  sha256,
  verifyStreamWebhookSignature,
} from './security.js';

const MAX_JSON_BYTES = 1024 * 1024;

class ApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly headers?: HeadersInit,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiDependencies {
  readonly media: MediaProvider;
  readonly catalog: CatalogRepository;
  readonly devices: DeviceRepository;
  readonly rateLimiter: RateLimiter;
  readonly artwork: ArtworkStore;
  readonly adminToken: string;
  readonly webhookSecret: string;
  readonly now?: () => Date;
}

export interface ApiApp {
  fetch(request: Request): Promise<Response>;
}

function response(data: unknown, status = 200): Response {
  return Response.json({ data }, { status, headers: { 'cache-control': 'no-store' } });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  extraHeaders?: HeadersInit,
): Response {
  const headers = new Headers(extraHeaders);
  headers.set('cache-control', 'no-store');
  return Response.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status, headers },
  );
}

async function boundedText(request: Request): Promise<string> {
  const lengthHeader = request.headers.get('content-length');
  const length = lengthHeader === null ? null : Number(lengthHeader);
  if (length !== null && Number.isFinite(length) && length > MAX_JSON_BYTES) {
    throw new ApiError(413, 'BODY_TOO_LARGE', 'Request body exceeds 1 MB.');
  }

  if (request.body === null) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    totalBytes += chunk.value.byteLength;
    if (totalBytes > MAX_JSON_BYTES) {
      await reader.cancel('Request body exceeds 1 MB.').catch(() => undefined);
      throw new ApiError(413, 'BODY_TOO_LARGE', 'Request body exceeds 1 MB.');
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const raw = await boundedText(request);
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Request body is not valid JSON.');
  }
  return schema.parse(value);
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  const match = authorization === null ? null : /^Bearer\s+(.+)$/iu.exec(authorization);
  return match?.[1] ?? null;
}

async function isAdmin(request: Request, expected: string): Promise<boolean> {
  const provided = bearerToken(request);
  return provided !== null && (await safeStringEqual(provided, expected));
}

async function requireAdmin(request: Request, dependencies: ApiDependencies): Promise<void> {
  if (!(await isAdmin(request, dependencies.adminToken))) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Administrator authentication is required.');
  }
}

async function requireViewer(
  request: Request,
  dependencies: ApiDependencies,
  now: Date,
): Promise<void> {
  const token = bearerToken(request);
  if (token === null)
    throw new ApiError(401, 'UNAUTHORIZED', 'An approved device token is required.');
  if (await safeStringEqual(token, dependencies.adminToken)) return;
  if (!(await dependencies.devices.authorizeToken(await sha256(token), now.toISOString()))) {
    throw new ApiError(401, 'DEVICE_REVOKED', 'The device token is invalid or revoked.');
  }
}

async function enforceRateLimit(
  request: Request,
  dependencies: ApiDependencies,
  scope: string,
  limit: number,
  windowSeconds: number,
  now: Date,
): Promise<void> {
  const address = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const key = `${scope}:${await sha256(address)}`;
  const decision = await dependencies.rateLimiter.consume(key, limit, windowSeconds, now.getTime());
  if (!decision.allowed) {
    throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again later.', {
      'retry-after': String(Math.max(1, decision.retryAfterSeconds)),
    });
  }
}

function decodeRouteValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new ApiError(400, 'INVALID_PATH', 'The request path is malformed.');
  }
}

function webhookStatus(payload: ReturnType<typeof StreamWebhookSchema.parse>): MediaAssetStatus {
  if (payload.status.state === 'error') return 'failed';
  const percent = Number.parseFloat(payload.status.pctComplete ?? '0') || 0;
  return payload.status.state === 'ready' && payload.readyToStream && percent >= 100
    ? 'ready'
    : 'processing';
}

function mediaErrorStatus(error: MediaProviderError): number {
  if (error.code === 'ASSET_NOT_FOUND') return 404;
  if (error.code === 'ASSET_NOT_READY' || error.code === 'ASSET_UNAVAILABLE') return 409;
  if (error.code === 'UPLOAD_NOT_SUPPORTED') return 405;
  if (error.code === 'INVALID_CONFIGURATION') return 500;
  return 503;
}

async function route(request: Request, dependencies: ApiDependencies): Promise<Response> {
  const url = new URL(request.url);
  const now = (dependencies.now ?? (() => new Date()))();
  const method = request.method.toLocaleUpperCase();

  if (method === 'GET' && url.pathname === '/health') {
    return response({ status: 'ok', service: 'lelibrambas-plus-api', time: now.toISOString() });
  }

  if (method === 'POST' && url.pathname === '/api/devices/pairings') {
    await enforceRateLimit(request, dependencies, 'pairing-create', 10, 600, now);
    const input = await parseJson(request, PairingRequestSchema);
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1_000).toISOString();
    const deviceToken = generateDeviceToken();
    const tokenHash = await sha256(deviceToken);
    let pairing = null;
    for (let attempt = 0; attempt < 5 && pairing === null; attempt += 1) {
      try {
        const code = generatePairingCode();
        pairing = await dependencies.devices.createPairing(input, code, expiresAt, tokenHash);
      } catch (error) {
        if (attempt === 4) throw error;
      }
    }
    return response({ ...pairing, deviceToken }, 201);
  }

  const pairingStatusMatch = /^\/api\/devices\/pairings\/([A-Z2-9]{6})$/u.exec(url.pathname);
  if (method === 'GET' && pairingStatusMatch !== null) {
    await enforceRateLimit(request, dependencies, 'pairing-status', 60, 600, now);
    const pairing = await dependencies.devices.getPairing(pairingStatusMatch[1] ?? '');
    if (pairing === null) throw new ApiError(404, 'PAIRING_NOT_FOUND', 'Pairing code not found.');
    const expired = new Date(pairing.expiresAt).getTime() <= now.getTime();
    return response({
      ...pairing,
      status: pairing.denied
        ? 'denied'
        : pairing.revoked
          ? 'revoked'
          : pairing.approved
            ? 'approved'
            : expired
              ? 'expired'
              : 'pending',
    });
  }

  if (method === 'POST' && url.pathname === '/api/devices/pairings/approve') {
    await requireAdmin(request, dependencies);
    const input = await parseJson(request, PairingApprovalSchema);
    const deviceId = await dependencies.devices.approvePairing(
      input.code,
      input.userId,
      now.toISOString(),
    );
    if (deviceId === null)
      throw new ApiError(
        410,
        'PAIRING_EXPIRED',
        'Pairing code is expired, denied, or already used.',
      );
    return response({ deviceId, approved: true });
  }

  if (method === 'POST' && url.pathname === '/api/devices/pairings/deny') {
    await requireAdmin(request, dependencies);
    const input = await parseJson(request, PairingDenialSchema);
    if (!(await dependencies.devices.denyPairing(input.code, now.toISOString()))) {
      throw new ApiError(
        410,
        'PAIRING_EXPIRED',
        'Pairing code is expired, approved, denied, or unknown.',
      );
    }
    return response({ code: input.code, denied: true });
  }

  const revokeMatch = /^\/api\/devices\/([^/]+)\/revoke$/u.exec(url.pathname);
  if (method === 'POST' && revokeMatch !== null) {
    await requireAdmin(request, dependencies);
    const deviceId = decodeRouteValue(revokeMatch[1] ?? '');
    if (!(await dependencies.devices.revoke(deviceId, now.toISOString()))) {
      throw new ApiError(404, 'DEVICE_NOT_FOUND', 'Device was not found or was already revoked.');
    }
    return response({ deviceId, revoked: true });
  }

  if (method === 'POST' && url.pathname === '/api/webhooks/cloudflare-stream') {
    const rawBody = await boundedText(request);
    if (
      !(await verifyStreamWebhookSignature(
        rawBody,
        request.headers.get('webhook-signature'),
        dependencies.webhookSecret,
        now,
      ))
    ) {
      throw new ApiError(
        401,
        'INVALID_WEBHOOK_SIGNATURE',
        'Webhook signature is invalid or stale.',
      );
    }
    const payload = StreamWebhookSchema.parse(JSON.parse(rawBody) as unknown);
    const occurredAt = payload.modified ?? payload.created ?? now.toISOString();
    const status = webhookStatus(payload);
    const percent = Math.max(
      0,
      Math.min(100, Number.parseFloat(payload.status.pctComplete ?? '0') || 0),
    );
    const event: ProviderWebhookEvent = {
      eventId: `${payload.uid}:${occurredAt}:${status}`,
      assetId: payload.uid,
      status,
      progressPercent: percent,
      occurredAt,
      payload,
      ...(payload.status.errorReasonCode === undefined
        ? {}
        : { errorCode: payload.status.errorReasonCode }),
      ...(payload.status.errorReasonText === undefined
        ? {}
        : { errorMessage: payload.status.errorReasonText }),
    };
    const applied = await dependencies.catalog.applyMediaStatus(event);
    if (!applied) return response({ accepted: true, duplicate: true });
    const receipt = await dependencies.media.handleWebhook(event);
    return response({ ...receipt, duplicate: false });
  }

  await requireViewer(request, dependencies, now);

  if (method === 'POST' && url.pathname === '/api/devices/token/rotate') {
    const currentToken = bearerToken(request);
    if (currentToken === null || (await safeStringEqual(currentToken, dependencies.adminToken))) {
      throw new ApiError(400, 'DEVICE_TOKEN_REQUIRED', 'A device token is required for rotation.');
    }
    const replacementToken = generateDeviceToken();
    const deviceId = await dependencies.devices.rotateToken(
      await sha256(currentToken),
      await sha256(replacementToken),
      now.toISOString(),
    );
    if (deviceId === null)
      throw new ApiError(401, 'DEVICE_REVOKED', 'The device token is invalid or revoked.');
    return response({ deviceId, token: replacementToken });
  }

  if (method === 'GET' && url.pathname === '/api/catalog') {
    return response(await dependencies.catalog.listVisibleVideos());
  }

  if (method === 'POST' && url.pathname === '/api/media/uploads') {
    await requireAdmin(request, dependencies);
    const input = await parseJson(request, UploadRequestSchema);
    return response(
      await dependencies.media.createUploadSession({
        filename: input.filename,
        maxDurationSeconds: input.maxDurationSeconds,
        ...(input.creatorId === undefined ? {} : { creatorId: input.creatorId }),
        ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
        ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      }),
      201,
    );
  }

  const statusMatch = /^\/api\/media\/([^/]+)\/status$/u.exec(url.pathname);
  if (method === 'GET' && statusMatch !== null) {
    return response(
      await dependencies.media.getUploadStatus(decodeRouteValue(statusMatch[1] ?? '')),
    );
  }

  const playbackMatch = /^\/api\/media\/([^/]+)\/playback$/u.exec(url.pathname);
  if (method === 'POST' && playbackMatch !== null) {
    const input = await parseJson(request, PlaybackRequestSchema);
    return response(
      await dependencies.media.getPlayback({
        assetId: decodeRouteValue(playbackMatch[1] ?? ''),
        ...(input.preferredFormat === undefined ? {} : { preferredFormat: input.preferredFormat }),
        ...(input.tokenTtlSeconds === undefined ? {} : { tokenTtlSeconds: input.tokenTtlSeconds }),
      }),
    );
  }

  const replacementMatch = /^\/api\/media\/([^/]+)\/replacements$/u.exec(url.pathname);
  if (method === 'POST' && replacementMatch !== null) {
    await requireAdmin(request, dependencies);
    const input = await parseJson(request, UploadRequestSchema);
    return response(
      await dependencies.media.replaceAsset(decodeRouteValue(replacementMatch[1] ?? ''), {
        filename: input.filename,
        maxDurationSeconds: input.maxDurationSeconds,
        ...(input.creatorId === undefined ? {} : { creatorId: input.creatorId }),
        ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
        ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      }),
      201,
    );
  }

  const mediaMatch = /^\/api\/media\/([^/]+)$/u.exec(url.pathname);
  if (method === 'DELETE' && mediaMatch !== null) {
    await requireAdmin(request, dependencies);
    await dependencies.media.deleteAsset(decodeRouteValue(mediaMatch[1] ?? ''));
    return new Response(null, { status: 204 });
  }

  const progressMatch = /^\/api\/profiles\/([^/]+)\/progress\/([^/]+)$/u.exec(url.pathname);
  if (method === 'PUT' && progressMatch !== null) {
    await dependencies.catalog.saveProgress(
      decodeRouteValue(progressMatch[1] ?? ''),
      decodeRouteValue(progressMatch[2] ?? ''),
      await parseJson(request, ProgressRequestSchema),
    );
    return response({ saved: true });
  }

  const watchlistMatch = /^\/api\/profiles\/([^/]+)\/watchlist\/([^/]+)$/u.exec(url.pathname);
  if ((method === 'PUT' || method === 'DELETE') && watchlistMatch !== null) {
    await dependencies.catalog.setWatchlist(
      decodeRouteValue(watchlistMatch[1] ?? ''),
      decodeRouteValue(watchlistMatch[2] ?? ''),
      method === 'PUT',
    );
    return response({ included: method === 'PUT' });
  }

  const artworkMatch = /^\/api\/artwork\/(.+)$/u.exec(url.pathname);
  if (artworkMatch !== null) {
    const key = artworkMatch[1] ?? '';
    if (method === 'GET') return dependencies.artwork.get(key, request);
    await requireAdmin(request, dependencies);
    if (method === 'PUT') return dependencies.artwork.put(key, request);
    if (method === 'DELETE') return dependencies.artwork.delete(key);
  }

  throw new ApiError(404, 'NOT_FOUND', 'Route not found.');
}

export function createApiApp(dependencies: ApiDependencies): ApiApp {
  return {
    async fetch(request: Request): Promise<Response> {
      try {
        return await route(request, dependencies);
      } catch (error) {
        if (error instanceof ApiError) {
          return errorResponse(error.status, error.code, error.message, undefined, error.headers);
        }
        if (error instanceof ZodError)
          return errorResponse(400, 'VALIDATION_ERROR', 'Request validation failed.', error.issues);
        if (error instanceof MediaProviderError) {
          return errorResponse(mediaErrorStatus(error), error.code, error.message, {
            retryable: error.retryable,
          });
        }
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          JSON.stringify({
            message: 'API request failed',
            method: request.method,
            path: new URL(request.url).pathname,
            error: message,
          }),
        );
        return errorResponse(500, 'INTERNAL_ERROR', 'An internal error occurred.');
      }
    },
  };
}
