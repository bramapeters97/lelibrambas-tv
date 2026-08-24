import { isAbsolute, relative, resolve, sep } from 'node:path';

export const APP_PROTOCOL = 'lelibrambas';
export const APP_HOST = 'app';
export const PRODUCTION_RENDERER_URL = `${APP_PROTOCOL}://${APP_HOST}/index.html`;
export const DEFAULT_DEV_SERVER_URL = 'http://127.0.0.1:5173/';

export const WINDOW_DEFAULTS = Object.freeze({
  width: 1600,
  height: 900,
  minWidth: 960,
  minHeight: 540,
  aspectRatio: 16 / 9,
});

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
  "img-src 'self' data: blob: http: https:",
  "media-src 'self' data: blob: http: https:",
  "connect-src 'self' http: https: ws: wss:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-src 'none'",
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
  f: 'fullscreen',
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
