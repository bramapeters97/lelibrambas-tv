import { describe, expect, it } from 'vitest';
import { catalogue } from '@lelibrambas/catalog';
import {
  mediaSeekTarget,
  mediaSecondsForPresentation,
  playbackAvailability,
  presentationSecondsForMedia,
} from './App';

describe('viewer playback state', () => {
  it('maps media time to catalogue presentation time without losing resume position', () => {
    const mediaTime = mediaSecondsForPresentation(900, 3600, 12);
    expect(mediaTime).toBe(3);
    expect(presentationSecondsForMedia(mediaTime, 12, 3600)).toBe(900);
  });

  it('clamps time mapping at both ends', () => {
    expect(mediaSecondsForPresentation(-20, 1200, 10)).toBe(0);
    expect(mediaSecondsForPresentation(2000, 1200, 10)).toBe(10);
    expect(presentationSecondsForMedia(20, 10, 1200)).toBe(1200);
  });

  it('skips ten live media seconds and clamps at either edge', () => {
    expect(mediaSeekTarget(14, -10, 100)).toBe(4);
    expect(mediaSeekTarget(4, -10, 100)).toBe(0);
    expect(mediaSeekTarget(96, 10, 100)).toBe(100);
    expect(mediaSeekTarget(Number.NaN, 10, null)).toBe(10);
  });

  it('distinguishes processing, failed and unavailable catalogue entries', () => {
    for (const status of ['processing', 'failed', 'unavailable'] as const) {
      const video = { ...catalogue[0]!, processingStatus: status, playbackUrl: null };
      expect(playbackAvailability(video).playable).toBe(false);
      expect(playbackAvailability(video).description.length).toBeGreaterThan(20);
    }
  });
  it('plays an unavailable catalogue entry when its details provide a video source', () => {
    const video = {
      ...catalogue[0]!,
      available: false,
      processingStatus: 'unavailable' as const,
      streamVideoId: 'https://media.example/synthetic-memory.mp4',
    };

    expect(playbackAvailability(video).playable).toBe(false);
    expect(playbackAvailability(video, true).playable).toBe(true);
  });
});
