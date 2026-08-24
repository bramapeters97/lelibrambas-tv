import {
  archivePlaceholderCategories,
  catalogue as seedCatalogue,
  collections,
  homeRails,
  profiles,
} from '@lelibrambas/catalog';
import type { VideoRecord } from '@lelibrambas/types';

export interface PlaceholderPlaybackConfig {
  playbackUrl?: string;
  assetId?: string;
  format?: 'hls' | 'mp4';
}

function normalizedPlaybackConfig(
  config: PlaceholderPlaybackConfig,
): { playbackUrl: string; assetId: string; format: 'hls' | 'mp4' } | null {
  const playbackUrl = config.playbackUrl?.trim();
  const assetId = config.assetId?.trim();
  const format = config.format ?? 'hls';
  if (!playbackUrl || !assetId) return null;

  if (format === 'mp4') {
    const isSyntheticLocalAsset =
      playbackUrl.startsWith('/media/') &&
      playbackUrl.endsWith('.mp4') &&
      !playbackUrl.includes('..') &&
      !playbackUrl.includes('?') &&
      !playbackUrl.includes('#');
    return isSyntheticLocalAsset ? { playbackUrl, assetId, format } : null;
  }

  // Public Stream UIDs are 32 hexadecimal characters. Signed Stream tokens replace the UID in
  // this path and must never be accepted through a public Vite variable.
  if (!/^[a-f\d]{32}$/i.test(assetId)) return null;

  try {
    const parsed = new URL(playbackUrl);
    const hostname = parsed.hostname.toLowerCase();
    const isStreamHost =
      hostname === 'videodelivery.net' ||
      hostname.endsWith('.videodelivery.net') ||
      hostname.endsWith('.cloudflarestream.com');
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    const isHlsManifest =
      pathSegments.length === 3 &&
      pathSegments[0] === encodeURIComponent(assetId) &&
      pathSegments[1] === 'manifest' &&
      pathSegments[2] === 'video.m3u8';
    if (
      parsed.protocol !== 'https:' ||
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.port !== '' ||
      parsed.search !== '' ||
      parsed.hash !== '' ||
      !isStreamHost ||
      !isHlsManifest
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return { playbackUrl, assetId, format };
}

export function withPlaceholderPlayback(
  records: readonly VideoRecord[],
  config: PlaceholderPlaybackConfig,
): VideoRecord[] {
  const playback = normalizedPlaybackConfig(config);
  if (!playback) return [...records];

  return records.map((video) => ({
    ...video,
    durationSeconds: playback.format === 'hls' ? 12 : 16,
    aspectRatio: '16:9',
    resolution: '1920 x 1080 test stream',
    frameRate: 30,
    interlaced: false,
    processingStatus: 'ready',
    playbackProvider: playback.format === 'hls' ? 'cloudflare-stream' : 'local',
    playbackAssetId: playback.assetId,
    playbackUrl: playback.playbackUrl,
    previewStartSeconds: 0,
    restorationNotes:
      'Synthetic catalogue record using the configured public test stream as temporary playback.',
  }));
}

export const catalogue = withPlaceholderPlayback(
  seedCatalogue,
  import.meta.env.MODE === 'e2e'
    ? {
        format: 'mp4',
        playbackUrl: '/media/archive-16x9.mp4',
        assetId: 'synthetic-e2e-placeholder',
      }
    : {
        format: 'hls',
        playbackUrl: import.meta.env.VITE_STREAM_PLACEHOLDER_HLS_URL,
        assetId: import.meta.env.VITE_STREAM_PLACEHOLDER_ASSET_ID,
      },
);

export { archivePlaceholderCategories, collections, homeRails, profiles };
