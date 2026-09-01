import { describe, expect, it } from 'vitest';
import generatedCatalog from '../../../data/media_catalog.json';
import {
  catalogue,
  catalogueCategories,
  collections,
  createCatalogue,
  parseMediaCatalog,
} from './index';

describe('generated media catalogue', () => {
  it('contains exactly one viewer record per generated JSON item in numeric id order', () => {
    expect(catalogue).toHaveLength(generatedCatalog.length);
    expect(catalogue.map((video) => video.catalogueId)).toEqual(
      generatedCatalog.map((record) => record.id),
    );
    expect(catalogue.map((video) => video.title)).toEqual(
      generatedCatalog.map((record) => record.title),
    );
    expect(catalogue.map((video) => video.description)).toEqual(
      generatedCatalog.map((record) => record.description),
    );
  });

  it('uses the four generated category labels and counts', () => {
    expect(collections.map((collection) => collection.title)).toEqual([
      'JEUGDFILMS',
      'VAKANTIEFILMS',
      'EVENTS',
      'OTHERS',
    ]);
    expect(collections.map((collection) => collection.videoIds.length)).toEqual([2, 19, 9, 9]);
    expect(catalogueCategories.flatMap((category) => category.movies)).toHaveLength(
      generatedCatalog.length,
    );
  });

  it('uses the requested category and local poster mappings', () => {
    expect(catalogue.find((video) => video.catalogueId === 3)?.categories).toEqual([
      'VAKANTIEFILMS',
    ]);
    expect(catalogue.find((video) => video.catalogueId === 10)?.posterUrl).toBe(
      'artwork/mas_patoxas_spain.png',
    );
    expect(catalogue.find((video) => video.catalogueId === 14)?.posterUrl).toBe(
      'artwork/val_thorens_france.png',
    );
    expect(catalogue.find((video) => video.catalogueId === 40)?.posterUrl).toBe(
      'artwork/doortje_guusje.png',
    );
  });

  it('keeps runtime unknown when the canonical catalogue does not provide it', () => {
    expect(catalogue.every((video) => video.durationSeconds === null)).toBe(true);
  });

  it('preserves every exact stream URL on the selected catalogue record', () => {
    for (const [index, video] of catalogue.entries()) {
      expect(video.streamVideoId).toBe(generatedCatalog[index]?.stream_video_id);
      expect(video.playbackUrl).toBe(video.streamVideoId);
    }
  });

  it('rejects malformed or duplicate JSON instead of substituting mock movies', () => {
    expect(() => parseMediaCatalog({})).toThrow(/JSON array/);
    expect(() =>
      createCatalogue([
        generatedCatalog[0],
        { ...generatedCatalog[1], id: generatedCatalog[0]?.id },
      ]),
    ).toThrow(/repeats id/);
    expect(() => createCatalogue([{ ...generatedCatalog[0], available: 2 }])).toThrow(
      /invalid binary available/,
    );
  });

  it('normalizes the three binary catalogue controls', () => {
    const [video] = createCatalogue([
      { ...generatedCatalog[0], featured: 1, priority: 1, available: 0 },
    ]);
    expect(video).toMatchObject({
      featured: true,
      priority: true,
      available: false,
      processingStatus: 'unavailable',
    });
  });
});
