import { describe, expect, it } from 'vitest';
import {
  archivePlaceholderCategories,
  archivePlaceholders,
  catalogue,
  collections,
  profiles,
} from './index';

describe('privacy-safe folder placeholder catalogue', () => {
  it('matches the private manifest structure without copying its labels', () => {
    expect(catalogue).toHaveLength(35);
    expect(catalogue.map((video) => video.title)).toEqual(
      archivePlaceholders.map((placeholder) => placeholder.title),
    );
    expect(catalogue.map((video) => video.categories[0])).toEqual(
      archivePlaceholders.map((placeholder) => placeholder.category),
    );
  });

  it('contains the four source categories in their source-derived order and counts', () => {
    expect(collections.map((collection) => collection.title)).toEqual(
      archivePlaceholderCategories.map((category) => category.name),
    );
    expect(collections.map((collection) => collection.videoIds.length)).toEqual([3, 17, 8, 7]);
  });

  it('uses only fictional ordered titles and does not invent part records', () => {
    expect(archivePlaceholderCategories.map((category) => category.movies)).toEqual([
      ['Jeugdfilm 01', 'Jeugdfilm 02', 'Jeugdfilm 03'],
      Array.from(
        { length: 17 },
        (_, index) => `Vakantiefilm ${String(index + 1).padStart(2, '0')}`,
      ),
      Array.from(
        { length: 8 },
        (_, index) => `Evenementfilm ${String(index + 1).padStart(2, '0')}`,
      ),
      Array.from({ length: 7 }, (_, index) => `Overige film ${String(index + 1).padStart(2, '0')}`),
    ]);
    expect(archivePlaceholders.every((placeholder) => placeholder.group === null)).toBe(true);
    expect(archivePlaceholders.every((placeholder) => !placeholder.title.includes('(Part'))).toBe(
      true,
    );
  });

  it('does not expose source data or claim playback is available', () => {
    expect(new Set(catalogue.map((video) => video.id)).size).toBe(catalogue.length);
    expect(
      catalogue.every(
        (video) =>
          video.processingStatus === 'unavailable' &&
          video.playbackUrl === null &&
          video.playbackAssetId === null &&
          video.sourcePath === undefined &&
          video.people.every((person) => person.startsWith('Synthetic')) &&
          video.location === 'Synthetic archive' &&
          video.description.includes('fictional catalogue-only record'),
      ),
    ).toBe(true);
    expect(profiles.every((profile) => profile.pin === undefined)).toBe(true);
    expect(profiles.map((profile) => profile.name)).toEqual([
      'Bart & Astrid',
      'Bram & Edvin',
      'Eline & Luca',
    ]);
  });
});
