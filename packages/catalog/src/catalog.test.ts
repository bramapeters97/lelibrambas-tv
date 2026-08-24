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
    expect(collections.map((collection) => collection.videoIds.length)).toEqual([3, 18, 9, 9]);
    expect(catalogueCategories.flatMap((category) => category.movies)).toHaveLength(
      generatedCatalog.length,
    );
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
  });
});
