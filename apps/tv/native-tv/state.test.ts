import { describe, expect, it } from 'vitest';
import { catalogue } from '@lelibrambas/catalog';
import {
  NATIVE_COLLECTIONS_LABEL,
  SPLASH_BACKGROUND_DELAY_MS,
  SPLASH_FINAL_HOLD_MS,
  SPLASH_LOGO_ANIMATION_MS,
  SPLASH_TOTAL_DURATION_MS,
  allMoviesForHome,
  createPlaybackProgress,
  formatPlaybackTimestamp,
  normalizePlaybackProgress,
  restartPlaybackProgress,
  resumableSeconds,
  splashPhaseAt,
} from './state';

describe('native tvOS splash timing', () => {
  it('keeps the logo hidden for exactly one second and holds the completed logo for three', () => {
    expect(splashPhaseAt(0)).toBe('background');
    expect(splashPhaseAt(SPLASH_BACKGROUND_DELAY_MS - 1)).toBe('background');
    expect(splashPhaseAt(SPLASH_BACKGROUND_DELAY_MS)).toBe('logo');
    expect(splashPhaseAt(SPLASH_BACKGROUND_DELAY_MS + SPLASH_LOGO_ANIMATION_MS - 1)).toBe('logo');
    expect(splashPhaseAt(SPLASH_BACKGROUND_DELAY_MS + SPLASH_LOGO_ANIMATION_MS)).toBe('hold');
    expect(SPLASH_FINAL_HOLD_MS).toBe(3000);
    expect(splashPhaseAt(SPLASH_TOTAL_DURATION_MS - 1)).toBe('hold');
    expect(splashPhaseAt(SPLASH_TOTAL_DURATION_MS)).toBe('done');
  });
});

describe('native tvOS playback progress', () => {
  it('formats minute and hour timestamps cleanly', () => {
    expect(formatPlaybackTimestamp(3312)).toBe('55:12');
    expect(formatPlaybackTimestamp(3723)).toBe('1:02:03');
    expect(formatPlaybackTimestamp(Number.NaN)).toBe('0:00');
  });

  it('only resumes meaningful unfinished progress', () => {
    expect(resumableSeconds(createPlaybackProgress('family', 'film', 4, 100))).toBe(0);
    expect(resumableSeconds(createPlaybackProgress('family', 'film', 55, 100))).toBe(55);
    expect(resumableSeconds(createPlaybackProgress('family', 'film', 94, 100))).toBe(0);
    expect(
      resumableSeconds({
        ...createPlaybackProgress('family', 'film', 40, 100),
        completed: true,
      }),
    ).toBe(0);
  });

  it('rejects invalid records and restart clears the resume position', () => {
    const invalid = normalizePlaybackProgress(
      { profileId: 'wrong', videoId: 'film', seconds: 50, durationSeconds: 100 },
      'family',
      'film',
      100,
    );
    expect(resumableSeconds(invalid)).toBe(0);

    const saved = createPlaybackProgress(
      'family',
      'film',
      55,
      100,
      new Date('2026-08-28T10:00:00.000Z'),
    );
    const restarted = restartPlaybackProgress(saved, new Date('2026-08-28T10:05:00.000Z'));
    expect(restarted.seconds).toBe(0);
    expect(restarted.completed).toBe(false);
    expect(resumableSeconds(restarted)).toBe(0);
  });
});

describe('native tvOS Home catalogue coverage', () => {
  it('uses English Collections and lists every eligible movie once in catalogue order', () => {
    const eligible = catalogue.filter((video) => video.visibility !== 'hidden');
    const allMovies = allMoviesForHome(catalogue);
    expect(NATIVE_COLLECTIONS_LABEL).toBe('Collections');
    expect(allMovies.map((video) => video.id)).toEqual(eligible.map((video) => video.id));
    expect(new Set(allMovies.map((video) => video.id)).size).toBe(allMovies.length);
  });
});
