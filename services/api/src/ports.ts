import type { ProviderWebhookEvent } from '@lelibrambas/media';
import type { PairingRequest, ProgressRequest } from './contracts.js';

export interface CatalogVideo {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly description: string;
  readonly year: number | null;
  readonly durationSeconds: number | null;
  readonly aspectRatio: string | null;
  readonly processingStatus: string;
  readonly playbackProvider: string;
  readonly playbackAssetId: string | null;
}

export interface CatalogRepository {
  listVisibleVideos(): Promise<readonly CatalogVideo[]>;
  saveProgress(profileId: string, videoId: string, progress: ProgressRequest): Promise<void>;
  setWatchlist(profileId: string, videoId: string, included: boolean): Promise<void>;
  /** Atomically records and applies a first-seen event; returns false for a duplicate. */
  applyMediaStatus(event: ProviderWebhookEvent): Promise<boolean>;
}

export interface PairingRecord {
  readonly deviceId: string;
  readonly code: string;
  readonly expiresAt: string;
  readonly approved: boolean;
  readonly denied: boolean;
  readonly revoked: boolean;
}

export interface DeviceRepository {
  createPairing(
    request: PairingRequest,
    code: string,
    expiresAt: string,
    tokenHash: string,
  ): Promise<PairingRecord>;
  getPairing(code: string): Promise<PairingRecord | null>;
  approvePairing(code: string, userId: string, approvedAt: string): Promise<string | null>;
  denyPairing(code: string, deniedAt: string): Promise<boolean>;
  authorizeToken(tokenHash: string, seenAt: string): Promise<boolean>;
  rotateToken(
    currentTokenHash: string,
    replacementTokenHash: string,
    rotatedAt: string,
  ): Promise<string | null>;
  revoke(deviceId: string, revokedAt: string): Promise<boolean>;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(
    key: string,
    limit: number,
    windowSeconds: number,
    nowEpochMs: number,
  ): Promise<RateLimitDecision>;
}

export interface ArtworkStore {
  put(key: string, request: Request): Promise<Response>;
  get(key: string, request: Request): Promise<Response>;
  delete(key: string): Promise<Response>;
}
