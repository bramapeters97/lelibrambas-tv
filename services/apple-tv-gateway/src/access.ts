import type { GatewayConfig } from './config.js';
import { GatewayError } from './errors.js';
import { isAllowedEmail, normalizeEmail } from './security.js';

const encoder = new TextEncoder();
const MAX_JWKS_BYTES = 512 * 1024;

export interface VerifiedIdentity {
  readonly email: string;
}

export interface IdentityVerifier {
  verify(request: Request): Promise<VerifiedIdentity>;
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface AccessJWTHeader {
  readonly alg: string;
  readonly kid: string;
}

interface AccessJWTPayload {
  readonly aud: string | readonly string[];
  readonly email: string;
  readonly exp: number;
  readonly iat?: number;
  readonly iss: string;
  readonly nbf?: number;
  readonly type: string;
}

interface AccessJWK extends JsonWebKey {
  readonly alg?: string;
  readonly kid?: string;
  readonly use?: string;
}

function decodeBase64URL(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error('Invalid base64url segment');
  const base64 = value
    .replace(/-/gu, '+')
    .replace(/_/gu, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parseJSONSegment(value: string): unknown {
  if (value.length > 12_000) throw new Error('JWT segment is too large');
  return JSON.parse(new TextDecoder().decode(decodeBase64URL(value))) as unknown;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseHeader(value: string): AccessJWTHeader {
  const header = objectValue(parseJSONSegment(value));
  if (header?.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 256) {
    throw new Error('JWT header is invalid');
  }
  return { alg: header.alg, kid: header.kid };
}

function parsePayload(value: string): AccessJWTPayload {
  const payload = objectValue(parseJSONSegment(value));
  const audience = payload?.aud;
  const validAudience =
    typeof audience === 'string' ||
    (Array.isArray(audience) && audience.every((entry) => typeof entry === 'string'));
  if (
    !validAudience ||
    typeof payload?.email !== 'string' ||
    typeof payload.exp !== 'number' ||
    typeof payload.iss !== 'string' ||
    typeof payload.type !== 'string' ||
    (payload.iat !== undefined && typeof payload.iat !== 'number') ||
    (payload.nbf !== undefined && typeof payload.nbf !== 'number')
  ) {
    throw new Error('JWT payload is invalid');
  }
  return {
    aud: audience as string | readonly string[],
    email: payload.email,
    exp: payload.exp,
    iss: payload.iss,
    type: payload.type,
    ...(typeof payload.iat === 'number' ? { iat: payload.iat } : {}),
    ...(typeof payload.nbf === 'number' ? { nbf: payload.nbf } : {}),
  };
}

function isAccessJWK(value: unknown): value is AccessJWK {
  return objectValue(value) !== null;
}

async function boundedJWKS(response: Response): Promise<readonly AccessJWK[]> {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_JWKS_BYTES)
    throw new Error('JWKS response is too large');
  if (response.body === null) throw new Error('JWKS response is empty');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let raw = '';
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > MAX_JWKS_BYTES) {
      await reader.cancel('JWKS response exceeded the limit').catch(() => undefined);
      throw new Error('JWKS response is too large');
    }
    raw += decoder.decode(chunk.value, { stream: true });
  }
  const payload = objectValue(JSON.parse(raw + decoder.decode()) as unknown);
  if (!Array.isArray(payload?.keys)) throw new Error('JWKS response is invalid');
  return payload.keys.filter(isAccessJWK);
}

export class CloudflareAccessIdentityVerifier implements IdentityVerifier {
  public constructor(
    private readonly config: GatewayConfig,
    private readonly fetchImplementation: FetchImplementation = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async verify(request: Request): Promise<VerifiedIdentity> {
    const assertion = request.headers.get('cf-access-jwt-assertion');
    if (assertion === null || assertion.length > 16_384) {
      throw new GatewayError(403, 'ACCESS_REQUIRED', 'Sign in before activating this Apple TV.');
    }
    try {
      const segments = assertion.split('.');
      if (segments.length !== 3) throw new Error('JWT segment count is invalid');
      const encodedHeader = segments[0] ?? '';
      const encodedPayload = segments[1] ?? '';
      const encodedSignature = segments[2] ?? '';
      const header = parseHeader(encodedHeader);
      const payload = parsePayload(encodedPayload);
      const timestamp = Math.floor(this.now().getTime() / 1_000);
      const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (
        payload.iss !== this.config.accessTeamDomain.origin ||
        !audience.includes(this.config.accessAudience) ||
        payload.type !== 'app' ||
        payload.exp <= timestamp - 30 ||
        (payload.nbf !== undefined && payload.nbf > timestamp + 30) ||
        (payload.iat !== undefined && payload.iat > timestamp + 60)
      ) {
        throw new Error('JWT claims are invalid');
      }
      const certsURL = new URL('/cdn-cgi/access/certs', this.config.accessTeamDomain);
      const certsResponse = await this.fetchImplementation(certsURL, {
        method: 'GET',
        headers: { accept: 'application/json' },
        redirect: 'error',
      });
      if (!certsResponse.ok) {
        await certsResponse.body?.cancel().catch(() => undefined);
        throw new Error('JWKS request failed');
      }
      const keys = await boundedJWKS(certsResponse);
      const candidate = keys.find(
        (key) =>
          key.kid === header.kid &&
          key.kty === 'RSA' &&
          (key.alg === undefined || key.alg === 'RS256') &&
          (key.use === undefined || key.use === 'sig'),
      );
      if (candidate === undefined) throw new Error('JWT signing key was not found');
      const key = await crypto.subtle.importKey(
        'jwk',
        candidate,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );
      const validSignature = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        key,
        decodeBase64URL(encodedSignature),
        encoder.encode(`${encodedHeader}.${encodedPayload}`),
      );
      if (!validSignature) throw new Error('JWT signature is invalid');
      const email = normalizeEmail(payload.email);
      if (!(await isAllowedEmail(email, this.config.allowedEmailHashes))) {
        throw new GatewayError(
          403,
          'EMAIL_NOT_ALLOWED',
          'This account cannot activate an Apple TV.',
        );
      }
      return { email };
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      throw new GatewayError(403, 'ACCESS_INVALID', 'Your sign-in could not be verified.');
    }
  }
}
