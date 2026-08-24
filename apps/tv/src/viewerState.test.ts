import { describe, expect, it } from 'vitest';
import { catalogue } from '@lelibrambas/catalog';
import {
  mediaSecondsForPresentation,
  nextPlayableVideo,
  playbackAvailability,
  presentationSecondsForMedia,
} from './App';

describe('viewer playback state', () => {
  it('maps synthetic demo time to catalogue time without losing resume position', () => {
    const mediaTime = mediaSecondsForPresentation(900, 3600, 12);
    expect(mediaTime).toBe(3);
    expect(presentationSecondsForMedia(mediaTime, 12, 3600)).toBe(900);
  });

  it('clamps time mapping at both ends', () => {
    expect(mediaSecondsForPresentation(-20, 1200, 10)).toBe(0);
    expect(mediaSecondsForPresentation(2000, 1200, 10)).toBe(10);
    expect(presentationSecondsForMedia(20, 10, 1200)).toBe(1200);
  });

  it('distinguishes processing, failed and unavailable catalogue entries', () => {
    for (const status of ['processing', 'failed', 'unavailable'] as const) {
      const video = { ...catalogue[0]!, processingStatus: status, playbackUrl: null };
      expect(playbackAvailability(video).playable).toBe(false);
      expect(playbackAvailability(video).description.length).toBeGreaterThan(20);
    }
  });

  it('does not offer an unavailable folder placeholder as Up Next', () => {
    const next = nextPlayableVideo(catalogue[0]!);
    expect(next).toBeNull();
  });
});
