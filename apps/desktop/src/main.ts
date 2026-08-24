import { app, BrowserWindow, Menu, net, protocol, session } from 'electron';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  APP_PROTOCOL,
  parseLoopbackDevServerUrl,
  PRODUCTION_CSP,
  PRODUCTION_RENDERER_URL,
  remoteActionForInput,
  resolveRendererFile,
  SECURE_WEB_PREFERENCES,
  isAllowedNavigation,
  isAllowedStreamFrame,
  WINDOW_DEFAULTS,
} from './policy.js';

const streamSmokeMode = process.argv.includes('--stream-smoke-test');
const smokeMode = process.argv.includes('--smoke-test') || streamSmokeMode;
const developmentMode = !app.isPackaged && !smokeMode && process.env.NODE_ENV !== 'production';
const rendererEntryUrl = developmentMode
  ? parseLoopbackDevServerUrl(process.env.LELIBRAMBAS_TV_DEV_URL)
  : streamSmokeMode
    ? `${PRODUCTION_RENDERER_URL}?screen=details&capture=1&video=1`
    : PRODUCTION_RENDERER_URL;

if (smokeMode) {
  const smokeDataRoot = process.env.LELIBRAMBAS_ELECTRON_SMOKE_DATA_ROOT;
  if (!smokeDataRoot) {
    throw new Error('Electron smoke mode must be launched through scripts/run-smoke.mjs.');
  }
  app.setPath('userData', smokeDataRoot);
  app.setPath('sessionData', join(smokeDataRoot, 'session'));
}

let mainWindow: BrowserWindow | null = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

app.enableSandbox();

function rendererRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'tv-dist')
    : resolve(app.getAppPath(), '../tv/dist');
}

function windowIconPath(): string {
  return developmentMode
    ? resolve(app.getAppPath(), '../tv/public/favicon.png')
    : join(rendererRoot(), 'favicon.png');
}

function installLocalRendererProtocol(): void {
  protocol.handle(APP_PROTOCOL, async (request) => {
    const filePath = resolveRendererFile(rendererRoot(), request.url);
    if (!filePath) return new Response('Not found', { status: 404 });

    try {
      const response = await net.fetch(pathToFileURL(filePath).toString());
      if (!filePath.toLowerCase().endsWith('.html')) return response;

      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', PRODUCTION_CSP);
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      headers.set('Referrer-Policy', 'no-referrer');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return new Response('Local renderer asset not found', { status: 404 });
    }
  });
}

function installSessionRestrictions(): void {
  const defaultSession = session.defaultSession;
  defaultSession.setPermissionCheckHandler(() => false);
  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  );
  defaultSession.setDevicePermissionHandler(() => false);
  defaultSession.on('will-download', (event) => event.preventDefault());
}

function installWindowRestrictions(window: BrowserWindow): void {
  const contents = window.webContents;

  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.on('will-navigate', (details) => {
    if (!isAllowedNavigation(details.url, rendererEntryUrl)) details.preventDefault();
  });
  contents.on('will-frame-navigate', (details) => {
    if (!isAllowedNavigation(details.url, rendererEntryUrl) && !isAllowedStreamFrame(details.url))
      details.preventDefault();
  });
  contents.on('will-redirect', (details) => {
    if (!isAllowedNavigation(details.url, rendererEntryUrl)) details.preventDefault();
  });
  contents.on('before-input-event', (event, input) => {
    if (remoteActionForInput(input.key, input.code) !== 'fullscreen') return;
    if (input.alt || input.control || input.meta || input.shift) return;

    event.preventDefault();
    if (input.type === 'keyDown' && !input.isAutoRepeat) {
      window.setFullScreen(!window.isFullScreen());
    }
  });
}

async function verifyPackagedStreamPlayback(window: BrowserWindow): Promise<void> {
  const state = (await window.webContents.executeJavaScript(`
    (async () => {
      const waitFor = async (probe, timeoutMs = 20000) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
          const value = probe();
          if (value) return value;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error('Timed out waiting for packaged playback.');
      };

      const detailPlay = await waitFor(() => document.querySelector('[data-focus-id="detail-play"]'));
      detailPlay.click();
      const frame = await waitFor(() => document.querySelector('iframe.stream-iframe'));
      return {
        src: frame.src,
        catalogueId: frame.dataset.catalogueId,
        streamVideoId: frame.dataset.streamVideoId,
      };
    })()
  `)) as { src: string; catalogueId: string; streamVideoId: string };

  if (
    state.catalogueId !== '1' ||
    !state.streamVideoId.includes('.cloudflarestream.com/') ||
    !state.src.startsWith('https://') ||
    !state.src.endsWith('/iframe')
  ) {
    throw new Error('Packaged Stream player did not receive the selected catalogue row.');
  }
  console.log(
    `[desktop-stream-smoke] OK: catalogue ${state.catalogueId} opened its Stream iframe.`,
  );
}

function installSmokeProbe(window: BrowserWindow): void {
  const timeout = setTimeout(
    () => {
      console.error(
        streamSmokeMode
          ? '[desktop-stream-smoke] Timed out while testing packaged playback.'
          : '[desktop-smoke] Timed out while loading the packaged TV renderer.',
      );
      app.exit(1);
    },
    streamSmokeMode ? 30_000 : 15_000,
  );

  window.webContents.once('did-finish-load', () => {
    const title = window.webContents.getTitle();
    if (title !== 'LELIBRAMBAS+') {
      clearTimeout(timeout);
      console.error(`[desktop-smoke] Unexpected renderer title: ${JSON.stringify(title)}`);
      app.exit(1);
      return;
    }

    if (streamSmokeMode) {
      void verifyPackagedStreamPlayback(window)
        .then(() => {
          clearTimeout(timeout);
          app.exit(0);
        })
        .catch(() => {
          clearTimeout(timeout);
          console.error('[desktop-stream-smoke] Packaged Stream playback failed.');
          app.exit(1);
        });
      return;
    }

    clearTimeout(timeout);
    console.log(`[desktop-smoke] OK ${window.webContents.getURL()} ${title}`);
    app.exit(0);
  });

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      if (!isMainFrame) return;
      clearTimeout(timeout);
      console.error(
        `[desktop-smoke] Failed to load ${validatedUrl}: ${errorCode} ${errorDescription}`,
      );
      app.exit(1);
    },
  );
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    title: 'LELIBRAMBAS+',
    icon: windowIconPath(),
    width: WINDOW_DEFAULTS.width,
    height: WINDOW_DEFAULTS.height,
    minWidth: WINDOW_DEFAULTS.minWidth,
    minHeight: WINDOW_DEFAULTS.minHeight,
    useContentSize: true,
    show: false,
    backgroundColor: '#03050B',
    autoHideMenuBar: true,
    fullscreenable: true,
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      devTools: developmentMode,
    },
  });

  window.setAspectRatio(WINDOW_DEFAULTS.aspectRatio);
  installWindowRestrictions(window);
  if (smokeMode) installSmokeProbe(window);

  window.once('ready-to-show', () => {
    if (!smokeMode) window.show();
  });
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });

  void window.loadURL(rendererEntryUrl).catch((error: unknown) => {
    console.error('[desktop] Renderer failed to load.', error);
    if (smokeMode) app.exit(1);
  });

  return window;
}

app
  .whenReady()
  .then(() => {
    app.setAppUserModelId('com.lelibrambas.plus');
    Menu.setApplicationMenu(null);
    installLocalRendererProtocol();
    installSessionRestrictions();
    mainWindow = createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
    });
  })
  .catch((error: unknown) => {
    console.error('[desktop] Startup failed.', error);
    app.exit(1);
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
