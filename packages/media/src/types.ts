export type MediaProviderKind = 'mock' | 'local' | 'cloudflare-stream';

export type MediaAssetStatus =
  | 'awaiting-upload'
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'unavailable'
  | 'deleted';

export type PlaybackFormat = 'mp4' | 'hls';

export interface MediaAsset {
  readonly id: string;
  readonly status: MediaAssetStatus;
  readonly progressPercent: number;
  readonly readyToStream: boolean;
  readonly durationSeconds?: number;
  readonly width?: number;
  readonly height?: number;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly createdAt: string;
  readonly modifiedAt: string;
}

export interface UploadSessionRequest {
  readonly filename: string;
  readonly maxDurationSeconds: number;
  readonly creatorId?: string;
  readonly expiresAt?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface UploadSession {
  readonly assetId: string;
  readonly uploadUrl: string;
  readonly expiresAt?: string;
  readonly protocol: 'multipart' | 'tus' | 'mock' | 'local';
  readonly requiresSignedUrls: true;
}

export interface PlaybackRequest {
  readonly assetId: string;
  readonly preferredFormat?: PlaybackFormat;
  readonly tokenTtlSeconds?: number;
}

export interface PlaybackSession {
  readonly assetId: string;
  readonly format: PlaybackFormat;
  readonly url: string;
  readonly expiresAt?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface ThumbnailRequest {
  readonly assetId: string;
  readonly timeSeconds?: number;
  readonly width?: number;
  readonly height?: number;
}

export interface ReplacementSession {
  readonly previousAssetId: string;
  readonly replacement: UploadSession;
  readonly deletePreviousAfterReady: true;
}

export interface ProviderWebhookEvent {
  readonly eventId: string;
  readonly assetId: string;
  readonly status: MediaAssetStatus;
  readonly progressPercent: number;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly occurredAt: string;
  readonly payload: unknown;
}

export interface WebhookReceipt {
  readonly accepted: boolean;
  readonly duplicate: boolean;
  readonly asset?: MediaAsset;
}

export interface MediaProvider {
  readonly kind: MediaProviderKind;
  createUploadSession(request: UploadSessionRequest): Promise<UploadSession>;
  getUploadStatus(assetId: string): Promise<MediaAsset>;
  getPlayback(request: PlaybackRequest): Promise<PlaybackSession>;
  getThumbnail(request: ThumbnailRequest): Promise<string>;
  replaceAsset(assetId: string, request: UploadSessionRequest): Promise<ReplacementSession>;
  deleteAsset(assetId: string): Promise<void>;
  handleWebhook(event: ProviderWebhookEvent): Promise<WebhookReceipt>;
}

export class MediaProviderError extends Error {
  public constructor(
    message: string,
    public readonly code:
      | 'ASSET_NOT_FOUND'
      | 'ASSET_NOT_READY'
      | 'ASSET_UNAVAILABLE'
      | 'UPLOAD_NOT_SUPPORTED'
      | 'INVALID_CONFIGURATION'
      | 'PROVIDER_FAILURE',
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'MediaProviderError';
  }
}
