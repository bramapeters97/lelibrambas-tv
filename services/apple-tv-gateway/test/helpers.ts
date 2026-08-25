import type { IdentityVerifier, VerifiedIdentity } from '../src/access.js';
import type { GatewayConfig } from '../src/config.js';
import type { CatalogSourceItem } from '../src/contracts.js';
import type {
  AuthorizationRecord,
  GatewayStore,
  NewAuthorization,
  RateLimitDecision,
  SessionRecord,
} from '../src/storage.js';
import type { UpstreamCatalog } from '../src/upstream.js';

export const syntheticConfig: GatewayConfig = {
  publicOrigin: new URL('https://gateway.example.test'),
  upstreamOrigin: new URL('https://archive.example.test'),
  upstreamCatalogPath: '/data/media_catalog.json',
  accessTeamDomain: new URL('https://team.example.test'),
  accessAudience: 'synthetic-audience',
  allowedEmailHashes: [],
  upstreamAccessClientId: 'synthetic-client-id',
  upstreamAccessClientSecret: 'synthetic-client-secret',
  artworkSigningKey: 'synthetic-artwork-signing-key-with-32-bytes',
  deviceCodeTTLSeconds: 600,
  devicePollIntervalSeconds: 5,
  sessionTTLSeconds: 3_600,
  artworkURLTTLSeconds: 900,
  allowedMediaHostSuffixes: ['media.example.test'],
};

export const syntheticCatalog: readonly CatalogSourceItem[] = [
  {
    id: 101,
    title: 'Northern Lights Archive',
    year: 2024,
    description: 'A synthetic fixture created for gateway tests.',
    category: 'OTHERS',
    posterUrl: '/artwork/northern-lights.jpg',
    backdropUrl: '/artwork/northern-lights-wide.jpg',
    streamVideoId: 'https://media.example.test/fixture-101/watch',
    playbackAssetId: null,
    sortOrder: 1,
    featured: true,
    previewStartSeconds: 0,
  },
];

export class FixedIdentityVerifier implements IdentityVerifier {
  public constructor(
    private readonly identity: VerifiedIdentity = { email: 'tester@example.test' },
  ) {}

  public verify(): Promise<VerifiedIdentity> {
    return Promise.resolve(this.identity);
  }
}

export class FixtureUpstream implements UpstreamCatalog {
  public readonly playbackRequests: number[] = [];

  public loadCatalog(): Promise<readonly CatalogSourceItem[]> {
    return Promise.resolve(syntheticCatalog);
  }

  public playbackURL(item: CatalogSourceItem): Promise<URL> {
    this.playbackRequests.push(item.id);
    return Promise.resolve(new URL(`https://media.example.test/${item.id}/manifest/video.m3u8`));
  }

  public artwork(item: CatalogSourceItem, kind: 'poster' | 'backdrop'): Promise<Response> {
    return Promise.resolve(
      new Response(`${item.id}:${kind}`, { headers: { 'content-type': 'image/jpeg' } }),
    );
  }
}

interface RateWindow {
  readonly startedAt: number;
  readonly count: number;
}

export class MemoryGatewayStore implements GatewayStore {
  public readonly authorizations = new Map<string, AuthorizationRecord>();
  public readonly sessions = new Map<string, SessionRecord & { revokedAt: number | null }>();
  private readonly userIndex = new Map<string, string>();
  private readonly rateLimits = new Map<string, RateWindow>();

  public insertAuthorization(record: NewAuthorization): Promise<boolean> {
    if (this.authorizations.has(record.deviceCodeHash) || this.userIndex.has(record.userCodeHash)) {
      return Promise.resolve(false);
    }
    this.authorizations.set(record.deviceCodeHash, {
      ...record,
      status: 'pending',
      lastPollAt: null,
      subjectHash: null,
      emailHint: null,
    });
    this.userIndex.set(record.userCodeHash, record.deviceCodeHash);
    return Promise.resolve(true);
  }

  public authorizationByDeviceHash(deviceCodeHash: string): Promise<AuthorizationRecord | null> {
    return Promise.resolve(this.authorizations.get(deviceCodeHash) ?? null);
  }

  public authorizationByUserHash(userCodeHash: string): Promise<AuthorizationRecord | null> {
    const deviceHash = this.userIndex.get(userCodeHash);
    return Promise.resolve(
      deviceHash === undefined ? null : (this.authorizations.get(deviceHash) ?? null),
    );
  }

  public recordPoll(deviceCodeHash: string, now: number, notAfter: number): Promise<boolean> {
    const record = this.authorizations.get(deviceCodeHash);
    if (
      record === undefined ||
      (record.status !== 'pending' && record.status !== 'approved') ||
      (record.lastPollAt !== null && record.lastPollAt > notAfter)
    ) {
      return Promise.resolve(false);
    }
    this.authorizations.set(deviceCodeHash, { ...record, lastPollAt: now });
    return Promise.resolve(true);
  }

  public markExpired(deviceCodeHash: string): Promise<void> {
    const record = this.authorizations.get(deviceCodeHash);
    if (record !== undefined && (record.status === 'pending' || record.status === 'approved')) {
      this.authorizations.set(deviceCodeHash, { ...record, status: 'expired' });
    }
    return Promise.resolve();
  }

  public decideAuthorization(
    userCodeHash: string,
    decision: 'approved' | 'denied',
    subjectHash: string,
    emailHint: string,
    now: number,
  ): Promise<boolean> {
    const deviceHash = this.userIndex.get(userCodeHash);
    const record = deviceHash === undefined ? undefined : this.authorizations.get(deviceHash);
    if (
      deviceHash === undefined ||
      record === undefined ||
      record.status !== 'pending' ||
      record.expiresAt <= now
    ) {
      return Promise.resolve(false);
    }
    this.authorizations.set(deviceHash, {
      ...record,
      status: decision,
      subjectHash,
      emailHint,
    });
    return Promise.resolve(true);
  }

  public consumeApprovedAuthorization(
    deviceCodeHash: string,
    sessionId: string,
    sessionTokenHash: string,
    now: number,
    sessionExpiresAt: number,
  ): Promise<boolean> {
    const record = this.authorizations.get(deviceCodeHash);
    if (
      record === undefined ||
      record.status !== 'approved' ||
      record.expiresAt <= now ||
      record.subjectHash === null
    ) {
      return Promise.resolve(false);
    }
    this.sessions.set(sessionTokenHash, {
      id: sessionId,
      tokenHash: sessionTokenHash,
      subjectHash: record.subjectHash,
      emailHint: record.emailHint,
      expiresAt: sessionExpiresAt,
      revokedAt: null,
    });
    this.authorizations.set(deviceCodeHash, { ...record, status: 'consumed' });
    return Promise.resolve(true);
  }

  public authorizeSession(tokenHash: string, now: number): Promise<SessionRecord | null> {
    const session = this.sessions.get(tokenHash);
    if (session === undefined || session.revokedAt !== null || session.expiresAt <= now) {
      return Promise.resolve(null);
    }
    return Promise.resolve(session);
  }

  public rotateSession(
    currentTokenHash: string,
    replacementSessionId: string,
    replacementTokenHash: string,
    now: number,
    replacementExpiresAt: number,
  ): Promise<SessionRecord | null> {
    const current = this.sessions.get(currentTokenHash);
    if (current === undefined || current.revokedAt !== null || current.expiresAt <= now) {
      return Promise.resolve(null);
    }
    this.sessions.set(currentTokenHash, { ...current, revokedAt: now });
    const replacement = {
      id: replacementSessionId,
      tokenHash: replacementTokenHash,
      subjectHash: current.subjectHash,
      emailHint: current.emailHint,
      expiresAt: replacementExpiresAt,
      revokedAt: null,
    };
    this.sessions.set(replacementTokenHash, replacement);
    return Promise.resolve(replacement);
  }

  public revokeSession(tokenHash: string, now: number): Promise<boolean> {
    const session = this.sessions.get(tokenHash);
    if (session === undefined || session.revokedAt !== null) return Promise.resolve(false);
    this.sessions.set(tokenHash, { ...session, revokedAt: now });
    return Promise.resolve(true);
  }

  public consumeRateLimit(
    keyHash: string,
    limit: number,
    windowSeconds: number,
    now: number,
  ): Promise<RateLimitDecision> {
    const windowStartedAt = now - (now % windowSeconds);
    const existing = this.rateLimits.get(keyHash);
    const count = existing?.startedAt === windowStartedAt ? existing.count + 1 : 1;
    this.rateLimits.set(keyHash, { startedAt: windowStartedAt, count });
    return Promise.resolve({
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: Math.max(1, windowStartedAt + windowSeconds - now),
    });
  }

  public cleanup(now: number): Promise<void> {
    for (const [hash, session] of this.sessions) {
      if (session.expiresAt < now - 86_400) this.sessions.delete(hash);
    }
    return Promise.resolve();
  }
}

export function tokenSequence(): () => string {
  let sequence = 0;
  return () => {
    sequence += 1;
    return `${String(sequence).padStart(2, '0')}${'A'.repeat(41)}`;
  };
}

export function idSequence(): () => string {
  let sequence = 0;
  return () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
}
