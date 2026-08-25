import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  ACCESS_AUTHORIZATION_COOKIE_NAME,
  AUTHENTICATION_ERROR_URL,
  AUTH_SESSION_CHECK_REQUEST,
  authenticationDestination,
  DEFAULT_DEV_SERVER_URL,
  DESKTOP_RENDERER_CSS,
  hasValidAccessAuthorizationCookie,
  isAllowedAuthenticationNavigation,
  isAllowedTopLevelNavigation,
  isCloudflareAccessUrl,
  isExpectedNavigationAbort,
  isAllowedFullscreenPermission,
  isAllowedNavigation,
  isAllowedRedirect,
  isAllowedStreamFrame,
  parseLoopbackDevServerUrl,
  parseProtectedWebAppUrl,
  PRODUCTION_CSP,
  PRODUCTION_RENDERER_URL,
  remoteActionForInput,
  resolveRendererFile,
  SECURE_WEB_PREFERENCES,
  sessionCheckRequiresAuthentication,
  WINDOW_DEFAULTS,
} from '../dist-electron/policy.js';

const desktopDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(desktopDirectory, 'package.json'));

test('security-sensitive BrowserWindow defaults stay locked down', () => {
  assert.equal(SECURE_WEB_PREFERENCES.contextIsolation, true);
  assert.equal(SECURE_WEB_PREFERENCES.nodeIntegration, false);
  assert.equal(SECURE_WEB_PREFERENCES.nodeIntegrationInWorker, false);
  assert.equal(SECURE_WEB_PREFERENCES.sandbox, true);
  assert.equal(SECURE_WEB_PREFERENCES.webSecurity, true);
  assert.equal(SECURE_WEB_PREFERENCES.allowRunningInsecureContent, false);
  assert.equal(SECURE_WEB_PREFERENCES.webviewTag, false);
  assert.equal(WINDOW_DEFAULTS.width / WINDOW_DEFAULTS.height, 16 / 9);
  assert.equal(WINDOW_DEFAULTS.minWidth, 960);
  assert.equal(WINDOW_DEFAULTS.minHeight, 540);
  assert.match(DESKTOP_RENDERER_CSS, /user-select: none/);
  assert.match(DESKTOP_RENDERER_CSS, /input,[\s\S]*user-select: text/);
  assert.equal(PRODUCTION_CSP.includes("script-src 'self'"), true);
  assert.equal(PRODUCTION_CSP.includes("'unsafe-eval'"), false);
  assert.equal(PRODUCTION_CSP.includes('frame-src https://*.cloudflarestream.com'), true);
  assert.equal(PRODUCTION_CSP.includes('https://*.cloudflarestream.com'), true);
  assert.equal(PRODUCTION_CSP.includes('http:'), false);
  assert.equal(PRODUCTION_CSP.includes('ws:'), false);
});

test('only HTTP loopback origins can become development renderers', () => {
  assert.equal(parseLoopbackDevServerUrl(), DEFAULT_DEV_SERVER_URL);
  assert.equal(parseLoopbackDevServerUrl('http://localhost:9000'), 'http://localhost:9000/');
  assert.throws(() => parseLoopbackDevServerUrl('https://127.0.0.1:5173'));
  assert.throws(() => parseLoopbackDevServerUrl('http://192.168.1.20:5173'));
  assert.throws(() => parseLoopbackDevServerUrl('http://127.0.0.1:5173/other'));
});

test('navigation remains inside the selected renderer origin', () => {
  assert.equal(isAllowedNavigation('http://127.0.0.1:5173/search', DEFAULT_DEV_SERVER_URL), true);
  assert.equal(isAllowedNavigation('https://example.com/', DEFAULT_DEV_SERVER_URL), false);
  assert.equal(
    isAllowedNavigation('lelibrambas://app/assets/index.js', PRODUCTION_RENDERER_URL),
    true,
  );
  assert.equal(
    isAllowedNavigation('lelibrambas://other/index.html', PRODUCTION_RENDERER_URL),
    false,
  );
  assert.equal(
    isAllowedNavigation('file:///C:/Windows/System32/calc.exe', PRODUCTION_RENDERER_URL),
    false,
  );
});

test('only secure Cloudflare Stream hosts are allowed in playback frames', () => {
  assert.equal(
    isAllowedStreamFrame(
      'https://customer-example.cloudflarestream.com/0123456789abcdef0123456789abcdef/iframe',
    ),
    true,
  );
  assert.equal(
    isAllowedStreamFrame('http://customer-example.cloudflarestream.com/id/iframe'),
    false,
  );
  assert.equal(isAllowedStreamFrame('https://example.com/id/iframe'), false);
});

test('desktop authentication is derived from the web canonical URL and fails closed', () => {
  const protectedUrl = 'https://archive.example/';
  assert.equal(
    parseProtectedWebAppUrl(
      '<html><head><link rel="canonical" href="https://archive.example/" /></head></html>',
    ),
    protectedUrl,
  );
  assert.throws(() => parseProtectedWebAppUrl('<html><head></head></html>'));
  assert.throws(() =>
    parseProtectedWebAppUrl('<link rel="canonical" href="http://archive.example/" />'),
  );
  assert.throws(() =>
    parseProtectedWebAppUrl('<link rel="canonical" href="https://archive.example/app" />'),
  );
});

test('authentication navigation is limited to the protected app and one Access team', () => {
  const protectedUrl = 'https://archive.example/';
  const accessUrl =
    'https://family.cloudflareaccess.com/cdn-cgi/access/login/archive.example?kid=synthetic';

  assert.equal(isCloudflareAccessUrl(accessUrl), true);
  assert.equal(isCloudflareAccessUrl('https://cloudflareaccess.com/'), false);
  assert.equal(isCloudflareAccessUrl('https://family.cloudflareaccess.com.evil.example/'), false);
  assert.equal(authenticationDestination('/relative', protectedUrl, null), null);
  assert.equal(
    authenticationDestination('https://archive.example/callback', protectedUrl, null),
    'protected-app',
  );
  assert.equal(authenticationDestination(accessUrl, protectedUrl, null), 'cloudflare-access');
  assert.equal(isAllowedAuthenticationNavigation(accessUrl, protectedUrl, null), true);
  assert.equal(
    isAllowedAuthenticationNavigation(accessUrl, protectedUrl, 'family.cloudflareaccess.com'),
    true,
  );
  assert.equal(
    isAllowedAuthenticationNavigation(
      'https://other.cloudflareaccess.com/cdn-cgi/access/login',
      protectedUrl,
      'family.cloudflareaccess.com',
    ),
    false,
  );
  assert.equal(
    isAllowedAuthenticationNavigation('https://example.com/', protectedUrl, null),
    false,
  );

  const authenticating = {
    protectedWebAppUrl: protectedUrl,
    accessHostname: 'family.cloudflareaccess.com',
    active: true,
  };
  assert.equal(
    isAllowedTopLevelNavigation(PRODUCTION_RENDERER_URL, PRODUCTION_RENDERER_URL, authenticating),
    false,
  );
  assert.equal(
    isAllowedTopLevelNavigation(AUTHENTICATION_ERROR_URL, PRODUCTION_RENDERER_URL, authenticating),
    true,
  );
  assert.equal(
    isAllowedTopLevelNavigation(accessUrl, PRODUCTION_RENDERER_URL, authenticating),
    true,
  );
  assert.equal(
    isAllowedTopLevelNavigation(PRODUCTION_RENDERER_URL, PRODUCTION_RENDERER_URL, {
      ...authenticating,
      active: false,
    }),
    true,
  );
  assert.equal(
    isAllowedTopLevelNavigation(AUTHENTICATION_ERROR_URL, PRODUCTION_RENDERER_URL, {
      ...authenticating,
      active: false,
    }),
    false,
  );
});

test('session checks include persistent Access cookies and fail closed on auth responses', () => {
  assert.deepEqual(AUTH_SESSION_CHECK_REQUEST, {
    method: 'HEAD',
    redirect: 'manual',
    cache: 'no-store',
    credentials: 'include',
  });
  assert.equal(sessionCheckRequiresAuthentication(200), false);
  assert.equal(sessionCheckRequiresAuthentication(302), true);
  assert.equal(sessionCheckRequiresAuthentication(401), true);
  assert.equal(sessionCheckRequiresAuthentication(403), true);
  assert.equal(sessionCheckRequiresAuthentication(500), false);

  const now = 1_800_000_000;
  assert.equal(hasValidAccessAuthorizationCookie([], now), false);
  assert.equal(
    hasValidAccessAuthorizationCookie(
      [{ name: ACCESS_AUTHORIZATION_COOKIE_NAME, value: 'synthetic-token', expirationDate: now }],
      now,
    ),
    false,
  );
  assert.equal(
    hasValidAccessAuthorizationCookie(
      [
        {
          name: ACCESS_AUTHORIZATION_COOKIE_NAME,
          value: 'synthetic-token',
          expirationDate: now + 60,
        },
      ],
      now,
    ),
    true,
  );
  assert.equal(
    hasValidAccessAuthorizationCookie(
      [{ name: ACCESS_AUTHORIZATION_COOKIE_NAME, value: 'synthetic-session-token' }],
      now,
    ),
    true,
  );
  assert.equal(
    isExpectedNavigationAbort(Object.assign(new Error('navigation'), { code: -3 })),
    true,
  );
  assert.equal(isExpectedNavigationAbort(new Error('net::ERR_ABORTED (-3)')), true);
  assert.equal(isExpectedNavigationAbort(new Error('net::ERR_FAILED (-2)')), false);
});

test('redirects stay local except for secure Stream subframes', () => {
  const streamUrl =
    'https://customer-example.cloudflarestream.com/0123456789abcdef0123456789abcdef/iframe';
  assert.equal(isAllowedRedirect(PRODUCTION_RENDERER_URL, PRODUCTION_RENDERER_URL, true), true);
  assert.equal(isAllowedRedirect(streamUrl, PRODUCTION_RENDERER_URL, false), true);
  assert.equal(isAllowedRedirect(streamUrl, PRODUCTION_RENDERER_URL, true), false);
  assert.equal(isAllowedRedirect('https://example.com/', PRODUCTION_RENDERER_URL, false), false);
});

test('fullscreen is the only permission granted to trusted app and Stream frames', () => {
  const streamUrl =
    'https://customer-example.cloudflarestream.com/0123456789abcdef0123456789abcdef/iframe';
  assert.equal(
    isAllowedFullscreenPermission('fullscreen', PRODUCTION_RENDERER_URL, PRODUCTION_RENDERER_URL),
    true,
  );
  assert.equal(
    isAllowedFullscreenPermission('fullscreen', streamUrl, PRODUCTION_RENDERER_URL),
    true,
  );
  assert.equal(
    isAllowedFullscreenPermission('media', PRODUCTION_RENDERER_URL, PRODUCTION_RENDERER_URL),
    false,
  );
  assert.equal(
    isAllowedFullscreenPermission('fullscreen', 'https://example.com/', PRODUCTION_RENDERER_URL),
    false,
  );
});

test('custom protocol mapping cannot escape the packaged renderer root', () => {
  const root = resolve(desktopDirectory, 'fixture-root');
  assert.equal(
    resolveRendererFile(root, 'lelibrambas://app/assets/app.js'),
    resolve(root, 'assets/app.js'),
  );
  assert.equal(resolveRendererFile(root, 'lelibrambas://app/%2e%2e%2fsecret.txt'), null);
  assert.equal(resolveRendererFile(root, 'lelibrambas://other/index.html'), null);
  assert.equal(resolveRendererFile(root, 'file:///etc/passwd'), null);
});

test('remote keyboard policy covers the desktop contract without consuming renderer keys', () => {
  assert.deepEqual(
    [
      ['ArrowUp', ''],
      ['ArrowDown', ''],
      ['ArrowLeft', ''],
      ['ArrowRight', ''],
      ['Enter', ''],
      [' ', 'Space'],
      ['Escape', ''],
      ['Backspace', ''],
      ['R', 'KeyR'],
      ['M', 'KeyM'],
      ['S', 'KeyS'],
      ['P', 'KeyP'],
      ['F11', 'F11'],
    ].map(([key, code]) => remoteActionForInput(key, code)),
    [
      'up',
      'down',
      'left',
      'right',
      'select',
      'select',
      'back',
      'back',
      'restart',
      'mute',
      'search',
      'play-pause',
      'fullscreen',
    ],
  );
  assert.equal(remoteActionForInput('f', 'KeyF'), null);
});

test('manifest pins the runtime and portable Windows x64 packaging contract', async () => {
  const manifest = JSON.parse(await readFile(resolve(desktopDirectory, 'package.json'), 'utf8'));
  assert.equal(manifest.devDependencies.electron, '43.4.0');
  assert.equal(manifest.devDependencies['electron-builder'], '26.15.7');
  assert.equal(manifest.main, 'dist-electron/main.js');
  assert.match(manifest.scripts['smoke:electron'], /scripts\/run-smoke\.mjs$/);
  assert.match(manifest.scripts['smoke:stream'], /scripts\/run-smoke\.mjs --stream$/);
  assert.deepEqual(manifest.build.win.target, [{ target: 'portable', arch: ['x64'] }]);
  assert.equal(manifest.build.win.icon, '../tv/public/favicon.png');
  assert.equal(manifest.build.extraResources[0].from, '../tv/dist');
  assert.equal(typeof manifest.build.nsis.artifactName, 'string');

  const compiledMain = await readFile(resolve(desktopDirectory, manifest.main), 'utf8');
  assert.doesNotMatch(compiledMain, /\bipcMain\b/);
  assert.doesNotMatch(compiledMain, /no-sandbox|disable-gpu|disableHardwareAcceleration/);
});

test('installed Electron package is the pinned runtime', async () => {
  const electronManifestPath = require.resolve('electron/package.json');
  const electronManifest = JSON.parse(await readFile(electronManifestPath, 'utf8'));
  assert.equal(electronManifest.version, '43.4.0');
});
