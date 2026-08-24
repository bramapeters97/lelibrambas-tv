import { describe, expect, it } from 'vitest';
import {
  contentRangeValue,
  enforceArtworkByteLimit,
  normalizeArtworkKey,
  R2ArtworkAdapter,
} from '../src/r2-artwork.js';

describe('normalizeArtworkKey', () => {
  it('accepts scoped artwork keys and rejects traversal', () => {
    expect(normalizeArtworkKey('videos/stockholm/backdrop.webp')).toBe(
      'videos/stockholm/backdrop.webp',
    );
    expect(() => normalizeArtworkKey('../private.txt')).toThrow(/Invalid artwork key/u);
    expect(() => normalizeArtworkKey('C:\\private\\photo.webp')).toThrow(/Invalid artwork key/u);
  });

  it('formats explicit and suffix byte ranges for HTTP responses', () => {
    expect(contentRangeValue({ offset: 10, length: 20 }, 100)).toBe('bytes 10-29/100');
    expect(contentRangeValue({ suffix: 12 }, 100)).toBe('bytes 88-99/100');
  });

  it('counts streamed bytes instead of trusting a declared upload length', async () => {
    const megabyte = 1024 * 1024;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8 * megabyte));
        controller.enqueue(new Uint8Array(8 * megabyte));
        controller.close();
      },
    });

    await expect(new Response(enforceArtworkByteLimit(body)).arrayBuffer()).rejects.toThrow(
      /15 MB/u,
    );
  });

  it('rejects an understated Content-Length before R2 can commit the oversized object', async () => {
    const megabyte = 1024 * 1024;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8 * megabyte));
        controller.enqueue(new Uint8Array(8 * megabyte));
        controller.close();
      },
    });
    const bucket = {
      async put(_key: string, value: ReadableStream<Uint8Array>) {
        await new Response(value).arrayBuffer();
        return { httpEtag: 'should-not-commit' } as R2Object;
      },
    } as unknown as R2Bucket;
    const request = {
      body,
      headers: new Headers({ 'content-length': '1', 'content-type': 'image/webp' }),
    } as Request;

    const response = await new R2ArtworkAdapter(bucket).put('videos/poster.webp', request);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'ARTWORK_TOO_LARGE' },
    });
  });
});
