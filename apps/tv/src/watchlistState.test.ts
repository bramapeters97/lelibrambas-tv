import { describe, expect, it } from 'vitest';
import type { Profile } from '@lelibrambas/types';
import { mergeWatchlistIds, watchlistStorageFor } from './Discovery';

const profile: Profile = {
  id: 'family',
  name: 'Family',
  initials: 'LB',
  accent: '#E9C778',
  watchlist: ['seed-one', 'seed-two'],
  recentlyDiscovered: [],
};

describe('profile watchlist state', () => {
  it('merges legacy additions with seeded items without duplicates', () => {
    expect(mergeWatchlistIds(profile.watchlist, ['added', 'seed-one'])).toEqual([
      'seed-one',
      'seed-two',
      'added',
    ]);
  });

  it('uses removal tombstones so seeded items can still be toggled off', () => {
    expect(mergeWatchlistIds(profile.watchlist, ['added'], ['seed-two'])).toEqual([
      'seed-one',
      'added',
    ]);
  });

  it('stores additions and seeded removals independently', () => {
    expect(watchlistStorageFor(profile, ['seed-two', 'added'])).toEqual({
      added: ['added'],
      removed: ['seed-one'],
    });
  });
});
