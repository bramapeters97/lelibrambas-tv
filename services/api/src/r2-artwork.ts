import type { ArtworkStore } from './ports.js';

const MAX_ARTWORK_BYTES = 15 * 1024 * 1024;

class ArtworkTooLargeError extends Error {
  public constructor() {
    super('Artwork exceeds 15 MB.');
    this.name = 'ArtworkTooLargeError';
  }
}

export function enforceArtworkByteLimit(
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  let bytesRead = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytesRead += chunk.byteLength;
        if (bytesRead > MAX_ARTWORK_BYTES) throw new ArtworkTooLargeError();
        controller.enqueue(chunk);
      },
    }),
  );
}

function invalidKeyResponse(): Response {
  return Response.json(
    { error: { code: 'INVALID_ARTWORK_KEY', message: 'Artwork key is invalid.' } },
    { status: 400 },
  );
}

function artworkKey(value: string): string | Response {
  try {
    return normalizeArtworkKey(value);
  } catch {
    return invalidKeyResponse();
  }
}

function rangeBounds(range: R2Range, size: number): { start: number; end: number; length: number } {
  if ('suffix' in range) {
    const length = Math.min(range.suffix, size);
    return { start: size - length, end: Math.max(0, size - 1), length };
  }
  const start = range.offset ?? 0;
  const length = range.length ?? Math.max(0, size - start);
  return { start, end: Math.min(size - 1, start + length - 1), length };
}

export function contentRangeValue(range: R2Range, size: number): string {
  const { start, end } = rangeBounds(range, size);
  return `bytes ${start}-${end}/${size}`;
}

export function normalizeArtworkKey(value: string): string {
  const decoded = decodeURIComponent(value)
    .replaceAll('\\', '/')
    .replace(/^\/+|\/+$/gu, '');
  if (decoded.length === 0 || decoded.includes('..') || !/^[\p{L}\p{N}._/-]+$/u.test(decoded)) {
    throw new Error('Invalid artwork key.');
  }
  return decoded;
}

export class R2ArtworkAdapter implements ArtworkStore {
  public constructor(private readonly bucket: R2Bucket) {}

  public async put(keyInput: string, request: Request): Promise<Response> {
    const key = artworkKey(keyInput);
    if (key instanceof Response) return key;
    const contentLengthHeader = request.headers.get('content-length');
    const contentLength = contentLengthHeader === null ? Number.NaN : Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
      return Response.json(
        {
          error: {
            code: 'CONTENT_LENGTH_REQUIRED',
            message: 'A valid positive Content-Length is required for artwork uploads.',
          },
        },
        { status: 411 },
      );
    }
    if (contentLength > MAX_ARTWORK_BYTES) {
      return Response.json(
        { error: { code: 'ARTWORK_TOO_LARGE', message: 'Artwork exceeds 15 MB.' } },
        { status: 413 },
      );
    }
    const contentType = request.headers.get('content-type') ?? 'application/octet-stream';
    if (!contentType.startsWith('image/')) {
      return Response.json(
        { error: { code: 'INVALID_ARTWORK', message: 'Artwork must use an image content type.' } },
        { status: 415 },
      );
    }
    if (request.body === null) {
      return Response.json(
        { error: { code: 'EMPTY_BODY', message: 'Artwork body is required.' } },
        { status: 400 },
      );
    }
    let stored: R2Object | null;
    try {
      stored = await this.bucket.put(key, enforceArtworkByteLimit(request.body), {
        httpMetadata: { contentType },
      });
    } catch (error) {
      if (error instanceof ArtworkTooLargeError) {
        return Response.json(
          { error: { code: 'ARTWORK_TOO_LARGE', message: error.message } },
          { status: 413 },
        );
      }
      throw error;
    }
    if (stored === null) {
      return Response.json(
        { error: { code: 'R2_PRECONDITION', message: 'Artwork was not stored.' } },
        { status: 409 },
      );
    }
    return Response.json({ data: { key, etag: stored.httpEtag } }, { status: 201 });
  }

  public async get(keyInput: string, request: Request): Promise<Response> {
    const key = artworkKey(keyInput);
    if (key instanceof Response) return key;
    const object = await this.bucket.get(key, { range: request.headers });
    if (object === null) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Artwork not found.' } },
        { status: 404 },
      );
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('cache-control', 'private, max-age=3600');
    headers.set('accept-ranges', 'bytes');
    if (object.range !== undefined) {
      const { length } = rangeBounds(object.range, object.size);
      headers.set('content-range', contentRangeValue(object.range, object.size));
      headers.set('content-length', String(length));
      return new Response(object.body, { status: 206, headers });
    }
    headers.set('content-length', String(object.size));
    return new Response(object.body, { status: 200, headers });
  }

  public async delete(keyInput: string): Promise<Response> {
    const key = artworkKey(keyInput);
    if (key instanceof Response) return key;
    await this.bucket.delete(key);
    return new Response(null, { status: 204 });
  }
}
