import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MockMediaProvider, type ProviderWebhookEvent } from '@lelibrambas/media';
import { createApiApp } from '../src/app.js';
import type {
  ArtworkStore,
  CatalogRepository,
  CatalogVideo,
  DeviceRepository,
  PairingRecord,
  RateLimitDecision,
  RateLimiter,
} from '../src/ports.js';
import type { PairingRequest, ProgressRequest } from '../src/contracts.js';

class MemoryCatalog implements CatalogRepository {
  public statusEvents: ProviderWebhookEvent[] = [];
  public progress: ProgressRequest[] = [];
  public watchlist = new Set<string>();
  readonly #webhookEvents = new Set<string>();

  public async listVisibleVideos(): Promise<readonly CatalogVideo[]> {
    return Promise.resolve([
      {
        id: 'video-1',
        slug: 'stockholm',
        title: 'Stockholm Summer',
        subtitle: null,
        description: 'A northern summer.',
        year: 2019,
        durationSeconds: 90,
        aspectRatio: '16:9',
        processingStatus: 'ready',
        playbackProvider: 'mock',
        playbackAssetId: 'demo-16x9',
      },
    ]);
  }
  public async saveProgress(
    _profileId: string,
    _videoId: string,
    progress: ProgressRequest,
  ): Promise<void> {
    this.progress.push(progress);
  }
  public async setWatchlist(profileId: string, videoId: string, included: boolean): Promise<void> {
    const key = `${profileId}:${videoId}`;
    if (included) this.watchlist.add(key);
    else this.watchlist.delete(key);
  }
  public async applyMediaStatus(event: ProviderWebhookEvent): Promise<boolean> {
    if (this.#webhookEvents.has(event.eventId)) return false;
    this.#webhookEvents.add(event.eventId);
    this.statusEvents.push(event);
    return true;
  }
}

class MemoryDevices implements DeviceRepository {
  readonly #pairings = new Map<string, PairingRecord>();
  readonly #pendingTokens = new Map<string, string>();
  readonly #tokens = new Set<string>();
  public async createPairing(
    _request: PairingRequest,
    code: string,
    expiresAt: string,
    tokenHash: string,
  ): Promise<PairingRecord> {
    const pairing = {
      deviceId: `device-${code}`,
      code,
      expiresAt,
      approved: false,
      denied: false,
      revoked: false,
    };
    this.#pairings.set(code, pairing);
    this.#pendingTokens.set(code, tokenHash);
    return pairing;
  }
  public async getPairing(code: string): Promise<PairingRecord | null> {
    return this.#pairings.get(code) ?? null;
  }
  public async approvePairing(code: string, _userId: string): Promise<string | null> {
    const pairing = this.#pairings.get(code);
    if (pairing === undefined) return null;
    const tokenHash = this.#pendingTokens.get(code);
    if (tokenHash === undefined) return null;
    this.#tokens.add(tokenHash);
    this.#pairings.set(code, { ...pairing, approved: true });
    return pairing.deviceId;
  }
  public async denyPairing(code: string): Promise<boolean> {
    const pairing = this.#pairings.get(code);
    if (pairing === undefined || pairing.approved) return false;
    this.#pendingTokens.delete(code);
    this.#pairings.set(code, { ...pairing, denied: true });
    return true;
  }
  public async authorizeToken(tokenHash: string): Promise<boolean> {
    return this.#tokens.has(tokenHash);
  }
  public async rotateToken(
    currentTokenHash: string,
    replacementTokenHash: string,
  ): Promise<string | null> {
    if (!this.#tokens.delete(currentTokenHash)) return null;
    this.#tokens.add(replacementTokenHash);
    return [...this.#pairings.values()].find((pairing) => pairing.approved)?.deviceId ?? null;
  }
  public async revoke(deviceId: string): Promise<boolean> {
    const pairing = [...this.#pairings.values()].find((value) => value.deviceId === deviceId);
    if (pairing === undefined) return false;
    this.#pairings.set(pairing.code, { ...pairing, revoked: true });
    this.#tokens.clear();
    return true;
  }
}

class MemoryRateLimiter implements RateLimiter {
  public constructor(private readonly allowed = true) {}
  public async consume(): Promise<RateLimitDecision> {
    return Promise.resolve({
      allowed: this.allowed,
      remaining: this.allowed ? 9 : 0,
      retryAfterSeconds: 30,
    });
  }
}

class MemoryArtwork implements ArtworkStore {
  public async put(key: string): Promise<Response> {
    return Response.json({ data: { key } }, { status: 201 });
  }
  public async get(key: string): Promise<Response> {
    return new Response(key);
  }
  public async delete(): Promise<Response> {
    return new Response(null, { status: 204 });
  }
}

const adminToken = 'admin-test-token-with-sufficient-length';
const webhookSecret = 'webhook-test-secret';

function createFixture(rateLimiter: RateLimiter = new MemoryRateLimiter()) {
  const catalog = new MemoryCatalog();
  const devices = new MemoryDevices();
  const app = createApiApp({
    media: new MockMediaProvider({
      now: () => new Date('2026-08-17T12:00:00.000Z'),
      createId: () => 'upload-1',
    }),
    catalog,
    devices,
    rateLimiter,
    artwork: new MemoryArtwork(),
    adminToken,
    webhookSecret,
    now: () => new Date('2026-08-17T12:00:00.000Z'),
  });
  return { app, catalog, devices };
}

function adminHeaders(): HeadersInit {
  return { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
}

describe('Worker API', () => {
  it('returns health publicly but protects the private catalogue', async () => {
    const { app } = createFixture();
    expect((await app.fetch(new Request('https://api.test/health'))).status).toBe(200);
    expect((await app.fetch(new Request('https://api.test/api/catalog'))).status).toBe(401);
    expect(
      (await app.fetch(new Request('https://api.test/api/catalog', { headers: adminHeaders() })))
        .status,
    ).toBe(200);
  });

  it('validates uploads and forces private upload sessions', async () => {
    const { app } = createFixture();
    const invalid = await app.fetch(
      new Request('https://api.test/api/media/uploads', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ filename: '', maxDurationSeconds: 0 }),
      }),
    );
    expect(invalid.status).toBe(400);

    const valid = await app.fetch(
      new Request('https://api.test/api/media/uploads', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ filename: 'archive.mp4', maxDurationSeconds: 300 }),
      }),
    );
    const payload = (await valid.json()) as {
      data: { requiresSignedUrls: boolean; assetId: string };
    };
    expect(valid.status).toBe(201);
    expect(payload.data).toMatchObject({ requiresSignedUrls: true, assetId: 'upload-1' });
  });

  it('rejects unsupported Stream TTLs and stops reading oversized chunked JSON', async () => {
    const { app } = createFixture();
    const ttlResponse = await app.fetch(
      new Request('https://api.test/api/media/demo-16x9/playback', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ tokenTtlSeconds: 300 }),
      }),
    );
    expect(ttlResponse.status).toBe(400);

    let pulls = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(600 * 1024));
        if (pulls === 10) controller.close();
      },
      cancel() {
        cancelled = true;
        throw new Error('The body reader did not stop at its byte limit.');
      },
    });
    const requestInit: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      duplex: 'half',
    };
    const oversized = await app.fetch(
      new Request('https://api.test/api/devices/pairings', requestInit),
    );
    expect(oversized.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThan(10);
  });

  it('creates, approves and revokes an expiring device pairing', async () => {
    const { app } = createFixture();
    const requested = await app.fetch(
      new Request('https://api.test/api/devices/pairings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Living Room', platform: 'tvos' }),
      }),
    );
    const pairing = (await requested.json()) as { data: PairingRecord & { deviceToken: string } };
    expect(pairing.data.code).toMatch(/^[A-Z2-9]{6}$/u);
    expect(pairing.data.deviceToken).toMatch(/^[a-f0-9]{64}$/u);

    const approved = await app.fetch(
      new Request('https://api.test/api/devices/pairings/approve', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ code: pairing.data.code, userId: 'family' }),
      }),
    );
    const approval = (await approved.json()) as { data: { deviceId: string; approved: boolean } };
    expect(approval.data.approved).toBe(true);

    const authorized = await app.fetch(
      new Request('https://api.test/api/catalog', {
        headers: { authorization: `Bearer ${pairing.data.deviceToken}` },
      }),
    );
    expect(authorized.status).toBe(200);

    const rotated = await app.fetch(
      new Request('https://api.test/api/devices/token/rotate', {
        method: 'POST',
        headers: { authorization: `Bearer ${pairing.data.deviceToken}` },
      }),
    );
    const rotation = (await rotated.json()) as { data: { token: string } };
    expect(rotation.data.token).toMatch(/^[a-f0-9]{64}$/u);

    const revoked = await app.fetch(
      new Request(`https://api.test/api/devices/${approval.data.deviceId}/revoke`, {
        method: 'POST',
        headers: adminHeaders(),
      }),
    );
    expect(revoked.status).toBe(200);
  });

  it('returns a structured 429 when pairing requests exceed their D1-backed limit', async () => {
    const { app } = createFixture(new MemoryRateLimiter(false));
    const limited = await app.fetch(
      new Request('https://api.test/api/devices/pairings', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.10' },
        body: JSON.stringify({ name: 'Living Room', platform: 'tvos' }),
      }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('30');
    await expect(limited.json()).resolves.toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });

  it('verifies and de-duplicates signed Stream webhooks', async () => {
    const { app, catalog } = createFixture();
    const body = JSON.stringify({
      uid: 'stream-1',
      readyToStream: true,
      status: { state: 'ready', pctComplete: '100' },
      modified: '2026-08-17T12:00:00.000Z',
    });
    const time = Math.floor(new Date('2026-08-17T12:00:00.000Z').getTime() / 1_000);
    const signature = createHmac('sha256', webhookSecret).update(`${time}.${body}`).digest('hex');
    const request = () =>
      new Request('https://api.test/api/webhooks/cloudflare-stream', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'webhook-signature': `time=${time},sig1=${signature}`,
        },
        body,
      });
    expect((await app.fetch(request())).status).toBe(200);
    expect((await app.fetch(request())).status).toBe(200);
    expect(catalog.statusEvents).toHaveLength(1);
  });
});
