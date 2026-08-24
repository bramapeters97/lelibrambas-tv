import { describe, expect, it, vi } from 'vitest';
import generatedCatalog from '../../../data/media_catalog.json';
import { catalogueRequestUrl, loadCatalogue } from './catalogue';
import {
  applyPosterFallback,
  FALLBACK_POSTER,
  resolveNativePlaybackSource,
  resolvePlaybackSource,
  resolvePosterUrl,
} from './media';

describe('runtime catalogue loading and media resolution', () => {
  it('loads exactly the generated JSON rows without placeholder fallback data', async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify(generatedCatalog)),
    ) as typeof fetch;
    const loaded = await loadCatalogue(fetcher, 'https://example.test/nested/route');
    expect(fetcher).toHaveBeenCalledWith('https://example.test/data/media_catalog.json', {
      cache: 'no-store',
    });
    expect(loaded.catalogue).toHaveLength(generatedCatalog.length);
    expect(loaded.catalogue.map((video) => video.catalogueId)).toEqual(
      generatedCatalog.map((record) => record.id),
    );
  });

  it('uses an origin-root catalogue URL so nested routes do not alter asset paths', () => {
    expect(catalogueRequestUrl('http://127.0.0.1:5173/library/details/7')).toBe(
      'http://127.0.0.1:5173/data/media_catalog.json',
    );
    expect(catalogueRequestUrl('lelibrambas://app/index.html')).toBe(
      'lelibrambas://app/data/media_catalog.json',
    );
  });

  it('does not substitute mock records when loading fails', async () => {
    const fetcher = vi.fn(async () => new Response('missing', { status: 404 })) as typeof fetch;
    await expect(loadCatalogue(fetcher, 'https://example.test/')).rejects.toThrow(/HTTP 404/);
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

  it('uses a secure Stream iframe on web and derives the documented HLS manifest for native', () => {
    const source = resolvePlaybackSource(generatedCatalog[0]?.stream_video_id);
    expect(source.kind).toBe('iframe');
    expect(source.originalUrl).toBe(generatedCatalog[0]?.stream_video_id);
    expect(source.url).toMatch(/\/iframe$/);
    expect(source.tvosCompatible).toBe(false);
    const autoplaySource = resolvePlaybackSource(generatedCatalog[0]?.stream_video_id, {
      autoplay: true,
    });
    expect(autoplaySource.url).toMatch(/\/iframe\?autoplay=true$/);
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
