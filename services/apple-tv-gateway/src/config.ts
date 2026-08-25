import { ConfigurationError } from './errors.js';

export interface GatewayConfig {
  readonly publicOrigin: URL;
  readonly upstreamOrigin: URL;
  readonly upstreamCatalogPath: string;
  readonly accessTeamDomain: URL;
  readonly accessAudience: string;
  readonly allowedEmailHashes: readonly string[];
  readonly upstreamAccessClientId: string;
  readonly upstreamAccessClientSecret: string;
  readonly artworkSigningKey: string;
  readonly deviceCodeTTLSeconds: number;
  readonly devicePollIntervalSeconds: number;
  readonly sessionTTLSeconds: number;
  readonly artworkURLTTLSeconds: number;
  readonly allowedMediaHostSuffixes: readonly string[];
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length === 0 || /replace-|\.invalid(?:\/|$)/iu.test(normalized)) {
    throw new ConfigurationError(`${name} is not configured.`);
  }
  return normalized;
}

function httpsOrigin(value: string | undefined, name: string): URL {
  let url: URL;
  try {
    url = new URL(required(value, name));
  } catch (error) {
    if (error instanceof ConfigurationError) throw error;
    throw new ConfigurationError(`${name} must be a valid HTTPS origin.`);
  }
  if (
    url.protocol !== 'https:' ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.pathname !== '/' ||
    url.search.length > 0 ||
    url.hash.length > 0 ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1'
  ) {
    throw new ConfigurationError(`${name} must be a production HTTPS origin.`);
  }
  return url;
}

function integerSetting(value: string, name: string, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ConfigurationError(`${name} is outside its allowed range.`);
  }
  return parsed;
}

function catalogPath(value: string | undefined): string {
  const path = required(value, 'UPSTREAM_CATALOG_PATH');
  if (!path.startsWith('/') || path.includes('?') || path.includes('#') || path.includes('..')) {
    throw new ConfigurationError('UPSTREAM_CATALOG_PATH must be one fixed absolute path.');
  }
  return path;
}

export function loadGatewayConfig(env: Env): GatewayConfig {
  const hashes = required(env.ALLOWED_EMAIL_SHA256, 'ALLOWED_EMAIL_SHA256')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (hashes.length === 0 || hashes.some((value) => !/^[a-f0-9]{64}$/u.test(value))) {
    throw new ConfigurationError('ALLOWED_EMAIL_SHA256 must contain SHA-256 hex digests.');
  }
  const suffixes = env.ALLOWED_MEDIA_HOST_SUFFIXES.split(',')
    .map((value) => value.trim().toLowerCase().replace(/^\./u, ''))
    .filter(Boolean);
  if (suffixes.length === 0 || suffixes.some((value) => !/^[a-z0-9.-]+$/u.test(value))) {
    throw new ConfigurationError('ALLOWED_MEDIA_HOST_SUFFIXES is invalid.');
  }
  const artworkSigningKey = required(env.ARTWORK_SIGNING_KEY, 'ARTWORK_SIGNING_KEY');
  if (artworkSigningKey.length < 32) {
    throw new ConfigurationError('ARTWORK_SIGNING_KEY must contain at least 32 characters.');
  }
  return {
    publicOrigin: httpsOrigin(env.PUBLIC_ORIGIN, 'PUBLIC_ORIGIN'),
    upstreamOrigin: httpsOrigin(env.UPSTREAM_ORIGIN, 'UPSTREAM_ORIGIN'),
    upstreamCatalogPath: catalogPath(env.UPSTREAM_CATALOG_PATH),
    accessTeamDomain: httpsOrigin(env.ACCESS_TEAM_DOMAIN, 'ACCESS_TEAM_DOMAIN'),
    accessAudience: required(env.ACCESS_AUD, 'ACCESS_AUD'),
    allowedEmailHashes: hashes,
    upstreamAccessClientId: required(env.UPSTREAM_ACCESS_CLIENT_ID, 'UPSTREAM_ACCESS_CLIENT_ID'),
    upstreamAccessClientSecret: required(
      env.UPSTREAM_ACCESS_CLIENT_SECRET,
      'UPSTREAM_ACCESS_CLIENT_SECRET',
    ),
    artworkSigningKey,
    deviceCodeTTLSeconds: integerSetting(
      env.DEVICE_CODE_TTL_SECONDS,
      'DEVICE_CODE_TTL_SECONDS',
      120,
      900,
    ),
    devicePollIntervalSeconds: integerSetting(
      env.DEVICE_POLL_INTERVAL_SECONDS,
      'DEVICE_POLL_INTERVAL_SECONDS',
      2,
      30,
    ),
    sessionTTLSeconds: integerSetting(
      env.SESSION_TTL_SECONDS,
      'SESSION_TTL_SECONDS',
      3600,
      2_592_000,
    ),
    artworkURLTTLSeconds: integerSetting(
      env.ARTWORK_URL_TTL_SECONDS,
      'ARTWORK_URL_TTL_SECONDS',
      300,
      86_400,
    ),
    allowedMediaHostSuffixes: suffixes,
  };
}
