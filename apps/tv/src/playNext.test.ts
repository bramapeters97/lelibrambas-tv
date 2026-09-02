import { describe, expect, it, vi } from 'vitest';
import { catalogue, type CatalogueVideoRecord } from '@lelibrambas/catalog';
import {
  isPlayableRecommendation,
  playNextCandidates,
  selectPlayNextVideo,
  shouldRevealPlayNext,
} from './playNext';

const seed = catalogue[0]!;

function movie(
  catalogueId: number,
  overrides: Partial<CatalogueVideoRecord> = {},
): CatalogueVideoRecord {
  return {
    ...seed,
    catalogueId,
    id: String(catalogueId),
    slug: `synthetic-movie-${catalogueId}`,
    title: `Synthetic movie ${catalogueId}`,
    categories: ['EVENTS'],
    collectionId: 'events',
    location: 'EVENTS',
    streamVideoId: `https://media.example/${catalogueId}.mp4`,
    playbackAssetId: `synthetic-${catalogueId}`,
    playbackUrl: `https://media.example/${catalogueId}.mp4`,
    available: true,
    priority: 0,
    processingStatus: 'ready',
    visibility: 'family',
    ...overrides,
  };
}

describe('Play Next recommendation selection', () => {
  it('selects one random different playable movie from the same category', () => {
    const current = movie(100);
    const candidates = [movie(101), movie(102), movie(103)];
    const random = vi.fn(() => 0.6);

    expect(selectPlayNextVideo(current, [current, ...candidates], random)?.catalogueId).toBe(102);
    expect(random).toHaveBeenCalledOnce();
  });

  it('excludes unavailable, coming-soon, hidden, failed, invalid, and other-category records', () => {
    const current = movie(200);
    const eligible = movie(201);
    const records = [
      current,
      eligible,
      movie(202, { available: false }),
      movie(203, { priority: -1 }),
      movie(204, { visibility: 'hidden' }),
      movie(205, { processingStatus: 'failed' }),
      movie(206, { streamVideoId: '' }),
      movie(207, { streamVideoId: 'https://media.example/watch-page' }),
      movie(208, { categories: ['VAKANTIEFILMS'], collectionId: 'vakantiefilms' }),
    ];

    expect(playNextCandidates(current, records)).toEqual([eligible]);
    expect(isPlayableRecommendation(eligible)).toBe(true);
    expect(isPlayableRecommendation(records[2]!)).toBe(false);
    expect(isPlayableRecommendation(records[3]!)).toBe(false);
    expect(isPlayableRecommendation(records[4]!)).toBe(false);
    expect(isPlayableRecommendation(records[5]!)).toBe(false);
    expect(isPlayableRecommendation(records[6]!)).toBe(false);
    expect(isPlayableRecommendation(records[7]!)).toBe(false);
  });

  it('deduplicates repeated playback assets and never recommends a duplicate of the current video', () => {
    const current = movie(300);
    const first = movie(301);
    const duplicateCandidate = movie(302, {
      playbackAssetId: first.playbackAssetId,
      streamVideoId: first.streamVideoId,
    });
    const duplicateCurrent = movie(303, {
      playbackAssetId: current.playbackAssetId,
      streamVideoId: current.streamVideoId,
    });

    expect(
      playNextCandidates(current, [current, first, duplicateCandidate, duplicateCurrent]),
    ).toEqual([first]);
  });

  it('returns no recommendation when the category has no other eligible movie', () => {
    const current = movie(400);
    expect(
      selectPlayNextVideo(current, [
        current,
        movie(401, { priority: -1 }),
        movie(402, { available: false }),
      ]),
    ).toBeNull();
  });

  it('uses real media timing to reveal at fifteen seconds remaining and rejects invalid timing', () => {
    expect(shouldRevealPlayNext(84.99, 100)).toBe(false);
    expect(shouldRevealPlayNext(85, 100)).toBe(true);
    expect(shouldRevealPlayNext(100, 100)).toBe(true);
    expect(shouldRevealPlayNext(101, 100)).toBe(false);
    expect(shouldRevealPlayNext(10, Number.NaN)).toBe(false);
    expect(shouldRevealPlayNext(10, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
