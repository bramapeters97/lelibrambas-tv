import {
  MediaProviderError,
  type MediaAsset,
  type MediaProvider,
  type PlaybackRequest,
  type PlaybackSession,
  type ProviderWebhookEvent,
  type ReplacementSession,
  type ThumbnailRequest,
  type UploadSession,
  type UploadSessionRequest,
  type WebhookReceipt,
} from './types.js';

export interface MockMediaProviderOptions {
  readonly assets?: readonly MediaAsset[];
  readonly now?: () => Date;
  readonly createId?: () => string;
  readonly mediaBaseUrl?: string;
}

const DEFAULT_ASSETS: readonly MediaAsset[] = [
  {
    id: 'demo-16x9',
    status: 'ready',
    progressPercent: 100,
    readyToStream: true,
    durationSeconds: 90,
    width: 1920,
    height: 1080,
    createdAt: '2026-01-01T00:00:00.000Z',
    modifiedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'demo-4x3',
    status: 'ready',
    progressPercent: 100,
    readyToStream: true,
    durationSeconds: 60,
    width: 720,
    height: 576,
    createdAt: '2026-01-01T00:00:00.000Z',
    modifiedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'demo-processing',
    status: 'processing',
    progressPercent: 42,
    readyToStream: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    modifiedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'demo-unavailable',
    status: 'unavailable',
    progressPercent: 0,
    readyToStream: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    modifiedAt: '2026-01-01T00:00:00.000Z',
  },
];

export class MockMediaProvider implements MediaProvider {
  public readonly kind = 'mock' as const;
  readonly #assets = new Map<string, MediaAsset>();
  readonly #processedEvents = new Set<string>();
  readonly #now: () => Date;
  readonly #createId: () => string;
  readonly #mediaBaseUrl: string;

  public constructor(options: MockMediaProviderOptions = {}) {
    this.#now = options.now ?? (() => new Date());
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#mediaBaseUrl = (options.mediaBaseUrl ?? '/demo-media').replace(/\/$/u, '');
    for (const asset of options.assets ?? DEFAULT_ASSETS) {
      this.#assets.set(asset.id, { ...asset });
    }
  }

  public async createUploadSession(request: UploadSessionRequest): Promise<UploadSession> {
    const id = this.#createId();
    const timestamp = this.#now().toISOString();
    this.#assets.set(id, {
      id,
      status: 'awaiting-upload',
      progressPercent: 0,
      readyToStream: false,
      createdAt: timestamp,
      modifiedAt: timestamp,
    });
    return Promise.resolve({
      assetId: id,
      uploadUrl: `mock://upload/${encodeURIComponent(id)}/${encodeURIComponent(request.filename)}`,
      protocol: 'mock',
      requiresSignedUrls: true,
      ...(request.expiresAt === undefined ? {} : { expiresAt: request.expiresAt }),
    });
  }

  public async getUploadStatus(assetId: string): Promise<MediaAsset> {
    return Promise.resolve({ ...this.#requireAsset(assetId) });
  }

  public async getPlayback(request: PlaybackRequest): Promise<PlaybackSession> {
    const asset = this.#requireAsset(request.assetId);
    if (asset.status === 'unavailable' || asset.status === 'deleted') {
      throw new MediaProviderError(
        'The requested video is unavailable.',
        'ASSET_UNAVAILABLE',
        false,
      );
    }
    if (!asset.readyToStream || asset.status !== 'ready') {
      throw new MediaProviderError(
        'The requested video is still processing.',
        'ASSET_NOT_READY',
        true,
      );
    }
    const format = request.preferredFormat ?? 'mp4';
    const ttlSeconds = request.tokenTtlSeconds ?? 300;
    const expiresAt = new Date(this.#now().getTime() + ttlSeconds * 1_000).toISOString();
    const extension = format === 'hls' ? 'm3u8' : 'mp4';
    return Promise.resolve({
      assetId: asset.id,
      format,
      url: `${this.#mediaBaseUrl}/${encodeURIComponent(asset.id)}.${extension}?expires=${encodeURIComponent(expiresAt)}`,
      expiresAt,
    });
  }

  public async getThumbnail(request: ThumbnailRequest): Promise<string> {
    this.#requireAsset(request.assetId);
    const query = new URLSearchParams();
    if (request.timeSeconds !== undefined) query.set('time', String(request.timeSeconds));
    if (request.width !== undefined) query.set('width', String(request.width));
    if (request.height !== undefined) query.set('height', String(request.height));
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return Promise.resolve(
      `${this.#mediaBaseUrl}/${encodeURIComponent(request.assetId)}.webp${suffix}`,
    );
  }

  public async replaceAsset(
    assetId: string,
    request: UploadSessionRequest,
  ): Promise<ReplacementSession> {
    this.#requireAsset(assetId);
    const replacement = await this.createUploadSession(request);
    return { previousAssetId: assetId, replacement, deletePreviousAfterReady: true };
  }

  public async deleteAsset(assetId: string): Promise<void> {
    const existing = this.#requireAsset(assetId);
    this.#assets.set(assetId, {
      ...existing,
      status: 'deleted',
      readyToStream: false,
      modifiedAt: this.#now().toISOString(),
    });
  }

  public async handleWebhook(event: ProviderWebhookEvent): Promise<WebhookReceipt> {
    if (this.#processedEvents.has(event.eventId)) {
      return { accepted: true, duplicate: true };
    }
    this.#processedEvents.add(event.eventId);
    const previous = this.#assets.get(event.assetId);
    const timestamp = event.occurredAt;
    const asset: MediaAsset = {
      id: event.assetId,
      status: event.status,
      progressPercent: event.progressPercent,
      readyToStream: event.status === 'ready' && event.progressPercent >= 100,
      createdAt: previous?.createdAt ?? timestamp,
      modifiedAt: timestamp,
      ...(event.errorCode === undefined ? {} : { errorCode: event.errorCode }),
      ...(event.errorMessage === undefined ? {} : { errorMessage: event.errorMessage }),
    };
    this.#assets.set(asset.id, asset);
    return { accepted: true, duplicate: false, asset: { ...asset } };
  }

  #requireAsset(assetId: string): MediaAsset {
    const asset = this.#assets.get(assetId);
    if (asset === undefined) {
      throw new MediaProviderError(`Unknown media asset: ${assetId}`, 'ASSET_NOT_FOUND', false);
    }
    return asset;
  }
}
