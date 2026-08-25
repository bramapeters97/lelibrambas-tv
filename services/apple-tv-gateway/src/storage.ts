export type AuthorizationStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'consumed';

export interface AuthorizationRecord {
  readonly id: string;
  readonly deviceCodeHash: string;
  readonly userCodeHash: string;
  readonly deviceName: string;
  readonly status: AuthorizationStatus;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly pollIntervalSeconds: number;
  readonly lastPollAt: number | null;
  readonly subjectHash: string | null;
  readonly emailHint: string | null;
}

export interface NewAuthorization {
  readonly id: string;
  readonly deviceCodeHash: string;
  readonly userCodeHash: string;
  readonly deviceName: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly pollIntervalSeconds: number;
}

export interface SessionRecord {
  readonly id: string;
  readonly tokenHash: string;
  readonly subjectHash: string;
  readonly emailHint: string | null;
  readonly expiresAt: number;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

export interface GatewayStore {
  insertAuthorization(record: NewAuthorization): Promise<boolean>;
  authorizationByDeviceHash(deviceCodeHash: string): Promise<AuthorizationRecord | null>;
  authorizationByUserHash(userCodeHash: string): Promise<AuthorizationRecord | null>;
  recordPoll(deviceCodeHash: string, now: number, notAfter: number): Promise<boolean>;
  markExpired(deviceCodeHash: string, now: number): Promise<void>;
  decideAuthorization(
    userCodeHash: string,
    decision: 'approved' | 'denied',
    subjectHash: string,
    emailHint: string,
    now: number,
  ): Promise<boolean>;
  consumeApprovedAuthorization(
    deviceCodeHash: string,
    sessionId: string,
    sessionTokenHash: string,
    now: number,
    sessionExpiresAt: number,
  ): Promise<boolean>;
  authorizeSession(tokenHash: string, now: number): Promise<SessionRecord | null>;
  rotateSession(
    currentTokenHash: string,
    replacementSessionId: string,
    replacementTokenHash: string,
    now: number,
    replacementExpiresAt: number,
  ): Promise<SessionRecord | null>;
  revokeSession(tokenHash: string, now: number): Promise<boolean>;
  consumeRateLimit(
    keyHash: string,
    limit: number,
    windowSeconds: number,
    now: number,
  ): Promise<RateLimitDecision>;
  cleanup(now: number): Promise<void>;
}

interface AuthorizationRow {
  readonly id: string;
  readonly deviceCodeHash: string;
  readonly userCodeHash: string;
  readonly deviceName: string;
  readonly status: AuthorizationStatus;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly pollIntervalSeconds: number;
  readonly lastPollAt: number | null;
  readonly subjectHash: string | null;
  readonly emailHint: string | null;
}

interface SessionRow {
  readonly id: string;
  readonly tokenHash: string;
  readonly subjectHash: string;
  readonly emailHint: string | null;
  readonly expiresAt: number;
}

interface RateLimitRow {
  readonly requestCount: number;
  readonly windowStartedAt: number;
}

const AUTHORIZATION_COLUMNS = `
  id,
  device_code_hash AS deviceCodeHash,
  user_code_hash AS userCodeHash,
  device_name AS deviceName,
  status,
  created_at AS createdAt,
  expires_at AS expiresAt,
  poll_interval_seconds AS pollIntervalSeconds,
  last_poll_at AS lastPollAt,
  decided_by_hash AS subjectHash,
  email_hint AS emailHint
`;

export class D1GatewayStore implements GatewayStore {
  public constructor(private readonly database: D1Database) {}

  public async insertAuthorization(record: NewAuthorization): Promise<boolean> {
    const result = await this.database
      .prepare(
        `INSERT OR IGNORE INTO device_authorizations (
          id, device_code_hash, user_code_hash, device_name, status, created_at, expires_at,
          poll_interval_seconds
        ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
      )
      .bind(
        record.id,
        record.deviceCodeHash,
        record.userCodeHash,
        record.deviceName,
        record.createdAt,
        record.expiresAt,
        record.pollIntervalSeconds,
      )
      .run();
    return result.meta.changes === 1;
  }

  public async authorizationByDeviceHash(
    deviceCodeHash: string,
  ): Promise<AuthorizationRecord | null> {
    return this.database
      .prepare(
        `SELECT ${AUTHORIZATION_COLUMNS} FROM device_authorizations WHERE device_code_hash = ?`,
      )
      .bind(deviceCodeHash)
      .first<AuthorizationRow>();
  }

  public async authorizationByUserHash(userCodeHash: string): Promise<AuthorizationRecord | null> {
    return this.database
      .prepare(
        `SELECT ${AUTHORIZATION_COLUMNS} FROM device_authorizations WHERE user_code_hash = ?`,
      )
      .bind(userCodeHash)
      .first<AuthorizationRow>();
  }

  public async recordPoll(deviceCodeHash: string, now: number, notAfter: number): Promise<boolean> {
    const result = await this.database
      .prepare(
        `UPDATE device_authorizations
         SET last_poll_at = ?
         WHERE device_code_hash = ?
           AND status IN ('pending', 'approved')
           AND (last_poll_at IS NULL OR last_poll_at <= ?)`,
      )
      .bind(now, deviceCodeHash, notAfter)
      .run();
    return result.meta.changes === 1;
  }

  public async markExpired(deviceCodeHash: string, now: number): Promise<void> {
    await this.database
      .prepare(
        `UPDATE device_authorizations
         SET status = 'expired'
         WHERE device_code_hash = ? AND status IN ('pending', 'approved') AND expires_at <= ?`,
      )
      .bind(deviceCodeHash, now)
      .run();
  }

  public async decideAuthorization(
    userCodeHash: string,
    decision: 'approved' | 'denied',
    subjectHash: string,
    emailHint: string,
    now: number,
  ): Promise<boolean> {
    const result = await this.database
      .prepare(
        `UPDATE device_authorizations
         SET status = ?,
             approved_at = CASE WHEN ? = 'approved' THEN ? ELSE NULL END,
             denied_at = CASE WHEN ? = 'denied' THEN ? ELSE NULL END,
             decided_by_hash = ?,
             email_hint = ?
         WHERE user_code_hash = ? AND status = 'pending' AND expires_at > ?`,
      )
      .bind(decision, decision, now, decision, now, subjectHash, emailHint, userCodeHash, now)
      .run();
    return result.meta.changes === 1;
  }

  public async consumeApprovedAuthorization(
    deviceCodeHash: string,
    sessionId: string,
    sessionTokenHash: string,
    now: number,
    sessionExpiresAt: number,
  ): Promise<boolean> {
    const [insertResult, consumeResult] = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO sessions (
             id, token_hash, subject_hash, email_hint, created_at, expires_at, last_seen_at
           )
           SELECT ?, ?, decided_by_hash, email_hint, ?, ?, ?
           FROM device_authorizations
           WHERE device_code_hash = ? AND status = 'approved' AND expires_at > ?`,
        )
        .bind(sessionId, sessionTokenHash, now, sessionExpiresAt, now, deviceCodeHash, now),
      this.database
        .prepare(
          `UPDATE device_authorizations
           SET status = 'consumed', consumed_at = ?
           WHERE device_code_hash = ? AND status = 'approved' AND expires_at > ?`,
        )
        .bind(now, deviceCodeHash, now),
    ]);
    return insertResult?.meta.changes === 1 && consumeResult?.meta.changes === 1;
  }

  public async authorizeSession(tokenHash: string, now: number): Promise<SessionRecord | null> {
    const session = await this.database
      .prepare(
        `SELECT id, token_hash AS tokenHash, subject_hash AS subjectHash,
                email_hint AS emailHint, expires_at AS expiresAt
         FROM sessions
         WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
      )
      .bind(tokenHash, now)
      .first<SessionRow>();
    if (session === null) return null;
    await this.database
      .prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ? AND revoked_at IS NULL')
      .bind(now, session.id)
      .run();
    return session;
  }

  public async rotateSession(
    currentTokenHash: string,
    replacementSessionId: string,
    replacementTokenHash: string,
    now: number,
    replacementExpiresAt: number,
  ): Promise<SessionRecord | null> {
    const current = await this.database
      .prepare(
        `SELECT id, token_hash AS tokenHash, subject_hash AS subjectHash,
                email_hint AS emailHint, expires_at AS expiresAt
         FROM sessions
         WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
      )
      .bind(currentTokenHash, now)
      .first<SessionRow>();
    if (current === null) return null;
    const [insertResult, revokeResult] = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO sessions (
             id, token_hash, subject_hash, email_hint, created_at, expires_at, last_seen_at
           )
           SELECT ?, ?, subject_hash, email_hint, ?, ?, ?
           FROM sessions
           WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
        )
        .bind(
          replacementSessionId,
          replacementTokenHash,
          now,
          replacementExpiresAt,
          now,
          currentTokenHash,
          now,
        ),
      this.database
        .prepare(
          `UPDATE sessions
           SET revoked_at = ?, rotated_to_session_id = ?
           WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
        )
        .bind(now, replacementSessionId, currentTokenHash, now),
    ]);
    if (insertResult?.meta.changes !== 1 || revokeResult?.meta.changes !== 1) return null;
    return {
      id: replacementSessionId,
      tokenHash: replacementTokenHash,
      subjectHash: current.subjectHash,
      emailHint: current.emailHint,
      expiresAt: replacementExpiresAt,
    };
  }

  public async revokeSession(tokenHash: string, now: number): Promise<boolean> {
    const result = await this.database
      .prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
      .bind(now, tokenHash)
      .run();
    return result.meta.changes === 1;
  }

  public async consumeRateLimit(
    keyHash: string,
    limit: number,
    windowSeconds: number,
    now: number,
  ): Promise<RateLimitDecision> {
    const windowStartedAt = now - (now % windowSeconds);
    const row = await this.database
      .prepare(
        `INSERT INTO rate_limits (key_hash, window_started_at, request_count, expires_at)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(key_hash) DO UPDATE SET
           request_count = CASE
             WHEN rate_limits.window_started_at = excluded.window_started_at
             THEN rate_limits.request_count + 1 ELSE 1 END,
           window_started_at = excluded.window_started_at,
           expires_at = excluded.expires_at
         RETURNING request_count AS requestCount, window_started_at AS windowStartedAt`,
      )
      .bind(keyHash, windowStartedAt, windowStartedAt + windowSeconds * 2)
      .first<RateLimitRow>();
    const count = row?.requestCount ?? limit + 1;
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: Math.max(1, windowStartedAt + windowSeconds - now),
    };
  }

  public async cleanup(now: number): Promise<void> {
    const retentionCutoff = now - 86_400;
    await this.database.batch([
      this.database
        .prepare('DELETE FROM device_authorizations WHERE expires_at < ?')
        .bind(retentionCutoff),
      this.database.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(retentionCutoff),
      this.database.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now),
    ]);
  }
}
