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

export interface CloudflareStreamVideoStatus {
  readonly state: string;
  readonly pctComplete?: string;
  readonly errorReasonCode?: string;
  readonly errorReasonText?: string;
}

export interface CloudflareStreamVideo {
  readonly id: string;
  readonly readyToStream: boolean;
  readonly status: CloudflareStreamVideoStatus;
  readonly created: string;
  readonly modified: string;
  readonly duration: number;
  readonly input: { readonly width: number; readonly height: number };
  readonly hlsPlaybackUrl: string;
  readonly thumbnail: string;
}

export interface CloudflareStreamVideoHandle {
  details(): Promise<CloudflareStreamVideo>;
  update(params: { readonly requireSignedURLs: true }): Promise<CloudflareStreamVideo>;
  delete(): Promise<void>;
  generateToken(): Promise<string>;
}

export interface CloudflareStreamBindingPort {
  createDirectUpload(params: {
    readonly maxDurationSeconds: number;
    readonly expiry?: string;
    readonly creator?: string;
    readonly meta?: Readonly<Record<string, string>>;
    readonly requireSignedURLs: true;
  }): Promise<{ readonly uploadURL: string; readonly id: string }>;
  video(assetId: string): CloudflareStreamVideoHandle;
}

export interface CloudflareStreamProviderOptions {
  readonly binding: CloudflareStreamBindingPort;
  readonly deliveryDomain: string;
  readonly now?: () => Date;
}

function mapState(video: CloudflareStreamVideo): MediaAsset {
  const percent = Math.max(
    0,
    Math.min(100, Number.parseFloat(video.status.pctComplete ?? '0') || 0),
  );
  const status =
    video.status.state === 'ready'
      ? 'ready'
      : video.status.state === 'error'
        ? 'failed'
        : video.status.state === 'queued'
          ? 'queued'
          : 'processing';
  return {
    id: video.id,
    status,
    progressPercent: percent,
    readyToStream: video.readyToStream && status === 'ready',
    durationSeconds: video.duration,
    width: video.input.width,
    height: video.input.height,
    createdAt: video.created,
    modifiedAt: video.modified,
    ...(video.status.errorReasonCode === undefined || video.status.errorReasonCode === ''
      ? {}
      : { errorCode: video.status.errorReasonCode }),
    ...(video.status.errorReasonText === undefined || video.status.errorReasonText === ''
      ? {}
      : { errorMessage: video.status.errorReasonText }),
  };
}

export class CloudflareStreamProvider implements MediaProvider {
  public readonly kind = 'cloudflare-stream' as const;
  readonly #binding: CloudflareStreamBindingPort;
  readonly #deliveryDomain: string;
  readonly #now: () => Date;

  public constructor(options: CloudflareStreamProviderOptions) {
    const deliveryDomain = options.deliveryDomain.replace(/^https?:\/\//u, '').replace(/\/$/u, '');
    if (deliveryDomain.length === 0 || deliveryDomain.includes('/')) {
      throw new MediaProviderError(
        'Stream deliveryDomain must be a hostname.',
        'INVALID_CONFIGURATION',
        false,
      );
    }
    this.#binding = options.binding;
    this.#deliveryDomain = deliveryDomain;
    this.#now = options.now ?? (() => new Date());
  }

  public async createUploadSession(request: UploadSessionRequest): Promise<UploadSession> {
    try {
      const directUpload = await this.#binding.createDirectUpload({
        maxDurationSeconds: request.maxDurationSeconds,
        requireSignedURLs: true,
        ...(request.expiresAt === undefined ? {} : { expiry: request.expiresAt }),
        ...(request.creatorId === undefined ? {} : { creator: request.creatorId }),
        meta: { filename: request.filename, ...request.metadata },
      });
      return {
        assetId: directUpload.id,
        uploadUrl: directUpload.uploadURL,
        protocol: 'multipart',
        requiresSignedUrls: true,
        ...(request.expiresAt === undefined ? {} : { expiresAt: request.expiresAt }),
      };
    } catch (error) {
      throw this.#mapError(error, 'new upload');
    }
  }

  public async getUploadStatus(assetId: string): Promise<MediaAsset> {
    try {
      return mapState(await this.#binding.video(assetId).details());
    } catch (error) {
      throw this.#mapError(error, assetId);
    }
  }

  public async getPlayback(request: PlaybackRequest): Promise<PlaybackSession> {
    try {
      if (request.tokenTtlSeconds !== undefined && request.tokenTtlSeconds !== 3_600) {
        throw new MediaProviderError(
          'The Stream binding supports only its fixed one-hour token lifetime.',
          'INVALID_CONFIGURATION',
          false,
        );
      }
      const handle = this.#binding.video(request.assetId);
      const details = await handle.details();
      const asset = mapState(details);
      if (!asset.readyToStream || asset.status !== 'ready') {
        throw new MediaProviderError('The Stream asset is not ready.', 'ASSET_NOT_READY', true);
      }
      const token = await handle.generateToken();
      // The native Stream binding issues one-hour tokens and does not expose
      // a custom expiry parameter. Callers refresh by requesting another session.
      const ttlSeconds = 3_600;
      return {
        assetId: request.assetId,
        format: 'hls',
        url: `https://${this.#deliveryDomain}/${encodeURIComponent(token)}/manifest/video.m3u8`,
        expiresAt: new Date(this.#now().getTime() + ttlSeconds * 1_000).toISOString(),
      };
    } catch (error) {
      throw this.#mapError(error, request.assetId);
    }
  }

  public async getThumbnail(request: ThumbnailRequest): Promise<string> {
    try {
      const token = await this.#binding.video(request.assetId).generateToken();
      const query = new URLSearchParams();
      if (request.timeSeconds !== undefined) query.set('time', `${request.timeSeconds}s`);
      if (request.width !== undefined) query.set('width', String(request.width));
      if (request.height !== undefined) query.set('height', String(request.height));
      const suffix = query.size === 0 ? '' : `?${query.toString()}`;
      return `https://${this.#deliveryDomain}/${encodeURIComponent(token)}/thumbnails/thumbnail.jpg${suffix}`;
    } catch (error) {
      throw this.#mapError(error, request.assetId);
    }
  }

  public async replaceAsset(
    assetId: string,
    request: UploadSessionRequest,
  ): Promise<ReplacementSession> {
    await this.getUploadStatus(assetId);
    const replacement = await this.createUploadSession(request);
    return { previousAssetId: assetId, replacement, deletePreviousAfterReady: true };
  }

  public async deleteAsset(assetId: string): Promise<void> {
    try {
      await this.#binding.video(assetId).delete();
    } catch (error) {
      throw this.#mapError(error, assetId);
    }
  }

  public async handleWebhook(event: ProviderWebhookEvent): Promise<WebhookReceipt> {
    return {
      accepted: true,
      duplicate: false,
      asset: {
        id: event.assetId,
        status: event.status,
        progressPercent: event.progressPercent,
        readyToStream: event.status === 'ready' && event.progressPercent >= 100,
        createdAt: event.occurredAt,
        modifiedAt: event.occurredAt,
        ...(event.errorCode === undefined ? {} : { errorCode: event.errorCode }),
        ...(event.errorMessage === undefined ? {} : { errorMessage: event.errorMessage }),
      },
    };
  }

  #mapError(error: unknown, assetId: string): MediaProviderError {
    if (error instanceof MediaProviderError) return error;
    const message = error instanceof Error ? error.message : String(error);
    const missing = /not[ -]?found|unknown/i.test(message);
    return new MediaProviderError(
      missing ? `Unknown Stream asset: ${assetId}` : `Cloudflare Stream request failed: ${message}`,
      missing ? 'ASSET_NOT_FOUND' : 'PROVIDER_FAILURE',
      !missing,
    );
  }
}
