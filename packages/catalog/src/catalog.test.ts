import { describe, expect, it } from 'vitest';
import { archivePlaceholderCategories, archivePlaceholders, catalogue, collections } from './index';

describe('folder placeholder catalogue', () => {
  it('matches the folder-only manifest exactly', () => {
    expect(catalogue).toHaveLength(32);
    expect(catalogue.map((video) => video.title)).toEqual(
      archivePlaceholders.map((placeholder) => placeholder.title),
    );
    expect(catalogue.map((video) => video.categories[0])).toEqual(
      archivePlaceholders.map((placeholder) => placeholder.category),
    );
  });

  it('contains exactly the four top-level folder categories', () => {
    expect(collections.map((collection) => collection.title)).toEqual(
      archivePlaceholderCategories.map((category) => category.name),
    );
    expect(collections.map((collection) => collection.videoIds.length)).toEqual([10, 11, 7, 4]);
  });

  it('preserves the nested JEUGDFILMS directory shape', () => {
    expect(
      archivePlaceholders
        .filter((placeholder) => placeholder.category === 'JEUGDFILMS')
        .map((placeholder) => placeholder.directory),
    ).toEqual([
      ['JEUGDFILMS', 'Eline Maria Peters', 'Eline Maria Peters (Part 1)'],
      ['JEUGDFILMS', 'Eline Maria Peters', 'Eline Maria Peters (Part 2)'],
      ['JEUGDFILMS', 'Eline Maria Peters', 'Eline Maria Peters (Part 3)'],
      ['JEUGDFILMS', 'Eline Maria Peters', 'Eline Maria Peters (Part 4)'],
      ['JEUGDFILMS', 'Bram Albertus Peters', 'Bram Albertus Peters (Part 1)'],
      ['JEUGDFILMS', 'Bram Albertus Peters', 'Bram Albertus Peters (Part 2)'],
      ['JEUGDFILMS', 'Bram Albertus Peters', 'Bram Albertus Peters (Part 3)'],
      ['JEUGDFILMS', 'Zomervakanties', 'Zomervakanties (Part 1)'],
      ['JEUGDFILMS', 'Zomervakanties', 'Zomervakanties (Part 2)'],
      ['JEUGDFILMS', 'Zomervakanties', 'Zomervakanties (Part 3)'],
    ]);
  });

  it('does not claim media was inspected or expose a source path', () => {
    expect(new Set(catalogue.map((video) => video.id)).size).toBe(catalogue.length);
    expect(
      catalogue.every(
        (video) =>
          video.processingStatus === 'unavailable' &&
          video.playbackUrl === null &&
          video.playbackAssetId === null &&
          video.sourcePath === undefined &&
          video.description.includes('synthetic placeholders'),
      ),
    ).toBe(true);
  });
});
