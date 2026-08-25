import { describe, expect, it } from 'vitest';
import { createGatewayApp } from '../src/app.js';
import { sha256Hex } from '../src/security.js';
import {
  FixedIdentityVerifier,
  FixtureUpstream,
  idSequence,
  MemoryGatewayStore,
  syntheticConfig,
  tokenSequence,
} from './helpers.js';

interface DataEnvelope<T> {
  readonly data: T;
}

interface Challenge {
  readonly device_code: string;
  readonly user_code: string;
  readonly verification_url: string;
  readonly verification_url_complete: string;
  readonly interval_seconds: number;
}

function request(path: string, init?: RequestInit): Request {
  const url = path.startsWith('https://') ? path : `https://gateway.example.test${path}`;
  return new Request(url, {
    ...init,
    headers: {
      'cf-connecting-ip': '192.0.2.10',
      ...init?.headers,
    },
  });
}

async function begin(
  app: ReturnType<typeof createGatewayApp>,
  deviceName = 'Synthetic Living Room',
): Promise<Challenge> {
  const response = await app.fetch(
    request('/v1/device/authorizations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceName }),
    }),
  );
  expect(response.status).toBe(201);
  return ((await response.json()) as DataEnvelope<Challenge>).data;
}

function fixture() {
  let timestamp = new Date('2026-08-25T12:00:00.000Z');
  const store = new MemoryGatewayStore();
  const upstream = new FixtureUpstream();
  const app = createGatewayApp({
    store,
    upstream,
    identityVerifier: new FixedIdentityVerifier(),
    config: syntheticConfig,
    now: () => timestamp,
    createId: idSequence(),
    createOpaqueToken: tokenSequence(),
    createUserCode: () => 'ABCD-EFGH',
  });
  return {
    app,
    store,
    upstream,
    advance(seconds: number) {
      timestamp = new Date(timestamp.getTime() + seconds * 1_000);
    },
  };
}

async function activate(
  app: ReturnType<typeof createGatewayApp>,
  userCode: string,
  action: 'approve' | 'deny',
): Promise<Response> {
  const form = await app.fetch(request(`/activate?user_code=${encodeURIComponent(userCode)}`));
  const cookie = form.headers.get('set-cookie')?.split(';')[0] ?? '';
  const html = await form.text();
  const csrf = /name="csrf_token" value="([^"]+)"/u.exec(html)?.[1] ?? '';
  return app.fetch(
    request('/activate', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie,
      },
      body: new URLSearchParams({ user_code: userCode, action, csrf_token: csrf }),
    }),
  );
}

describe('Apple TV gateway', () => {
  it('exchanges an approved one-time device code for a hashed, expiring session', async () => {
    const { app, store, advance } = fixture();
    const challenge = await begin(app);
    expect(challenge.user_code).toBe('ABCD-EFGH');
    expect(challenge.device_code).toMatch(/^[A-Za-z0-9_-]{32,}$/u);
    expect(challenge.verification_url).toBe('https://gateway.example.test/activate');
    expect(challenge.verification_url_complete).toContain('user_code=ABCD-EFGH');

    const persisted = JSON.stringify([...store.authorizations.values()]);
    expect(persisted).not.toContain(challenge.device_code);
    expect(persisted).not.toContain(challenge.user_code);
    expect(persisted).toContain(await sha256Hex(challenge.device_code));

    const pending = await app.fetch(request(`/v1/device/authorizations/${challenge.device_code}`));
    expect(await pending.json()).toEqual({ data: { status: 'pending' } });

    const tooFast = await app.fetch(request(`/v1/device/authorizations/${challenge.device_code}`));
    expect(tooFast.status).toBe(429);
    expect(tooFast.headers.get('retry-after')).toBe(String(challenge.interval_seconds));

    const approval = await activate(app, challenge.user_code, 'approve');
    expect(approval.status).toBe(200);
    expect(await approval.text()).toContain('Return to your Apple TV');

    advance(challenge.interval_seconds);
    const exchange = await app.fetch(request(`/v1/device/authorizations/${challenge.device_code}`));
    const session = (await exchange.json()) as DataEnvelope<{
      status: string;
      session_token: string;
      email: string;
      expires_at: string;
    }>;
    expect(session.data.status).toBe('approved');
    expect(session.data.email).toBe('t•••@example.test');
    expect(session.data.session_token).toMatch(/^[A-Za-z0-9_-]{32,}$/u);
    expect(JSON.stringify([...store.sessions.values()])).not.toContain(session.data.session_token);

    advance(challenge.interval_seconds);
    const replay = await app.fetch(request(`/v1/device/authorizations/${challenge.device_code}`));
    expect(replay.status).toBe(410);
    await expect(replay.json()).resolves.toMatchObject({ error: { code: 'DEVICE_CODE_USED' } });
  });

  it('protects catalog and playback, signs artwork URLs, and rotates sessions', async () => {
    const { app, upstream, advance } = fixture();
    const challenge = await begin(app);
    await activate(app, challenge.user_code, 'approve');
    advance(challenge.interval_seconds);
    const exchange = await app.fetch(request(`/v1/device/authorizations/${challenge.device_code}`));
    const token = ((await exchange.json()) as DataEnvelope<{ session_token: string }>).data
      .session_token;

    expect((await app.fetch(request('/v1/catalog'))).status).toBe(401);
    const catalog = await app.fetch(
      request('/v1/catalog', { headers: { authorization: `Bearer ${token}` } }),
    );
    const item = ((await catalog.json()) as DataEnvelope<Array<Record<string, unknown>>>).data[0];
    expect(item).toMatchObject({ id: 101, title: 'Northern Lights Archive', featured: true });
    expect(item).not.toHaveProperty('stream_video_id');
    expect(item?.poster_url).toMatch(
      /^https:\/\/gateway\.example\.test\/v1\/artwork\/101\/poster\?/u,
    );

    const artwork = await app.fetch(request(String(item?.poster_url)));
    expect(artwork.status).toBe(200);
    expect(await artwork.text()).toBe('101:poster');

    const playback = await app.fetch(
      request('/v1/media/101/playback', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    await expect(playback.json()).resolves.toEqual({
      data: { playback_url: 'https://media.example.test/101/manifest/video.m3u8' },
    });
    expect(upstream.playbackRequests).toEqual([101]);

    const refresh = await app.fetch(
      request('/v1/sessions/refresh', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    const replacement = ((await refresh.json()) as DataEnvelope<{ session_token: string }>).data
      .session_token;
    expect(replacement).not.toBe(token);
    expect(
      (await app.fetch(request('/v1/catalog', { headers: { authorization: `Bearer ${token}` } })))
        .status,
    ).toBe(401);
    expect(
      (
        await app.fetch(
          request('/v1/catalog', { headers: { authorization: `Bearer ${replacement}` } }),
        )
      ).status,
    ).toBe(200);
  });

  it('reports explicit denial, expiry, and CSRF failure without issuing a token', async () => {
    const denied = fixture();
    const deniedChallenge = await begin(denied.app);
    expect((await activate(denied.app, deniedChallenge.user_code, 'deny')).status).toBe(200);
    denied.advance(deniedChallenge.interval_seconds);
    const denial = await denied.app.fetch(
      request(`/v1/device/authorizations/${deniedChallenge.device_code}`),
    );
    expect(await denial.json()).toEqual({ data: { status: 'denied' } });
    expect(denied.store.sessions.size).toBe(0);

    const expired = fixture();
    const expiredChallenge = await begin(expired.app);
    expired.advance(601);
    const expiry = await expired.app.fetch(
      request(`/v1/device/authorizations/${expiredChallenge.device_code}`),
    );
    expect(await expiry.json()).toEqual({ data: { status: 'expired' } });

    const csrf = fixture();
    const csrfChallenge = await begin(csrf.app);
    const invalidForm = await csrf.app.fetch(
      request('/activate', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          cookie: '__Host-lb_activation_csrf=different-token-value-with-required-length',
        },
        body: new URLSearchParams({
          user_code: csrfChallenge.user_code,
          action: 'approve',
          csrf_token: 'invalid-token-value-with-required-length',
        }),
      }),
    );
    expect(invalidForm.status).toBe(403);
    expect(csrf.store.sessions.size).toBe(0);
  });
});
