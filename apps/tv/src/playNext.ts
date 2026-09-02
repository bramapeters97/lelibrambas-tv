import type { CatalogueVideoRecord } from './catalogue';
import { resolvePlaybackSource } from './media';

export const PLAY_NEXT_REVEAL_SECONDS = 15;

function normalizedCategories(video: CatalogueVideoRecord): Set<string> {
  return new Set(
    video.categories.map((category) => category.trim().toLocaleUpperCase()).filter(Boolean),
  );
}

function sharesCategory(
  currentCategories: ReadonlySet<string>,
  candidate: CatalogueVideoRecord,
): boolean {
  return candidate.categories.some((category) =>
    currentCategories.has(category.trim().toLocaleUpperCase()),
  );
}

function playbackIdentity(video: CatalogueVideoRecord): string {
  const source = video.streamVideoId.trim();
  try {
    const url = new URL(source);
    const hostname = url.hostname.toLocaleLowerCase();
    const assetId = video.playbackAssetId?.trim();
    if (
      assetId &&
      (hostname === 'videodelivery.net' ||
        hostname.endsWith('.videodelivery.net') ||
        hostname.endsWith('.cloudflarestream.com'))
    ) {
      return `asset:${assetId.toLocaleLowerCase()}`;
    }
    url.hash = '';
    url.search = '';
    return `source:${url.toString().toLocaleLowerCase()}`;
  } catch {
    return `record:${video.catalogueId}`;
  }
}

export function isPlayableRecommendation(video: CatalogueVideoRecord): boolean {
  if (
    !video.available ||
    video.priority === -1 ||
    video.processingStatus !== 'ready' ||
    video.visibility === 'hidden' ||
    !video.streamVideoId.trim()
  ) {
    return false;
  }

  return resolvePlaybackSource(video.streamVideoId).kind !== 'unsupported';
}

export function playNextCandidates(
  current: CatalogueVideoRecord,
  records: readonly CatalogueVideoRecord[],
): CatalogueVideoRecord[] {
  const currentCategories = normalizedCategories(current);
  if (currentCategories.size === 0) return [];

  const currentIdentity = playbackIdentity(current);
  const unique = new Map<string, CatalogueVideoRecord>();
  for (const candidate of records) {
    const identity = playbackIdentity(candidate);
    if (
      candidate.id === current.id ||
      candidate.catalogueId === current.catalogueId ||
      identity === currentIdentity ||
      !sharesCategory(currentCategories, candidate) ||
      !isPlayableRecommendation(candidate) ||
      unique.has(identity)
    ) {
      continue;
    }
    unique.set(identity, candidate);
  }
  return [...unique.values()];
}

export function selectPlayNextVideo(
  current: CatalogueVideoRecord,
  records: readonly CatalogueVideoRecord[],
  random: () => number = Math.random,
): CatalogueVideoRecord | null {
  const candidates = playNextCandidates(current, records);
  if (candidates.length === 0) return null;

  const randomValue = random();
  const normalizedRandom = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 1 - Number.EPSILON)
    : 0;
  return candidates[Math.floor(normalizedRandom * candidates.length)] ?? candidates[0]!;
}

export function shouldRevealPlayNext(
  currentTime: number,
  duration: number,
  thresholdSeconds = PLAY_NEXT_REVEAL_SECONDS,
): boolean {
  if (
    !Number.isFinite(currentTime) ||
    !Number.isFinite(duration) ||
    !Number.isFinite(thresholdSeconds) ||
    currentTime < 0 ||
    duration <= 0 ||
    thresholdSeconds < 0
  ) {
    return false;
  }

  const remaining = duration - currentTime;
  return remaining >= 0 && remaining <= thresholdSeconds;
}
