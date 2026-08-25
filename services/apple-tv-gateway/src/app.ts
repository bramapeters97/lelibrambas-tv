import type { IdentityVerifier, VerifiedIdentity } from './access.js';
import type { GatewayConfig } from './config.js';
import { parseActivationDecision, parseBeginAuthorization } from './contracts.js';
import { GatewayError } from './errors.js';
import {
  generateUserCode,
  hmacSHA256Hex,
  maskEmail,
  normalizeEmail,
  normalizeUserCode,
  parseCookie,
  randomOpaqueToken,
  safeStringEqual,
  sha256Hex,
} from './security.js';
import type { AuthorizationRecord, GatewayStore, SessionRecord } from './storage.js';
import type { UpstreamCatalog } from './upstream.js';

const CSRF_COOKIE = '__Host-lb_activation_csrf';

export interface GatewayDependencies {
  readonly store: GatewayStore;
  readonly upstream: UpstreamCatalog;
  readonly identityVerifier: IdentityVerifier;
  readonly config: GatewayConfig;
  readonly now?: () => Date;
  readonly createId?: () => string;
  readonly createOpaqueToken?: () => string;
  readonly createUserCode?: () => string;
}

export interface RequestExecutionHooks {
  waitUntil(promise: Promise<unknown>): void;
}

export interface GatewayApp {
  fetch(request: Request, hooks?: RequestExecutionHooks): Promise<Response>;
}

function epochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1_000);
}

function isoFromEpoch(seconds: number): string {
  return new Date(seconds * 1_000).toISOString();
}

function jsonData(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set('cache-control', 'no-store');
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('x-content-type-options', 'nosniff');
  return Response.json({ data }, { status, headers });
}

function errorResponse(error: GatewayError, requestId: string): Response {
  const headers = new Headers(error.headers);
  headers.set('cache-control', 'no-store');
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-request-id', requestId);
  return Response.json(
    { error: { code: error.code, message: error.message, request_id: requestId } },
    { status: error.status, headers },
  );
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function activationHTML(input: {
  readonly csrfToken: string;
  readonly userCode: string;
  readonly record: AuthorizationRecord | null;
  readonly identity?: VerifiedIdentity;
  readonly message?: string;
}): string {
  const { csrfToken, userCode, record, identity, message } = input;
  const status = record?.status ?? null;
  const ready = csrfToken.length >= 32 && (record === null || status === 'pending');
  const statusText =
    message ??
    (record === null
      ? userCode.length > 0
        ? 'That code is not valid. Check the code on your Apple TV.'
        : 'Enter the code shown on your Apple TV.'
      : status === 'expired'
        ? 'That code has expired. Request a new code on your Apple TV.'
        : status === 'approved'
          ? 'This Apple TV is approved and waiting to finish activation.'
          : status === 'denied'
            ? 'This activation request was denied.'
            : status === 'consumed'
              ? 'This code has already been used.'
              : `Approve ${record.deviceName}?`);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Activate LeliBrambas+</title>
  <style>
    :root{color-scheme:dark;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#03050b;color:#f7f9fe}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px;background:radial-gradient(circle at 75% 10%,#172541 0,transparent 42%),linear-gradient(145deg,#070b14,#03050b 70%)}
    main{width:min(620px,100%);padding:44px;border:1px solid #2a3855;border-radius:28px;background:rgba(17,28,51,.94);box-shadow:0 30px 80px rgba(0,0,0,.5)}
    .brand{margin:0 0 8px;color:#70d8ff;font-size:14px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}h1{margin:0 0 12px;font-size:clamp(34px,8vw,54px);letter-spacing:-.04em}p{color:#c2cbdc;line-height:1.55}.status{margin:24px 0;padding:18px;border-radius:16px;background:#070b14;color:#f7f9fe}
    label{display:block;margin:22px 0 8px;font-weight:700}input{width:100%;padding:16px 18px;border:1px solid #3b4d71;border-radius:14px;background:#070b14;color:#f7f9fe;font:inherit;font-size:22px;letter-spacing:.1em;text-transform:uppercase}
    .actions{display:flex;gap:12px;margin-top:22px;flex-wrap:wrap}button{padding:14px 22px;border:0;border-radius:999px;font:inherit;font-weight:800;cursor:pointer}button[value=approve]{background:#f7f9fe;color:#03050b}button[value=deny]{background:#172541;color:#f7f9fe;border:1px solid #52617d}small{display:block;margin-top:28px;color:#8793a9}
  </style>
</head>
<body><main>
  <p class="brand">LeliBrambas+ private archive</p>
  <h1>Activate Apple TV</h1>
  ${identity === undefined ? '' : `<p>Signed in as ${htmlEscape(maskEmail(identity.email))}.</p>`}
  <div class="status" role="status">${htmlEscape(statusText)}</div>
  <form method="post" action="/activate">
    <input type="hidden" name="csrf_token" value="${htmlEscape(csrfToken)}">
    <label for="user_code">Apple TV code</label>
    <input id="user_code" name="user_code" value="${htmlEscape(userCode)}" maxlength="9" autocomplete="one-time-code" required autofocus>
    <div class="actions">
      <button type="submit" name="action" value="approve"${ready ? '' : ' disabled'}>Approve</button>
      <button type="submit" name="action" value="deny"${ready ? '' : ' disabled'}>Deny</button>
    </div>
  </form>
  <small>Only approve a code that is currently visible on your own Apple TV.</small>
</main></body></html>`;
}

function htmlResponse(body: string, status = 200, csrfToken?: string): Response {
  const headers = new Headers({
    'cache-control': 'no-store',
    'content-security-policy':
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    'content-type': 'text/html; charset=utf-8',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  });
  if (csrfToken !== undefined) {
    headers.append(
      'set-cookie',
      `${CSRF_COOKIE}=${csrfToken}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=900`,
    );
  }
  return new Response(body, { status, headers });
}

function bearerToken(request: Request): string | null {
  const value = request.headers.get('authorization');
  const match = value === null ? null : /^Bearer\s+([A-Za-z0-9_-]{32,256})$/u.exec(value);
  return match?.[1] ?? null;
}

async function requireSession(
  request: Request,
  store: GatewayStore,
  now: number,
): Promise<{ readonly rawToken: string; readonly record: SessionRecord }> {
  const rawToken = bearerToken(request);
  if (rawToken === null) {
    throw new GatewayError(401, 'SESSION_REQUIRED', 'Sign in on this Apple TV again.');
  }
  const record = await store.authorizeSession(await sha256Hex(rawToken), now);
  if (record === null) {
    throw new GatewayError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.');
  }
  return { rawToken, record };
}

async function enforceRateLimit(
  request: Request,
  store: GatewayStore,
  scope: string,
  limit: number,
  windowSeconds: number,
  now: number,
  discriminator?: string,
): Promise<void> {
  const address = request.headers.get('cf-connecting-ip') ?? 'local-or-unknown';
  const keyHash = await sha256Hex(`${scope}:${discriminator ?? address}`);
  const decision = await store.consumeRateLimit(keyHash, limit, windowSeconds, now);
  if (!decision.allowed) {
    throw new GatewayError(429, 'RATE_LIMITED', 'Too many requests. Try again shortly.', {
      'retry-after': String(decision.retryAfterSeconds),
    });
  }
}

async function activationRecord(
  store: GatewayStore,
  userCode: string,
  now: number,
): Promise<AuthorizationRecord | null> {
  const normalized = normalizeUserCode(userCode);
  if (normalized === null) return null;
  const record = await store.authorizationByUserHash(await sha256Hex(normalized));
  if (
    record !== null &&
    record.expiresAt <= now &&
    (record.status === 'pending' || record.status === 'approved')
  ) {
    await store.markExpired(record.deviceCodeHash, now);
    return { ...record, status: 'expired' };
  }
  return record;
}

function artworkSignaturePayload(
  id: number,
  kind: 'poster' | 'backdrop',
  expiresAt: number,
): string {
  return `/v1/artwork/${id}/${kind}\n${expiresAt}`;
}

export function createGatewayApp(dependencies: GatewayDependencies): GatewayApp {
  const now = dependencies.now ?? (() => new Date());
  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  const createOpaqueToken = dependencies.createOpaqueToken ?? (() => randomOpaqueToken());
  const createUserCode = dependencies.createUserCode ?? generateUserCode;

  async function beginAuthorization(
    request: Request,
    hooks?: RequestExecutionHooks,
  ): Promise<Response> {
    const timestamp = epochSeconds(now());
    await enforceRateLimit(request, dependencies.store, 'device-create', 8, 600, timestamp);
    const input = await parseBeginAuthorization(request);
    let rawDeviceCode = '';
    let rawUserCode = '';
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
      rawDeviceCode = createOpaqueToken();
      rawUserCode = createUserCode();
      inserted = await dependencies.store.insertAuthorization({
        id: createId(),
        deviceCodeHash: await sha256Hex(rawDeviceCode),
        userCodeHash: await sha256Hex(rawUserCode),
        deviceName: input.deviceName,
        createdAt: timestamp,
        expiresAt: timestamp + dependencies.config.deviceCodeTTLSeconds,
        pollIntervalSeconds: dependencies.config.devicePollIntervalSeconds,
      });
    }
    if (!inserted) {
      throw new GatewayError(
        503,
        'CODE_GENERATION_FAILED',
        'Activation is temporarily unavailable.',
      );
    }
    hooks?.waitUntil(dependencies.store.cleanup(timestamp));
    const verificationURL = new URL('/activate', dependencies.config.publicOrigin);
    const verificationURLComplete = new URL(verificationURL);
    verificationURLComplete.searchParams.set('user_code', rawUserCode);
    return jsonData(
      {
        device_code: rawDeviceCode,
        user_code: rawUserCode,
        verification_url: verificationURL.toString(),
        verification_url_complete: verificationURLComplete.toString(),
        expires_at: isoFromEpoch(timestamp + dependencies.config.deviceCodeTTLSeconds),
        interval_seconds: dependencies.config.devicePollIntervalSeconds,
      },
      201,
    );
  }

  async function pollAuthorization(request: Request, rawDeviceCode: string): Promise<Response> {
    const timestamp = epochSeconds(now());
    if (!/^[A-Za-z0-9_-]{32,256}$/u.test(rawDeviceCode)) {
      throw new GatewayError(404, 'DEVICE_CODE_NOT_FOUND', 'The activation request was not found.');
    }
    const deviceCodeHash = await sha256Hex(rawDeviceCode);
    await enforceRateLimit(request, dependencies.store, 'device-poll-ip', 180, 600, timestamp);
    const record = await dependencies.store.authorizationByDeviceHash(deviceCodeHash);
    if (record === null) {
      throw new GatewayError(404, 'DEVICE_CODE_NOT_FOUND', 'The activation request was not found.');
    }
    if (
      record.expiresAt <= timestamp &&
      (record.status === 'pending' || record.status === 'approved')
    ) {
      await dependencies.store.markExpired(deviceCodeHash, timestamp);
      return jsonData({ status: 'expired' });
    }
    if (record.status === 'expired') return jsonData({ status: 'expired' });
    if (record.status === 'denied') return jsonData({ status: 'denied' });
    if (record.status === 'consumed') {
      throw new GatewayError(
        410,
        'DEVICE_CODE_USED',
        'This activation code has already been used.',
      );
    }
    const pollRecorded = await dependencies.store.recordPoll(
      deviceCodeHash,
      timestamp,
      timestamp - record.pollIntervalSeconds,
    );
    if (!pollRecorded) {
      throw new GatewayError(429, 'SLOW_DOWN', 'Wait before checking activation again.', {
        'retry-after': String(record.pollIntervalSeconds),
      });
    }
    if (record.status === 'pending') return jsonData({ status: 'pending' });

    const rawSessionToken = createOpaqueToken();
    const sessionId = createId();
    const sessionExpiresAt = timestamp + dependencies.config.sessionTTLSeconds;
    const consumed = await dependencies.store.consumeApprovedAuthorization(
      deviceCodeHash,
      sessionId,
      await sha256Hex(rawSessionToken),
      timestamp,
      sessionExpiresAt,
    );
    if (!consumed) {
      throw new GatewayError(
        410,
        'DEVICE_CODE_USED',
        'This activation code has already been used.',
      );
    }
    return jsonData({
      status: 'approved',
      session_token: rawSessionToken,
      email: record.emailHint,
      expires_at: isoFromEpoch(sessionExpiresAt),
    });
  }

  async function activate(request: Request): Promise<Response> {
    const timestamp = epochSeconds(now());
    const identity = await dependencies.identityVerifier.verify(request);
    const identityHash = await sha256Hex(normalizeEmail(identity.email));
    await enforceRateLimit(request, dependencies.store, 'activation-ip', 30, 600, timestamp);
    await enforceRateLimit(
      request,
      dependencies.store,
      'activation-identity',
      20,
      600,
      timestamp,
      identityHash,
    );

    if (request.method === 'GET') {
      const csrfToken = createOpaqueToken();
      const requestedCode = new URL(request.url).searchParams.get('user_code') ?? '';
      const normalizedCode = normalizeUserCode(requestedCode) ?? '';
      const record =
        normalizedCode.length > 0
          ? await activationRecord(dependencies.store, normalizedCode, timestamp)
          : null;
      return htmlResponse(
        activationHTML({ csrfToken, userCode: normalizedCode, record, identity }),
        200,
        csrfToken,
      );
    }
    if (request.method !== 'POST') {
      throw new GatewayError(405, 'METHOD_NOT_ALLOWED', 'This method is not allowed.', {
        allow: 'GET, POST',
      });
    }
    const decision = await parseActivationDecision(request);
    const cookieToken = parseCookie(request, CSRF_COOKIE);
    if (
      cookieToken === null ||
      decision.csrfToken.length < 32 ||
      !(await safeStringEqual(cookieToken, decision.csrfToken))
    ) {
      throw new GatewayError(403, 'FORM_EXPIRED', 'This activation form has expired. Try again.');
    }
    const normalizedCode = normalizeUserCode(decision.userCode);
    const csrfToken = createOpaqueToken();
    if (normalizedCode === null) {
      return htmlResponse(
        activationHTML({ csrfToken, userCode: '', record: null, identity }),
        400,
        csrfToken,
      );
    }
    const record = await activationRecord(dependencies.store, normalizedCode, timestamp);
    if (record === null || record.status !== 'pending') {
      return htmlResponse(
        activationHTML({ csrfToken, userCode: normalizedCode, record, identity }),
        record === null ? 404 : 409,
        csrfToken,
      );
    }
    const updated = await dependencies.store.decideAuthorization(
      record.userCodeHash,
      decision.action === 'approve' ? 'approved' : 'denied',
      await sha256Hex(`access:${normalizeEmail(identity.email)}`),
      maskEmail(identity.email),
      timestamp,
    );
    if (!updated) {
      throw new GatewayError(
        409,
        'ACTIVATION_ALREADY_DECIDED',
        'This activation was already handled.',
      );
    }
    const updatedRecord: AuthorizationRecord = {
      ...record,
      status: decision.action === 'approve' ? 'approved' : 'denied',
    };
    const message =
      decision.action === 'approve'
        ? 'Approved. Return to your Apple TV to finish signing in.'
        : 'Denied. The Apple TV will not be signed in.';
    return htmlResponse(
      activationHTML({
        csrfToken,
        userCode: normalizedCode,
        record: updatedRecord,
        identity,
        message,
      }),
      200,
      csrfToken,
    );
  }

  async function catalog(request: Request): Promise<Response> {
    const timestamp = epochSeconds(now());
    const session = await requireSession(request, dependencies.store, timestamp);
    await enforceRateLimit(
      request,
      dependencies.store,
      'catalog-session',
      120,
      60,
      timestamp,
      session.record.id,
    );
    const source = await dependencies.upstream.loadCatalog();
    const artworkExpiresAt = timestamp + dependencies.config.artworkURLTTLSeconds;
    const hasFeatured = source.some((item) => item.featured);
    const data = await Promise.all(
      source.map(async (item, index) => {
        const artworkURL = async (
          kind: 'poster' | 'backdrop',
          available: boolean,
        ): Promise<string | null> => {
          if (!available) return null;
          const path = `/v1/artwork/${item.id}/${kind}`;
          const signature = await hmacSHA256Hex(
            dependencies.config.artworkSigningKey,
            artworkSignaturePayload(item.id, kind, artworkExpiresAt),
          );
          const url = new URL(path, dependencies.config.publicOrigin);
          url.searchParams.set('expires', String(artworkExpiresAt));
          url.searchParams.set('sig', signature);
          return url.toString();
        };
        return {
          id: item.id,
          title: item.title,
          year: item.year,
          description: item.description,
          category: item.category,
          poster_url: (await artworkURL('poster', item.posterUrl.length > 0)) ?? '',
          backdrop_url: await artworkURL('backdrop', item.backdropUrl !== null),
          sort_order: item.sortOrder,
          featured: item.featured || (!hasFeatured && index === 0),
          preview_start_seconds: item.previewStartSeconds,
        };
      }),
    );
    return jsonData(data);
  }

  async function playback(request: Request, mediaId: number): Promise<Response> {
    const timestamp = epochSeconds(now());
    const session = await requireSession(request, dependencies.store, timestamp);
    await enforceRateLimit(
      request,
      dependencies.store,
      'playback-session',
      30,
      60,
      timestamp,
      session.record.id,
    );
    const items = await dependencies.upstream.loadCatalog();
    const item = items.find((candidate) => candidate.id === mediaId);
    if (item === undefined)
      throw new GatewayError(404, 'MEDIA_NOT_FOUND', 'This media item was not found.');
    const url = await dependencies.upstream.playbackURL(item);
    return jsonData({ playback_url: url.toString() });
  }

  async function artwork(
    request: Request,
    mediaId: number,
    kind: 'poster' | 'backdrop',
  ): Promise<Response> {
    const timestamp = epochSeconds(now());
    await enforceRateLimit(request, dependencies.store, 'artwork-ip', 600, 600, timestamp);
    const url = new URL(request.url);
    const expiresAt = Number(url.searchParams.get('expires'));
    const signature = url.searchParams.get('sig') ?? '';
    if (
      !Number.isSafeInteger(expiresAt) ||
      expiresAt < timestamp ||
      expiresAt > timestamp + dependencies.config.artworkURLTTLSeconds + 60 ||
      !/^[a-f0-9]{64}$/u.test(signature)
    ) {
      throw new GatewayError(
        410,
        'ARTWORK_LINK_EXPIRED',
        'Refresh the catalog to load this artwork.',
      );
    }
    const expected = await hmacSHA256Hex(
      dependencies.config.artworkSigningKey,
      artworkSignaturePayload(mediaId, kind, expiresAt),
    );
    if (!(await safeStringEqual(signature, expected))) {
      throw new GatewayError(403, 'ARTWORK_LINK_INVALID', 'This artwork link is invalid.');
    }
    const items = await dependencies.upstream.loadCatalog();
    const item = items.find((candidate) => candidate.id === mediaId);
    if (item === undefined)
      throw new GatewayError(404, 'ARTWORK_NOT_FOUND', 'Artwork is not available.');
    return dependencies.upstream.artwork(item, kind, request);
  }

  async function rotateSession(request: Request): Promise<Response> {
    const timestamp = epochSeconds(now());
    const current = await requireSession(request, dependencies.store, timestamp);
    await enforceRateLimit(
      request,
      dependencies.store,
      'session-rotate',
      5,
      3_600,
      timestamp,
      current.record.id,
    );
    const replacementToken = createOpaqueToken();
    const replacementId = createId();
    const replacementExpiresAt = timestamp + dependencies.config.sessionTTLSeconds;
    const replacement = await dependencies.store.rotateSession(
      await sha256Hex(current.rawToken),
      replacementId,
      await sha256Hex(replacementToken),
      timestamp,
      replacementExpiresAt,
    );
    if (replacement === null) {
      throw new GatewayError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.');
    }
    return jsonData({
      session_token: replacementToken,
      email: replacement.emailHint,
      expires_at: isoFromEpoch(replacementExpiresAt),
    });
  }

  async function route(request: Request, hooks?: RequestExecutionHooks): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    if (method === 'GET' && url.pathname === '/health') {
      return jsonData({ status: 'ok', service: 'lelibrambas-apple-tv-gateway' });
    }
    if (url.pathname === '/activate') return activate(request);
    if (method === 'POST' && url.pathname === '/v1/device/authorizations') {
      return beginAuthorization(request, hooks);
    }
    const authorizationMatch = /^\/v1\/device\/authorizations\/([A-Za-z0-9_-]+)$/u.exec(
      url.pathname,
    );
    if (method === 'GET' && authorizationMatch !== null) {
      return pollAuthorization(request, authorizationMatch[1] ?? '');
    }
    if (method === 'GET' && url.pathname === '/v1/catalog') return catalog(request);
    const playbackMatch = /^\/v1\/media\/(\d+)\/playback$/u.exec(url.pathname);
    if (method === 'POST' && playbackMatch !== null) {
      const mediaId = Number(playbackMatch[1]);
      if (!Number.isSafeInteger(mediaId))
        throw new GatewayError(404, 'MEDIA_NOT_FOUND', 'This media item was not found.');
      return playback(request, mediaId);
    }
    const artworkMatch = /^\/v1\/artwork\/(\d+)\/(poster|backdrop)$/u.exec(url.pathname);
    if (method === 'GET' && artworkMatch !== null) {
      const mediaId = Number(artworkMatch[1]);
      const kind = artworkMatch[2];
      if (!Number.isSafeInteger(mediaId) || (kind !== 'poster' && kind !== 'backdrop')) {
        throw new GatewayError(404, 'ARTWORK_NOT_FOUND', 'Artwork is not available.');
      }
      return artwork(request, mediaId, kind);
    }
    if (method === 'POST' && url.pathname === '/v1/sessions/refresh') return rotateSession(request);
    if (method === 'DELETE' && url.pathname === '/v1/sessions/current') {
      const timestamp = epochSeconds(now());
      const session = await requireSession(request, dependencies.store, timestamp);
      await dependencies.store.revokeSession(await sha256Hex(session.rawToken), timestamp);
      return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
    }
    throw new GatewayError(404, 'NOT_FOUND', 'Route not found.');
  }

  return {
    async fetch(request: Request, hooks?: RequestExecutionHooks): Promise<Response> {
      const requestId = crypto.randomUUID();
      try {
        const response = await route(request, hooks);
        response.headers.set('x-request-id', requestId);
        return response;
      } catch (error) {
        if (error instanceof GatewayError) {
          if (new URL(request.url).pathname === '/activate') {
            return htmlResponse(
              activationHTML({
                csrfToken: '',
                userCode: '',
                record: null,
                message: error.message,
              }),
              error.status,
            );
          }
          return errorResponse(error, requestId);
        }
        console.error(
          JSON.stringify({
            message: 'Gateway request failed',
            requestId,
            method: request.method,
            path: new URL(request.url).pathname,
            errorType: error instanceof Error ? error.name : 'UnknownError',
          }),
        );
        return errorResponse(
          new GatewayError(500, 'INTERNAL_ERROR', 'Something went wrong. Try again later.'),
          requestId,
        );
      }
    },
  };
}
