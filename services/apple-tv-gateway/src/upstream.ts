import type { GatewayConfig } from './config.js';
import {
  type CatalogSourceItem,
  parseBoundedJsonResponse,
  parseCatalogPayload,
} from './contracts.js';
import { GatewayError } from './errors.js';

const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const MAX_PLAYBACK_RESPONSE_BYTES = 64 * 1024;

export interface UpstreamCatalog {
  loadCatalog(): Promise<readonly CatalogSourceItem[]>;
  playbackURL(item: CatalogSourceItem): Promise<URL>;
  artwork(
    item: CatalogSourceItem,
    kind: 'poster' | 'backdrop',
    request: Request,
  ): Promise<Response>;
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function objectValue(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export class ConfiguredUpstreamCatalog implements UpstreamCatalog {
  public constructor(
    private readonly config: GatewayConfig,
    private readonly fetchImplementation: FetchImplementation = fetch,
  ) {}

  public async loadCatalog(): Promise<readonly CatalogSourceItem[]> {
    const url = new URL(this.config.upstreamCatalogPath, this.config.upstreamOrigin);
    if (
      url.origin !== this.config.upstreamOrigin.origin ||
      url.pathname !== this.config.upstreamCatalogPath
    ) {
      throw new GatewayError(
        503,
        'UPSTREAM_CONFIGURATION',
        'The catalog service is not configured.',
      );
    }
    const response = await this.fetchUpstream(
      url,
      {
        method: 'GET',
        headers: this.upstreamHeaders({ accept: 'application/json' }),
        redirect: 'error',
      },
      'CATALOG_UNAVAILABLE',
      'The media catalog is temporarily unavailable.',
    );
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new GatewayError(
        503,
        'CATALOG_UNAVAILABLE',
        'The media catalog is temporarily unavailable.',
      );
    }
    return parseCatalogPayload(await parseBoundedJsonResponse(response, MAX_CATALOG_BYTES));
  }

  public async playbackURL(item: CatalogSourceItem): Promise<URL> {
    if (item.playbackAssetId !== null) {
      const path = `/api/media/${encodeURIComponent(item.playbackAssetId)}/playback`;
      const url = new URL(path, this.config.upstreamOrigin);
      const response = await this.fetchUpstream(
        url,
        {
          method: 'POST',
          headers: this.upstreamHeaders({
            accept: 'application/json',
            'content-type': 'application/json',
          }),
          body: JSON.stringify({ preferredFormat: 'hls', tokenTtlSeconds: 3_600 }),
          redirect: 'error',
        },
        'VIDEO_UNAVAILABLE',
        'This video is not available right now.',
      );
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        const status = response.status === 404 ? 404 : response.status === 409 ? 409 : 503;
        throw new GatewayError(
          status,
          'VIDEO_UNAVAILABLE',
          'This video is not available right now.',
        );
      }
      const payload = objectValue(
        await parseBoundedJsonResponse(response, MAX_PLAYBACK_RESPONSE_BYTES),
      );
      const data = objectValue(payload?.data);
      if (typeof data?.url !== 'string') {
        throw new GatewayError(
          502,
          'UPSTREAM_MALFORMED',
          'The playback service returned malformed data.',
        );
      }
      return this.validatePlaybackURL(data.url);
    }
    if (item.streamVideoId === null) {
      throw new GatewayError(404, 'VIDEO_UNAVAILABLE', 'This video is not available right now.');
    }
    return this.validatePlaybackURL(item.streamVideoId);
  }

  public async artwork(
    item: CatalogSourceItem,
    kind: 'poster' | 'backdrop',
    request: Request,
  ): Promise<Response> {
    const source = kind === 'poster' ? item.posterUrl : item.backdropUrl;
    if (source === null || source.length === 0) {
      throw new GatewayError(404, 'ARTWORK_NOT_FOUND', 'Artwork is not available.');
    }
    let url: URL;
    try {
      url = new URL(source, this.config.upstreamOrigin);
    } catch {
      throw new GatewayError(404, 'ARTWORK_NOT_FOUND', 'Artwork is not available.');
    }
    if (url.protocol !== 'https:' || url.origin !== this.config.upstreamOrigin.origin) {
      throw new GatewayError(404, 'ARTWORK_NOT_FOUND', 'Artwork is not available.');
    }
    const conditionalHeaders: Record<string, string> = {};
    for (const header of ['if-none-match', 'if-modified-since'] as const) {
      const value = request.headers.get(header);
      if (value !== null && value.length <= 512) conditionalHeaders[header] = value;
    }
    const response = await this.fetchUpstream(
      url,
      {
        method: 'GET',
        headers: this.upstreamHeaders(conditionalHeaders),
        redirect: 'error',
      },
      'ARTWORK_UNAVAILABLE',
      'Artwork is temporarily unavailable.',
    );
    if (!response.ok && response.status !== 304) {
      await response.body?.cancel().catch(() => undefined);
      throw new GatewayError(404, 'ARTWORK_NOT_FOUND', 'Artwork is not available.');
    }
    const headers = new Headers({
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    });
    for (const header of ['content-type', 'content-length', 'etag', 'last-modified'] as const) {
      const value = response.headers.get(header);
      if (value !== null) headers.set(header, value);
    }
    return new Response(response.body, { status: response.status, headers });
  }

  private upstreamHeaders(additional: Readonly<Record<string, string>>): Headers {
    return new Headers({
      ...additional,
      'cf-access-client-id': this.config.upstreamAccessClientId,
      'cf-access-client-secret': this.config.upstreamAccessClientSecret,
    });
  }

  private async fetchUpstream(
    input: URL,
    init: RequestInit,
    code: string,
    message: string,
  ): Promise<Response> {
    try {
      return await this.fetchImplementation(input, init);
    } catch {
      throw new GatewayError(503, code, message);
    }
  }

  private validatePlaybackURL(value: string): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new GatewayError(502, 'PLAYBACK_URL_INVALID', 'The video address is invalid.');
    }
    if (url.protocol === 'http:') url.protocol = 'https:';
    const hostname = url.hostname.toLowerCase();
    const allowed = this.config.allowedMediaHostSuffixes.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    );
    if (
      url.protocol !== 'https:' ||
      !allowed ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      throw new GatewayError(502, 'PLAYBACK_URL_INVALID', 'The video address is invalid.');
    }
    if (/\/(?:watch|iframe)\/?$/u.test(url.pathname)) {
      url.pathname = `${url.pathname.replace(/\/(?:watch|iframe)\/?$/u, '')}/manifest/video.m3u8`;
      url.search = '';
      url.hash = '';
      return url;
    }
    if (!/\.(?:m3u8|mp4)$/iu.test(url.pathname)) {
      throw new GatewayError(502, 'PLAYBACK_URL_INVALID', 'The video address is invalid.');
    }
    url.hash = '';
    return url;
  }
}
