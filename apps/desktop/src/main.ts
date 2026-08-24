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
  WINDOW_DEFAULTS,
} from './policy.js';

const smokeMode = process.argv.includes('--smoke-test');
const developmentMode = !app.isPackaged && !smokeMode && process.env.NODE_ENV !== 'production';
const rendererEntryUrl = developmentMode
  ? parseLoopbackDevServerUrl(process.env.LELIBRAMBAS_TV_DEV_URL)
  : PRODUCTION_RENDERER_URL;

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
    if (!isAllowedNavigation(details.url, rendererEntryUrl)) details.preventDefault();
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

function installSmokeProbe(window: BrowserWindow): void {
  const timeout = setTimeout(() => {
    console.error('[desktop-smoke] Timed out while loading the packaged TV renderer.');
    app.exit(1);
  }, 15_000);

  window.webContents.once('did-finish-load', () => {
    clearTimeout(timeout);
    const title = window.webContents.getTitle();
    if (title !== 'LeliBramBas+') {
      console.error(`[desktop-smoke] Unexpected renderer title: ${JSON.stringify(title)}`);
      app.exit(1);
      return;
    }

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
    title: 'LeliBramBas+',
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
