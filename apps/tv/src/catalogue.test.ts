import { describe, expect, it } from 'vitest';
import { catalogue as seedCatalogue } from '@lelibrambas/catalog';
import { withPlaceholderPlayback } from './catalogue';

describe('viewer placeholder playback configuration', () => {
  it('applies one validated HLS test stream to every synthetic catalogue record', () => {
    const assetId = '0123456789abcdef0123456789abcdef';
    const configured = withPlaceholderPlayback(seedCatalogue, {
      assetId,
      playbackUrl: `https://customer-example.cloudflarestream.com/${assetId}/manifest/video.m3u8`,
    });

    expect(configured).toHaveLength(seedCatalogue.length);
    expect(
      configured.every(
        (video) =>
          video.processingStatus === 'ready' &&
          video.playbackProvider === 'cloudflare-stream' &&
          video.playbackAssetId === assetId &&
          video.playbackUrl?.endsWith('/manifest/video.m3u8') &&
          video.durationSeconds === 12,
      ),
    ).toBe(true);
  });

  it('keeps the safe unavailable seed when the renderer configuration is invalid', () => {
    const assetId = '0123456789abcdef0123456789abcdef';
    const configured = withPlaceholderPlayback(seedCatalogue, {
      assetId,
      playbackUrl: 'https://example.com/video.mp4',
    });

    expect(configured).toEqual(seedCatalogue);
    expect(configured).not.toBe(seedCatalogue);
    expect(
      withPlaceholderPlayback(seedCatalogue, {
        assetId: 'fedcba9876543210fedcba9876543210',
        playbackUrl: `https://customer-example.cloudflarestream.com/${assetId}/manifest/video.m3u8`,
      }),
    ).toEqual(seedCatalogue);
    expect(
      withPlaceholderPlayback(seedCatalogue, {
        assetId,
        playbackUrl: `https://customer-example.cloudflarestream.com/${assetId}/manifest/video.m3u8?token=do-not-bundle`,
      }),
    ).toEqual(seedCatalogue);
    expect(
      withPlaceholderPlayback(seedCatalogue, {
        assetId: 'eyJhbGciOiJIUzI1NiJ9.payload.signature',
        playbackUrl:
          'https://customer-example.cloudflarestream.com/eyJhbGciOiJIUzI1NiJ9.payload.signature/manifest/video.m3u8',
      }),
    ).toEqual(seedCatalogue);
  });

  it('allows only a repository-owned synthetic MP4 in deterministic E2E mode', () => {
    const configured = withPlaceholderPlayback(seedCatalogue, {
      assetId: 'synthetic-e2e-placeholder',
      format: 'mp4',
      playbackUrl: '/media/archive-16x9.mp4',
    });

    expect(configured.every((video) => video.playbackProvider === 'local')).toBe(true);
    expect(configured.every((video) => video.playbackUrl === '/media/archive-16x9.mp4')).toBe(true);
    expect(
      withPlaceholderPlayback(seedCatalogue, {
        assetId: 'unsafe-local-file',
        format: 'mp4',
        playbackUrl: '../private.mp4',
      }),
    ).toEqual(seedCatalogue);
  });
});
