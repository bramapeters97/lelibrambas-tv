import { describe, expect, it, vi } from 'vitest';
import generatedCatalog from '../../../data/media_catalog.json';
import {
  DEFAULT_MOVIES_API_URL,
  catalogueRequestUrl,
  featuredCatalogue,
  loadCatalogue,
  moviesApiRequestUrl,
} from './catalogue';
import {
  applyPosterFallback,
  FALLBACK_POSTER,
  resolveNativePlaybackSource,
  resolvePlaybackSource,
  resolvePosterUrl,
} from './media';

const apiMovies = [
  {
    id: '20',
    title: 'Second synthetic movie',
    year: 2025,
    description: 'A synthetic API test record.',
    category: 'EVENTS',
    poster_url: 'https://images.example/second.png',
    stream_video_id: 'https://media.example/second.mp4',
    created_at: '2026-08-28T10:00:00.000Z',
    featured: 1,
    priority: 0,
    available: 1,
  },
  {
    id: '10',
    title: 'First synthetic movie',
    year: 2024,
    description: 'Another synthetic API test record.',
    category: 'EVENTS',
    poster_url: 'https://images.example/first.png',
    stream_video_id: 'https://media.example/first.mp4',
    created_at: '2026-08-27T10:00:00.000Z',
    featured: 1,
    priority: 2,
    available: 0,
  },
];

const priorityMovies = [
  { ...apiMovies[0], id: '1', title: 'Ordinary', priority: 0 },
  { ...apiMovies[0], id: '2', title: 'Coming soon', priority: -1 },
  { ...apiMovies[0], id: '3', title: 'Priority', priority: 1 },
  { ...apiMovies[0], id: '4', title: 'Top priority', priority: 2 },
];

describe('runtime catalogue loading and media resolution', () => {
  it('orders priority 2 first and unreleased priority -1 last', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(priorityMovies))) as typeof fetch;
    const loaded = await loadCatalogue(
      fetcher,
      'https://example.test/',
      'https://api.example.test/movies',
    );
    expect(loaded.catalogue.map((video) => video.priority)).toEqual([2, 1, 0, -1]);
  });

  it('loads API flags and puts priority titles first in the catalogue and category', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(apiMovies))) as typeof fetch;
    const loaded = await loadCatalogue(
      fetcher,
      'https://example.test/nested/route',
      'https://api.example.test/movies',
    );
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/movies', {
      cache: 'no-store',
    });
    expect(loaded.source).toBe('api');
    expect(loaded.catalogue.map((video) => video.catalogueId)).toEqual([10, 20]);
    expect(loaded.collections[0]?.videoIds).toEqual(['10', '20']);
    expect(loaded.catalogue[0]).toMatchObject({
      posterUrl: apiMovies[1]?.poster_url,
      streamVideoId: apiMovies[1]?.stream_video_id,
      addedDate: apiMovies[1]?.created_at,
      featured: true,
      priority: 2,
      available: false,
      processingStatus: 'unavailable',
    });
    expect(featuredCatalogue(loaded.catalogue).map((video) => video.catalogueId)).toEqual([
      10, 20,
    ]);
  });

  it('falls back to the generated local catalogue when the API request fails', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(generatedCatalog))) as typeof fetch;
    const loaded = await loadCatalogue(
      fetcher,
      'https://example.test/nested/route',
      'https://api.example.test/movies',
    );
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://example.test/data/media_catalog.json', {
      cache: 'no-store',
    });
    expect(loaded.source).toBe('fallback');
    expect(loaded.catalogue).toHaveLength(generatedCatalog.length);
  });

  it('falls back when the API response is not an array or has invalid fields', async () => {
    for (const invalidPayload of [{ movies: apiMovies }, [{ ...apiMovies[0], created_at: null }]]) {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(invalidPayload)))
        .mockResolvedValueOnce(new Response(JSON.stringify(generatedCatalog))) as typeof fetch;
      const loaded = await loadCatalogue(
        fetcher,
        'https://example.test/',
        'https://api.example.test/movies',
      );
      expect(loaded.source).toBe('fallback');
    }
  });

  it('falls back when the API response is not valid JSON', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('{not-json'))
      .mockResolvedValueOnce(new Response(JSON.stringify(generatedCatalog))) as typeof fetch;
    const loaded = await loadCatalogue(
      fetcher,
      'https://example.test/',
      'https://api.example.test/movies',
    );
    expect(loaded.source).toBe('fallback');
  });

  it('fetches fresh API data again on a new application load', async () => {
    const updatedMovies = [{ ...apiMovies[0], title: 'Updated synthetic movie' }];
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(apiMovies)))
      .mockResolvedValueOnce(new Response(JSON.stringify(updatedMovies))) as typeof fetch;
    const firstLoad = await loadCatalogue(
      fetcher,
      'https://example.test/',
      'https://api.example.test/movies',
    );
    const refreshedLoad = await loadCatalogue(
      fetcher,
      'https://example.test/',
      'https://api.example.test/movies',
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(firstLoad.catalogue[0]?.title).toBe('Second synthetic movie');
    expect(refreshedLoad.catalogue[0]?.title).toBe('Updated synthetic movie');
  });

  it('uses an origin-root fallback URL so nested routes do not alter asset paths', () => {
    expect(catalogueRequestUrl('http://127.0.0.1:5173/library/details/7')).toBe(
      'http://127.0.0.1:5173/data/media_catalog.json',
    );
    expect(catalogueRequestUrl('lelibrambas://app/index.html')).toBe(
      'lelibrambas://app/data/media_catalog.json',
    );
  });

  it('uses one configurable API URL with the production endpoint as its default', () => {
    expect(moviesApiRequestUrl(' https://api.example.test/movies ')).toBe(
      'https://api.example.test/movies',
    );
    expect(moviesApiRequestUrl('')).toBe(DEFAULT_MOVIES_API_URL);
  });

  it('reports an error only when both the API and local fallback fail', async () => {
    const fetcher = vi.fn(async () => new Response('missing', { status: 404 })) as typeof fetch;
    await expect(
      loadCatalogue(fetcher, 'https://example.test/', 'https://api.example.test/movies'),
    ).rejects.toThrow(/Movies API failed.*local fallback failed/);
  });

  it('resolves local, remote, and failed poster images through one fallback contract', () => {
    expect(resolvePosterUrl('artwork/Poster.png')).toBe('/artwork/Poster.png');
    expect(resolvePosterUrl('https://images.example/poster.png')).toBe(
      'https://images.example/poster.png',
    );
    expect(resolvePosterUrl()).toBe(`/${FALLBACK_POSTER}`);
    const image = { dataset: {}, src: '' } as unknown as HTMLImageElement;
    applyPosterFallback(image);
    expect(image.src).toBe(`/${FALLBACK_POSTER}`);
    applyPosterFallback(image);
    expect(image.dataset.fallbackApplied).toBe('true');
  });

  it('keeps Stream iframe compatibility and derives HLS for app-owned controls', () => {
    const source = resolvePlaybackSource(generatedCatalog[0]?.stream_video_id);
    expect(source.kind).toBe('iframe');
    expect(source.originalUrl).toBe(generatedCatalog[0]?.stream_video_id);
    expect(source.url).toMatch(/\/iframe$/);
    expect(source.tvosCompatible).toBe(false);
    const autoplaySource = resolvePlaybackSource(generatedCatalog[0]?.stream_video_id, {
      autoplay: true,
    });
    expect(autoplaySource.url).toMatch(/\/iframe\?autoplay=true$/);
    const controlledSource = resolvePlaybackSource(generatedCatalog[0]?.stream_video_id, {
      preferDirectHls: true,
    });
    expect(controlledSource.kind).toBe('hls');
    expect(controlledSource.url).toMatch(/\/manifest\/video\.m3u8$/);
    expect(controlledSource.originalUrl).toBe(generatedCatalog[0]?.stream_video_id);
    expect(controlledSource.tvosCompatible).toBe(true);
    const nativeSource = resolveNativePlaybackSource(generatedCatalog[0]?.stream_video_id);
    expect(nativeSource.kind).toBe('hls');
    expect(nativeSource.url).toMatch(/\/manifest\/video\.m3u8$/);
    expect(nativeSource.tvosCompatible).toBe(true);
  });

  it('recognizes direct MP4 and rejects unrelated page URLs', () => {
    expect(resolvePlaybackSource('https://media.example/movie.mp4').kind).toBe('mp4');
    expect(resolvePlaybackSource('https://example.com/movie').kind).toBe('unsupported');
  });
});
