import { describe, expect, it } from 'vitest';
import {
  CloudflareStreamProvider,
  LocalMediaProvider,
  MediaProviderError,
  MockMediaProvider,
  type CloudflareStreamBindingPort,
  type MediaAsset,
  type ProviderWebhookEvent,
} from '../src/index.js';

describe('MockMediaProvider', () => {
  it('returns deterministic private playback sessions and refreshes expiry', async () => {
    const now = new Date('2026-08-17T12:00:00.000Z');
    const provider = new MockMediaProvider({ now: () => now });
    const playback = await provider.getPlayback({ assetId: 'demo-16x9', tokenTtlSeconds: 30 });

    expect(playback.url).toContain('demo-16x9.mp4');
    expect(playback.expiresAt).toBe('2026-08-17T12:00:30.000Z');
  });

  it('processes webhook events idempotently', async () => {
    const provider = new MockMediaProvider();
    const event: ProviderWebhookEvent = {
      eventId: 'evt-1',
      assetId: 'new-asset',
      status: 'ready',
      progressPercent: 100,
      occurredAt: '2026-08-17T12:00:00.000Z',
      payload: {},
    };

    expect((await provider.handleWebhook(event)).duplicate).toBe(false);
    expect((await provider.handleWebhook(event)).duplicate).toBe(true);
  });
});

describe('LocalMediaProvider', () => {
  const readyAsset: MediaAsset = {
    id: 'local-one',
    status: 'ready',
    progressPercent: 100,
    readyToStream: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    modifiedAt: '2026-01-01T00:00:00.000Z',
  };

  it('rejects absolute paths before they can reach a client bundle', () => {
    expect(
      () =>
        new LocalMediaProvider({
          records: [
            {
              ...readyAsset,
              videoPath: 'C:\\Private\\video.mp4',
              thumbnailPath: '/art/video.webp',
            },
          ],
        }),
    ).toThrow(MediaProviderError);
  });

  it('returns server-relative local playback URLs', async () => {
    const provider = new LocalMediaProvider({
      publicBaseUrl: 'http://127.0.0.1:4173',
      records: [{ ...readyAsset, videoPath: '/media/video.mp4', thumbnailPath: '/art/video.webp' }],
    });
    await expect(provider.getPlayback({ assetId: 'local-one' })).resolves.toMatchObject({
      url: 'http://127.0.0.1:4173/media/video.mp4',
      format: 'mp4',
    });
  });
});

describe('CloudflareStreamProvider', () => {
  it('creates signed-only uploads and signed HLS playback', async () => {
    const calls: unknown[] = [];
    const binding: CloudflareStreamBindingPort = {
      async createDirectUpload(params) {
        calls.push(params);
        return { id: 'stream-1', uploadURL: 'https://upload.example.test/one' };
      },
      video(assetId) {
        return {
          async details() {
            if (assetId === 'missing') throw new Error('video not found');
            return {
              id: 'stream-1',
              readyToStream: true,
              status: { state: 'ready', pctComplete: '100' },
              created: '2026-08-17T00:00:00.000Z',
              modified: '2026-08-17T00:01:00.000Z',
              duration: 60,
              input: { width: 1920, height: 1080 },
              hlsPlaybackUrl: 'https://customer.example/stream-1/manifest/video.m3u8',
              thumbnail: 'https://customer.example/stream-1/thumbnails/thumbnail.jpg',
            };
          },
          async update() {
            return this.details();
          },
          async delete() {},
          async generateToken() {
            if (assetId === 'missing') throw new Error('video not found');
            return 'signed-token';
          },
        };
      },
    };
    const provider = new CloudflareStreamProvider({
      binding,
      deliveryDomain: 'customer.example.test',
      now: () => new Date('2026-08-17T00:00:00.000Z'),
    });

    await provider.createUploadSession({ filename: 'archive.mp4', maxDurationSeconds: 300 });
    expect(calls).toEqual([expect.objectContaining({ requireSignedURLs: true })]);
    await expect(provider.getPlayback({ assetId: 'stream-1' })).resolves.toMatchObject({
      format: 'hls',
      url: 'https://customer.example.test/signed-token/manifest/video.m3u8',
    });
    await expect(
      provider.getPlayback({ assetId: 'stream-1', tokenTtlSeconds: 300 }),
    ).rejects.toMatchObject({ code: 'INVALID_CONFIGURATION', retryable: false });
    await expect(provider.getThumbnail({ assetId: 'missing' })).rejects.toMatchObject({
      code: 'ASSET_NOT_FOUND',
      retryable: false,
    });
  });
});
