import { isAbsolute, relative, resolve, sep } from 'node:path';

export const APP_PROTOCOL = 'lelibrambas';
export const APP_HOST = 'app';
export const PRODUCTION_RENDERER_URL = `${APP_PROTOCOL}://${APP_HOST}/index.html`;
export const AUTHENTICATION_ERROR_URL = `${APP_PROTOCOL}://${APP_HOST}/authentication-error`;
export const ACCESS_AUTHORIZATION_COOKIE_NAME = 'CF_Authorization';
export const DEFAULT_DEV_SERVER_URL = 'http://127.0.0.1:5173/';
export const AUTH_SESSION_CHECK_REQUEST = Object.freeze({
  method: 'HEAD',
  redirect: 'manual',
  cache: 'no-store',
  credentials: 'include',
} as const);

export type AuthenticationDestination = 'protected-app' | 'cloudflare-access';

export interface AuthenticationNavigationState {
  readonly protectedWebAppUrl: string;
  readonly accessHostname: string | null;
  readonly active: boolean;
}

export interface AccessAuthorizationCookie {
  readonly name: string;
  readonly value: string;
  readonly expirationDate?: number;
}

export const WINDOW_DEFAULTS = Object.freeze({
  width: 1600,
  height: 900,
  minWidth: 960,
  minHeight: 540,
});

export const DESKTOP_RENDERER_CSS = `
html,
body {
  -webkit-user-select: none;
  user-select: none;
}

input,
textarea,
[contenteditable='true'] {
  -webkit-user-select: text;
  user-select: text;
}

img {
  -webkit-user-drag: none;
}
`;

export const SECURE_WEB_PREFERENCES = Object.freeze({
  contextIsolation: true,
  nodeIntegration: false,
  nodeIntegrationInWorker: false,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  webviewTag: false,
  spellcheck: false,
  safeDialogs: true,
  navigateOnDragDrop: false,
  backgroundThrottling: false,
});

export const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.cloudflarestream.com https://videodelivery.net https://*.videodelivery.net",
  "media-src 'self' data: blob: https://*.cloudflarestream.com https://videodelivery.net https://*.videodelivery.net",
  "connect-src 'self' https://*.cloudflarestream.com https://videodelivery.net https://*.videodelivery.net",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  'frame-src https://*.cloudflarestream.com https://videodelivery.net https://*.videodelivery.net',
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export type RemoteAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'select'
  | 'back'
  | 'restart'
  | 'mute'
  | 'search'
  | 'play-pause'
  | 'fullscreen';

const KEY_ACTIONS: Readonly<Record<string, RemoteAction>> = Object.freeze({
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'select',
  Space: 'select',
  ' ': 'select',
  Escape: 'back',
  Backspace: 'back',
  r: 'restart',
  m: 'mute',
  s: 'search',
  p: 'play-pause',
  F11: 'fullscreen',
});

export function remoteActionForInput(key: string, code = ''): RemoteAction | null {
  if (code === 'Space') return 'select';
  const normalizedKey = key.length === 1 ? key.toLowerCase() : key;
  return KEY_ACTIONS[normalizedKey] ?? null;
}

export function parseLoopbackDevServerUrl(rawUrl = DEFAULT_DEV_SERVER_URL): string {
  const parsed = new URL(rawUrl);
  const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
  const hasRootPathOnly = parsed.pathname === '/' && parsed.search === '' && parsed.hash === '';

  if (
    parsed.protocol !== 'http:' ||
    !loopbackHosts.has(parsed.hostname) ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    !hasRootPathOnly
  ) {
    throw new Error(
      'LELIBRAMBAS_TV_DEV_URL must be a plain HTTP loopback origin with no path, query, or credentials.',
    );
  }

  return `${parsed.origin}/`;
}

export function isAllowedNavigation(targetUrl: string, rendererEntryUrl: string): boolean {
  try {
    const target = new URL(targetUrl);
    const rendererEntry = new URL(rendererEntryUrl);

    if (target.username !== '' || target.password !== '') return false;
    if (rendererEntry.protocol === `${APP_PROTOCOL}:`) {
      return target.protocol === `${APP_PROTOCOL}:` && target.hostname === APP_HOST;
    }

    return target.origin === rendererEntry.origin;
  } catch {
    return false;
  }
}

export function isAllowedStreamFrame(targetUrl: string): boolean {
  try {
    const target = new URL(targetUrl);
    const hostname = target.hostname.toLowerCase();
    const isStreamHost =
      hostname === 'videodelivery.net' ||
      hostname.endsWith('.videodelivery.net') ||
      hostname.endsWith('.cloudflarestream.com');
    return (
      target.protocol === 'https:' &&
      target.username === '' &&
      target.password === '' &&
      target.port === '' &&
      isStreamHost
    );
  } catch {
    return false;
  }
}

export function parseProtectedWebAppUrl(rendererHtml: string): string {
  const canonicalLink = (rendererHtml.match(/<link\b[^>]*>/gi) ?? []).find((tag) =>
    /\brel\s*=\s*(["'])canonical\1/i.test(tag),
  );
  const href = canonicalLink?.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];

  if (!href) throw new Error('The packaged renderer must declare its protected canonical URL.');

  const url = new URL(href);
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('The protected canonical URL must be a plain HTTPS origin.');
  }

  return url.href;
}

export function isCloudflareAccessUrl(targetUrl: string): boolean {
  try {
    const target = new URL(targetUrl);
    const hostname = target.hostname.toLowerCase();
    return (
      target.protocol === 'https:' &&
      target.username === '' &&
      target.password === '' &&
      target.port === '' &&
      hostname !== 'cloudflareaccess.com' &&
      hostname.endsWith('.cloudflareaccess.com')
    );
  } catch {
    return false;
  }
}

export function authenticationDestination(
  targetUrl: string,
  protectedWebAppUrl: string,
  accessHostname: string | null,
): AuthenticationDestination | null {
  try {
    const target = new URL(targetUrl);
    const protectedApp = new URL(protectedWebAppUrl);

    if (
      target.protocol !== 'https:' ||
      target.username !== '' ||
      target.password !== '' ||
      target.port !== ''
    ) {
      return null;
    }

    if (target.origin === protectedApp.origin) return 'protected-app';
    if (!isCloudflareAccessUrl(target.href)) return null;
    if (accessHostname && target.hostname.toLowerCase() !== accessHostname.toLowerCase())
      return null;
    return 'cloudflare-access';
  } catch {
    return null;
  }
}

export function isAllowedAuthenticationNavigation(
  targetUrl: string,
  protectedWebAppUrl: string,
  accessHostname: string | null,
): boolean {
  return authenticationDestination(targetUrl, protectedWebAppUrl, accessHostname) !== null;
}

export function isAllowedTopLevelNavigation(
  targetUrl: string,
  rendererEntryUrl: string,
  authentication: AuthenticationNavigationState | null,
): boolean {
  if (targetUrl === AUTHENTICATION_ERROR_URL) return Boolean(authentication?.active);
  if (isAllowedNavigation(targetUrl, rendererEntryUrl)) return !authentication?.active;
  return Boolean(
    authentication?.active &&
      isAllowedAuthenticationNavigation(
        targetUrl,
        authentication.protectedWebAppUrl,
        authentication.accessHostname,
      ),
  );
}

export function sessionCheckRequiresAuthentication(status: number): boolean {
  return status === 401 || status === 403 || (status >= 300 && status < 400);
}

export function hasValidAccessAuthorizationCookie(
  cookies: readonly AccessAuthorizationCookie[],
  nowSeconds = Date.now() / 1000,
): boolean {
  return cookies.some(
    (cookie) =>
      cookie.name === ACCESS_AUTHORIZATION_COOKIE_NAME &&
      cookie.value.length > 0 &&
      (cookie.expirationDate === undefined || cookie.expirationDate > nowSeconds),
  );
}

export function isExpectedNavigationAbort(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: number | string }).code;
  return code === -3 || code === 'ERR_ABORTED' || error.message.includes('ERR_ABORTED');
}

export function isAllowedRedirect(
  targetUrl: string,
  rendererEntryUrl: string,
  isMainFrame: boolean,
): boolean {
  return (
    isAllowedNavigation(targetUrl, rendererEntryUrl) ||
    (!isMainFrame && isAllowedStreamFrame(targetUrl))
  );
}

export function isAllowedFullscreenPermission(
  permission: string,
  requestingUrl: string,
  rendererEntryUrl: string,
): boolean {
  return (
    permission === 'fullscreen' &&
    (isAllowedNavigation(requestingUrl, rendererEntryUrl) || isAllowedStreamFrame(requestingUrl))
  );
}

export function resolveRendererFile(rendererRoot: string, requestUrl: string): string | null {
  let request: URL;
  let pathname: string;

  try {
    request = new URL(requestUrl);
    pathname = decodeURIComponent(request.pathname);
  } catch {
    return null;
  }

  if (
    request.protocol !== `${APP_PROTOCOL}:` ||
    request.hostname !== APP_HOST ||
    pathname.includes('\0')
  ) {
    return null;
  }

  const relativeRequest = pathname === '/' ? 'index.html' : pathname.replace(/^[/\\]+/, '');
  const absoluteRoot = resolve(rendererRoot);
  const candidate = resolve(absoluteRoot, relativeRequest);
  const relativeCandidate = relative(absoluteRoot, candidate);

  if (
    relativeCandidate === '..' ||
    relativeCandidate.startsWith(`..${sep}`) ||
    isAbsolute(relativeCandidate)
  ) {
    return null;
  }

  return candidate;
}
