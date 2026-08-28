import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { catalogue, profiles } from '@lelibrambas/catalog';
import { setStored, writeProgress } from '@lelibrambas/shared';
import {
  DETAILS_PREVIEW_DELAY_MS,
  DETAILS_PREVIEW_START_SECONDS,
  HERO_IDLE_DELAY_MS,
  HOME_PREVIEW_START_SECONDS,
  homeTrailerFor,
  knownDuration,
  recentlyWatchedFor,
} from './App';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('home progress state', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('sorts recently watched movies per profile and honours disabled history', () => {
    const profile = profiles[0]!;
    const otherProfile = profiles[1]!;
    const older = catalogue[0]!;
    const newer = catalogue[1]!;

    writeProgress({
      profileId: profile.id,
      videoId: older.id,
      seconds: 20,
      durationSeconds: 120,
      completed: false,
      updatedAt: '2026-08-24T10:00:00.000Z',
    });
    writeProgress({
      profileId: profile.id,
      videoId: newer.id,
      seconds: 75,
      durationSeconds: 120,
      completed: false,
      updatedAt: '2026-08-24T11:00:00.000Z',
    });
    writeProgress({
      profileId: otherProfile.id,
      videoId: catalogue[2]!.id,
      seconds: 40,
      durationSeconds: 120,
      completed: false,
      updatedAt: '2026-08-24T12:00:00.000Z',
    });

    expect(recentlyWatchedFor(profile, catalogue).map(({ video }) => video.id)).toEqual([
      newer.id,
      older.id,
    ]);

    setStored('remember-progress', false);
    expect(recentlyWatchedFor(profile, catalogue)).toEqual([]);
  });

  it('does not invent a catalogue duration', () => {
    const video = catalogue[0]!;
    expect(knownDuration(video)).toBeNull();
    expect(knownDuration({ ...video, durationSeconds: 125 })).toBe(125);
  });

  it('keeps the ambient preview timing contract explicit', () => {
    expect(HERO_IDLE_DELAY_MS).toBe(2000);
    expect(DETAILS_PREVIEW_DELAY_MS).toBe(1000);
    expect(HOME_PREVIEW_START_SECONDS).toBe(40);
    expect(DETAILS_PREVIEW_START_SECONDS).toBeGreaterThanOrEqual(120);
  });

  it('selects the 2026 trailer by its stable catalogue identity', () => {
    const fallback = catalogue[0]!;
    const trailer = catalogue.find((video) => video.catalogueId === 36)!;

    expect(
      homeTrailerFor([fallback, { ...trailer, title: 'lelibrambas_trailer(2026)' }]),
    ).toMatchObject({
      catalogueId: 36,
      year: 2026,
    });
  });
});
