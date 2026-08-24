import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  DEFAULT_DEV_SERVER_URL,
  isAllowedNavigation,
  parseLoopbackDevServerUrl,
  PRODUCTION_CSP,
  PRODUCTION_RENDERER_URL,
  remoteActionForInput,
  resolveRendererFile,
  SECURE_WEB_PREFERENCES,
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
  assert.equal(PRODUCTION_CSP.includes("script-src 'self'"), true);
  assert.equal(PRODUCTION_CSP.includes("'unsafe-eval'"), false);
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
      ['F', 'KeyF'],
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
});

test('manifest pins the runtime and portable Windows x64 packaging contract', async () => {
  const manifest = JSON.parse(await readFile(resolve(desktopDirectory, 'package.json'), 'utf8'));
  assert.equal(manifest.devDependencies.electron, '43.4.0');
  assert.equal(manifest.devDependencies['electron-builder'], '26.15.7');
  assert.equal(manifest.main, 'dist-electron/main.js');
  assert.deepEqual(manifest.build.win.target, [{ target: 'portable', arch: ['x64'] }]);
  assert.equal(manifest.build.extraResources[0].from, '../tv/dist');
  assert.equal(typeof manifest.build.nsis.artifactName, 'string');

  const compiledMain = await readFile(resolve(desktopDirectory, manifest.main), 'utf8');
  assert.doesNotMatch(compiledMain, /\bipcMain\b/);
});

test('installed Electron package is the pinned runtime', async () => {
  const electronManifestPath = require.resolve('electron/package.json');
  const electronManifest = JSON.parse(await readFile(electronManifestPath, 'utf8'));
  assert.equal(electronManifest.version, '43.4.0');
});
