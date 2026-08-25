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

export interface LocalMediaRecord extends MediaAsset {
  readonly videoPath: string;
  readonly thumbnailPath: string;
}

export interface LocalMediaProviderOptions {
  readonly records: readonly LocalMediaRecord[];
  readonly publicBaseUrl?: string;
}

function assertPublicPath(value: string): string {
  const normalized = value.replaceAll('\\', '/');
  if (
    /^[a-zA-Z]:\//u.test(normalized) ||
    normalized.startsWith('//') ||
    normalized.startsWith('file:')
  ) {
    throw new MediaProviderError(
      'Local media records must expose server-relative URLs, not personal filesystem paths.',
      'INVALID_CONFIGURATION',
      false,
    );
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export class LocalMediaProvider implements MediaProvider {
  public readonly kind = 'local' as const;
  readonly #records = new Map<string, LocalMediaRecord>();
  readonly #publicBaseUrl: string;

  public constructor(options: LocalMediaProviderOptions) {
    this.#publicBaseUrl = (options.publicBaseUrl ?? '').replace(/\/$/u, '');
    for (const record of options.records) {
      this.#records.set(record.id, {
        ...record,
        videoPath: assertPublicPath(record.videoPath),
        thumbnailPath: assertPublicPath(record.thumbnailPath),
      });
    }
  }

  public async createUploadSession(_request: UploadSessionRequest): Promise<UploadSession> {
    throw new MediaProviderError(
      'Local uploads are performed by the desktop importer.',
      'UPLOAD_NOT_SUPPORTED',
      false,
    );
  }

  public async getUploadStatus(assetId: string): Promise<MediaAsset> {
    const record = this.#requireRecord(assetId);
    const { videoPath: _videoPath, thumbnailPath: _thumbnailPath, ...asset } = record;
    return Promise.resolve(asset);
  }

  public async getPlayback(request: PlaybackRequest): Promise<PlaybackSession> {
    const record = this.#requireRecord(request.assetId);
    if (record.status !== 'ready' || !record.readyToStream) {
      throw new MediaProviderError('The local viewing copy is not ready.', 'ASSET_NOT_READY', true);
    }
    return Promise.resolve({
      assetId: record.id,
      format: record.videoPath.endsWith('.m3u8') ? 'hls' : 'mp4',
      url: `${this.#publicBaseUrl}${record.videoPath}`,
    });
  }

  public async getThumbnail(request: ThumbnailRequest): Promise<string> {
    const record = this.#requireRecord(request.assetId);
    return Promise.resolve(`${this.#publicBaseUrl}${record.thumbnailPath}`);
  }

  public async replaceAsset(
    assetId: string,
    _request: UploadSessionRequest,
  ): Promise<ReplacementSession> {
    this.#requireRecord(assetId);
    throw new MediaProviderError(
      'Local replacements are created by the desktop importer.',
      'UPLOAD_NOT_SUPPORTED',
      false,
    );
  }

  public async deleteAsset(assetId: string): Promise<void> {
    this.#requireRecord(assetId);
    throw new MediaProviderError(
      'Viewer code cannot delete local media. Update catalogue visibility at the source.',
      'UPLOAD_NOT_SUPPORTED',
      false,
    );
  }

  public async handleWebhook(_event: ProviderWebhookEvent): Promise<WebhookReceipt> {
    return Promise.resolve({ accepted: false, duplicate: false });
  }

  #requireRecord(assetId: string): LocalMediaRecord {
    const record = this.#records.get(assetId);
    if (record === undefined) {
      throw new MediaProviderError(
        `Unknown local media asset: ${assetId}`,
        'ASSET_NOT_FOUND',
        false,
      );
    }
    return record;
  }
}
