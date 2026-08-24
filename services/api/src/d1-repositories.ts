import type { ProviderWebhookEvent } from '@lelibrambas/media';
import type { PairingRequest, ProgressRequest } from './contracts.js';
import type {
  CatalogRepository,
  CatalogVideo,
  DeviceRepository,
  PairingRecord,
  RateLimitDecision,
  RateLimiter,
} from './ports.js';

interface VideoRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  year: number | null;
  duration_seconds: number | null;
  aspect_ratio: string | null;
  processing_status: string;
  playback_provider: string;
  playback_asset_id: string | null;
}

interface PairingRow {
  id: string;
  pairing_code: string;
  pairing_expires_at: string;
  approved_at: string | null;
  denied_at: string | null;
  revoked_at: string | null;
}

export class D1CatalogRepository implements CatalogRepository {
  public constructor(private readonly database: D1Database) {}

  public async listVisibleVideos(): Promise<readonly CatalogVideo[]> {
    const result = await this.database
      .prepare(
        `
      SELECT id, slug, title, subtitle, description, year, duration_seconds, aspect_ratio,
             processing_status, playback_provider, playback_asset_id
      FROM videos
      WHERE visibility != 'hidden'
      ORDER BY featured DESC, recording_date DESC, added_at DESC
    `,
      )
      .all<VideoRow>();
    return result.results.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      description: row.description,
      year: row.year,
      durationSeconds: row.duration_seconds,
      aspectRatio: row.aspect_ratio,
      processingStatus: row.processing_status,
      playbackProvider: row.playback_provider,
      playbackAssetId: row.playback_asset_id,
    }));
  }

  public async saveProgress(
    profileId: string,
    videoId: string,
    progress: ProgressRequest,
  ): Promise<void> {
    await this.database
      .prepare(
        `
      INSERT INTO watch_progress (
        profile_id, video_id, position_seconds, duration_seconds, completed, play_count, last_watched_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)
      ON CONFLICT(profile_id, video_id) DO UPDATE SET
        position_seconds = excluded.position_seconds,
        duration_seconds = excluded.duration_seconds,
        completed = excluded.completed,
        play_count = watch_progress.play_count + 1,
        last_watched_at = excluded.last_watched_at,
        updated_at = excluded.updated_at
    `,
      )
      .bind(
        profileId,
        videoId,
        progress.positionSeconds,
        progress.durationSeconds,
        progress.completed ? 1 : 0,
        progress.watchedAt,
      )
      .run();
  }

  public async setWatchlist(profileId: string, videoId: string, included: boolean): Promise<void> {
    if (included) {
      await this.database
        .prepare('INSERT OR IGNORE INTO watchlist (profile_id, video_id) VALUES (?1, ?2)')
        .bind(profileId, videoId)
        .run();
    } else {
      await this.database
        .prepare('DELETE FROM watchlist WHERE profile_id = ?1 AND video_id = ?2')
        .bind(profileId, videoId)
        .run();
    }
  }

  public async applyMediaStatus(event: ProviderWebhookEvent): Promise<boolean> {
    const status =
      event.status === 'ready' ? 'ready' : event.status === 'failed' ? 'failed' : 'processing';
    const [receipt] = await this.database.batch([
      this.database
        .prepare(
          `
        INSERT OR IGNORE INTO stream_webhook_events
          (event_id, asset_id, status, payload_json, received_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
      `,
        )
        .bind(
          event.eventId,
          event.assetId,
          event.status,
          JSON.stringify(event.payload),
          event.occurredAt,
        ),
      this.database
        .prepare(
          `
        UPDATE videos SET
          processing_status = ?1,
          media_status_updated_at = ?2,
          updated_at = MAX(updated_at, ?2)
        WHERE playback_asset_id = ?3
          AND (media_status_updated_at IS NULL OR media_status_updated_at <= ?2)
      `,
        )
        .bind(status, event.occurredAt, event.assetId),
    ]);
    return (receipt?.meta.changes ?? 0) > 0;
  }
}

export class D1DeviceRepository implements DeviceRepository {
  public constructor(private readonly database: D1Database) {}

  public async createPairing(
    request: PairingRequest,
    code: string,
    expiresAt: string,
    tokenHash: string,
  ): Promise<PairingRecord> {
    const deviceId = crypto.randomUUID();
    await this.database
      .prepare(
        `
      INSERT INTO devices (id, name, platform, pairing_code, pairing_expires_at, token_hash)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `,
      )
      .bind(deviceId, request.name, request.platform, code, expiresAt, tokenHash)
      .run();
    return { deviceId, code, expiresAt, approved: false, denied: false, revoked: false };
  }

  public async getPairing(code: string): Promise<PairingRecord | null> {
    const row = await this.database
      .prepare(
        `
      SELECT id, pairing_code, pairing_expires_at, approved_at, denied_at, revoked_at
      FROM devices WHERE pairing_code = ?1
    `,
      )
      .bind(code)
      .first<PairingRow>();
    return row === null
      ? null
      : {
          deviceId: row.id,
          code: row.pairing_code,
          expiresAt: row.pairing_expires_at,
          approved: row.approved_at !== null,
          denied: row.denied_at !== null,
          revoked: row.revoked_at !== null,
        };
  }

  public async approvePairing(
    code: string,
    userId: string,
    approvedAt: string,
  ): Promise<string | null> {
    const row = await this.database
      .prepare(
        `
      UPDATE devices SET user_id = ?1, approved_at = ?2, updated_at = ?2
      WHERE pairing_code = ?3 AND pairing_expires_at > ?2 AND approved_at IS NULL
        AND denied_at IS NULL AND revoked_at IS NULL
      RETURNING id
    `,
      )
      .bind(userId, approvedAt, code)
      .first<{ id: string }>();
    return row?.id ?? null;
  }

  public async denyPairing(code: string, deniedAt: string): Promise<boolean> {
    const result = await this.database
      .prepare(
        `
      UPDATE devices SET denied_at = ?1, token_hash = NULL, updated_at = ?1
      WHERE pairing_code = ?2 AND pairing_expires_at > ?1 AND approved_at IS NULL
        AND denied_at IS NULL AND revoked_at IS NULL
    `,
      )
      .bind(deniedAt, code)
      .run();
    return (result.meta.changes ?? 0) > 0;
  }

  public async authorizeToken(tokenHash: string, seenAt: string): Promise<boolean> {
    const row = await this.database
      .prepare(
        `
      SELECT id FROM devices
      WHERE token_hash = ?1 AND approved_at IS NOT NULL AND denied_at IS NULL AND revoked_at IS NULL
    `,
      )
      .bind(tokenHash)
      .first<{ id: string }>();
    if (row === null) return false;
    await this.database
      .prepare('UPDATE devices SET last_seen_at = ?1, updated_at = ?1 WHERE id = ?2')
      .bind(seenAt, row.id)
      .run();
    return true;
  }

  public async rotateToken(
    currentTokenHash: string,
    replacementTokenHash: string,
    rotatedAt: string,
  ): Promise<string | null> {
    const row = await this.database
      .prepare(
        `
      UPDATE devices SET token_hash = ?1, token_rotated_at = ?2, updated_at = ?2
      WHERE token_hash = ?3 AND approved_at IS NOT NULL AND denied_at IS NULL AND revoked_at IS NULL
      RETURNING id
    `,
      )
      .bind(replacementTokenHash, rotatedAt, currentTokenHash)
      .first<{ id: string }>();
    return row?.id ?? null;
  }

  public async revoke(deviceId: string, revokedAt: string): Promise<boolean> {
    const result = await this.database
      .prepare(
        `
      UPDATE devices SET revoked_at = ?1, token_hash = NULL, updated_at = ?1
      WHERE id = ?2 AND revoked_at IS NULL
    `,
      )
      .bind(revokedAt, deviceId)
      .run();
    return (result.meta.changes ?? 0) > 0;
  }
}

export class D1RateLimiter implements RateLimiter {
  public constructor(private readonly database: D1Database) {}

  public async consume(
    key: string,
    limit: number,
    windowSeconds: number,
    nowEpochMs: number,
  ): Promise<RateLimitDecision> {
    const windowMs = windowSeconds * 1_000;
    const resetBefore = nowEpochMs - windowMs;
    const row = await this.database
      .prepare(
        `
      INSERT INTO rate_limit_buckets (key, window_started_at, request_count, updated_at)
      VALUES (?1, ?2, 1, ?3)
      ON CONFLICT(key) DO UPDATE SET
        window_started_at = CASE
          WHEN rate_limit_buckets.window_started_at <= ?4 THEN excluded.window_started_at
          ELSE rate_limit_buckets.window_started_at
        END,
        request_count = CASE
          WHEN rate_limit_buckets.window_started_at <= ?4 THEN 1
          ELSE rate_limit_buckets.request_count + 1
        END,
        updated_at = excluded.updated_at
      RETURNING window_started_at, request_count
    `,
      )
      .bind(key, nowEpochMs, new Date(nowEpochMs).toISOString(), resetBefore)
      .first<{ window_started_at: number; request_count: number }>();
    if (row === null) throw new Error('D1 rate-limit update returned no row.');
    const remaining = Math.max(0, limit - row.request_count);
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((row.window_started_at + windowMs - nowEpochMs) / 1_000),
    );
    return { allowed: row.request_count <= limit, remaining, retryAfterSeconds };
  }
}
