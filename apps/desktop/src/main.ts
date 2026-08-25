import { app, BrowserWindow, Menu, net, protocol, session } from 'electron';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ACCESS_AUTHORIZATION_COOKIE_NAME,
  APP_PROTOCOL,
  AUTHENTICATION_ERROR_URL,
  AUTH_SESSION_CHECK_REQUEST,
  authenticationDestination,
  DESKTOP_RENDERER_CSS,
  hasValidAccessAuthorizationCookie,
  isExpectedNavigationAbort,
  isAllowedFullscreenPermission,
  isAllowedTopLevelNavigation,
  parseLoopbackDevServerUrl,
  parseProtectedWebAppUrl,
  PRODUCTION_CSP,
  PRODUCTION_RENDERER_URL,
  remoteActionForInput,
  resolveRendererFile,
  SECURE_WEB_PREFERENCES,
  sessionCheckRequiresAuthentication,
  isAllowedNavigation,
  isAllowedStreamFrame,
  WINDOW_DEFAULTS,
} from './policy.js';

const streamSmokeRequested = process.argv.includes('--stream-smoke-test');
const smokeRequested = process.argv.includes('--smoke-test') || streamSmokeRequested;
const sourceStreamSmokeMode = !app.isPackaged && streamSmokeRequested;
const sourceSmokeMode = !app.isPackaged && smokeRequested;
const packagedAuthenticationSmokeMode = app.isPackaged && smokeRequested;
const smokeMode = sourceSmokeMode || packagedAuthenticationSmokeMode;
const developmentMode =
  !app.isPackaged && !sourceSmokeMode && process.env.NODE_ENV !== 'production';
const rendererEntryUrl = developmentMode
  ? parseLoopbackDevServerUrl(process.env.LELIBRAMBAS_TV_DEV_URL)
  : sourceStreamSmokeMode
    ? `${PRODUCTION_RENDERER_URL}?screen=details&capture=1&video=1`
    : PRODUCTION_RENDERER_URL;
const AUTH_SESSION_CHECK_INTERVAL_MS = 5 * 60_000;

if (smokeMode) {
  const smokeDataRoot = process.env.LELIBRAMBAS_ELECTRON_SMOKE_DATA_ROOT;
  if (!smokeDataRoot) {
    throw new Error('Electron smoke mode must be launched through scripts/run-smoke.mjs.');
  }
  app.setPath('userData', smokeDataRoot);
  app.setPath('sessionData', join(smokeDataRoot, 'session'));
}

let mainWindow: BrowserWindow | null = null;

interface AuthenticationState {
  readonly protectedWebAppUrl: string;
  accessHostname: string | null;
  active: boolean;
  checking: boolean;
  completing: boolean;
  showingError: boolean;
}

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

function protectedWebAppUrl(): string {
  const rendererHtml = readFileSync(join(rendererRoot(), 'index.html'), 'utf8');
  return parseProtectedWebAppUrl(rendererHtml);
}

function authenticationErrorResponse(retryUrl: string): Response {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LELIBRAMBAS+ — Sign-in required</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      html, body { width: 100%; min-height: 100%; margin: 0; }
      body {
        display: grid;
        min-height: 100vh;
        place-items: center;
        overflow: hidden;
        color: #f7f5ef;
        background:
          radial-gradient(circle at 50% 20%, rgba(92, 45, 22, 0.32), transparent 42%),
          linear-gradient(180deg, #080b13 0%, #03050b 100%);
      }
      main { width: min(520px, calc(100vw - 48px)); text-align: center; }
      .brand { margin: 0 0 34px; color: #e9c778; font-size: clamp(28px, 5vw, 48px); font-weight: 800; letter-spacing: 0.08em; }
      h1 { margin: 0 0 12px; font-size: clamp(24px, 4vw, 36px); }
      p { margin: 0 auto 28px; max-width: 44ch; color: #b8bac2; font-size: 16px; line-height: 1.6; }
      a {
        display: inline-flex;
        min-height: 48px;
        align-items: center;
        justify-content: center;
        padding: 0 24px;
        border-radius: 999px;
        color: #090b10;
        background: #e9c778;
        font-weight: 800;
        text-decoration: none;
        transition: transform 160ms ease, filter 160ms ease;
      }
      a:hover, a:focus-visible { filter: brightness(1.08); transform: translateY(-1px); }
      a:focus-visible { outline: 3px solid #ffffff; outline-offset: 4px; }
    </style>
  </head>
  <body>
    <main>
      <p class="brand">LELIBRAMBAS+</p>
      <h1>Sign-in could not be verified</h1>
      <p>The protected login is unavailable or your session has expired. Check your connection and try again.</p>
      <a href="${retryUrl}">Try again</a>
    </main>
  </body>
</html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function installLocalRendererProtocol(): void {
  protocol.handle(APP_PROTOCOL, async (request) => {
    if (request.url === AUTHENTICATION_ERROR_URL) {
      return authenticationErrorResponse(protectedWebAppUrl());
    }
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
  defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) =>
    Boolean(
      webContents && isAllowedFullscreenPermission(permission, requestingOrigin, rendererEntryUrl),
    ),
  );
  defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) =>
    callback(isAllowedFullscreenPermission(permission, details.requestingUrl, rendererEntryUrl)),
  );
  defaultSession.setDevicePermissionHandler(() => false);
  defaultSession.on('will-download', (event) => event.preventDefault());
}

function installWindowRestrictions(
  window: BrowserWindow,
  authentication: AuthenticationState | null,
): void {
  const contents = window.webContents;

  const allowTopLevelNavigation = (targetUrl: string): boolean => {
    if (!isAllowedTopLevelNavigation(targetUrl, rendererEntryUrl, authentication)) return false;

    if (authentication) {
      const destination = authenticationDestination(
        targetUrl,
        authentication.protectedWebAppUrl,
        authentication.accessHostname,
      );
      if (destination === 'cloudflare-access' && !authentication.accessHostname) {
        authentication.accessHostname = new URL(targetUrl).hostname.toLowerCase();
      }
    }
    return true;
  };

  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.on('dom-ready', () => {
    if (!isAllowedNavigation(contents.getURL(), rendererEntryUrl)) return;
    void contents
      .insertCSS(DESKTOP_RENDERER_CSS)
      .catch((error: unknown) => console.error('[desktop] Renderer polish failed.', error));
  });
  contents.on('will-navigate', (details) => {
    if (!allowTopLevelNavigation(details.url)) details.preventDefault();
  });
  contents.on('will-frame-navigate', (details) => {
    if (!allowTopLevelNavigation(details.url) && !isAllowedStreamFrame(details.url))
      details.preventDefault();
  });
  contents.on('will-redirect', (details) => {
    if (
      !allowTopLevelNavigation(details.url) &&
      (details.isMainFrame || !isAllowedStreamFrame(details.url))
    )
      details.preventDefault();
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

  const playerUrl = new URL(state.src);

  if (
    state.catalogueId !== '1' ||
    !state.streamVideoId.includes('.cloudflarestream.com/') ||
    !isAllowedStreamFrame(state.src) ||
    !playerUrl.pathname.endsWith('/iframe')
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
        sourceStreamSmokeMode
          ? '[desktop-stream-smoke] Timed out while testing packaged playback.'
          : '[desktop-smoke] Timed out while loading the packaged TV renderer.',
      );
      app.exit(1);
    },
    sourceStreamSmokeMode ? 30_000 : 15_000,
  );

  window.webContents.once('did-finish-load', () => {
    const title = window.webContents.getTitle();
    if (title !== 'LELIBRAMBAS+') {
      clearTimeout(timeout);
      console.error(`[desktop-smoke] Unexpected renderer title: ${JSON.stringify(title)}`);
      app.exit(1);
      return;
    }

    if (sourceStreamSmokeMode) {
      void verifyPackagedStreamPlayback(window)
        .then(() => {
          clearTimeout(timeout);
          app.exit(0);
        })
        .catch((error: unknown) => {
          clearTimeout(timeout);
          console.error(
            '[desktop-stream-smoke] Packaged Stream playback failed.',
            error instanceof Error ? error.message : error,
          );
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

function installAuthenticationSmokeProbe(
  window: BrowserWindow,
  authentication: AuthenticationState,
): void {
  const timeout = setTimeout(() => {
    console.error('[desktop-auth-smoke] Timed out while loading the protected email login.');
    app.exit(1);
  }, 30_000);

  window.webContents.on('did-finish-load', () => {
    const currentUrl = window.webContents.getURL();
    if (currentUrl === AUTHENTICATION_ERROR_URL) {
      clearTimeout(timeout);
      console.error('[desktop-auth-smoke] The protected email login was unavailable.');
      app.exit(1);
      return;
    }
    if (
      authenticationDestination(
        currentUrl,
        authentication.protectedWebAppUrl,
        authentication.accessHostname,
      ) !== 'cloudflare-access'
    ) {
      return;
    }

    void window.webContents
      .executeJavaScript(
        'Boolean(document.querySelector(\'input[type="email"], input[name="email"]\'))',
      )
      .then((emailInputVisible: boolean) => {
        clearTimeout(timeout);
        if (!emailInputVisible) {
          console.error('[desktop-auth-smoke] The Access page did not expose its email field.');
          app.exit(1);
          return;
        }
        console.log('[desktop-auth-smoke] OK: protected email login is visible.');
        app.exit(0);
      })
      .catch((error: unknown) => {
        clearTimeout(timeout);
        console.error('[desktop-auth-smoke] Could not inspect the protected email login.', error);
        app.exit(1);
      });
  });
}

function installAuthenticationFlow(
  window: BrowserWindow,
  authentication: AuthenticationState,
): () => void {
  const contents = window.webContents;

  const readAccessCookie = async (): Promise<boolean> => {
    const cookies = await contents.session.cookies.get({
      url: authentication.protectedWebAppUrl,
      name: ACCESS_AUTHORIZATION_COOKIE_NAME,
    });
    return hasValidAccessAuthorizationCookie(cookies);
  };

  const showAuthenticationError = (): void => {
    authentication.active = true;
    authentication.accessHostname = null;
    if (authentication.showingError || window.isDestroyed()) return;
    authentication.showingError = true;
    window.hide();
    void window
      .loadURL(AUTHENTICATION_ERROR_URL)
      .then(() => {
        if (!packagedAuthenticationSmokeMode && !window.isDestroyed()) window.show();
      })
      .catch((error: unknown) => {
        console.error('[desktop] The fail-closed authentication error page failed to load.', error);
      })
      .finally(() => {
        authentication.showingError = false;
      });
  };

  const beginAuthentication = (): void => {
    authentication.active = true;
    authentication.accessHostname = null;
    window.hide();
    void window.loadURL(authentication.protectedWebAppUrl).catch((error: unknown) => {
      if (!authentication.active || window.isDestroyed() || isExpectedNavigationAbort(error)) {
        return;
      }
      console.error('[desktop] Protected login failed to load.', error);
      if (packagedAuthenticationSmokeMode) app.exit(1);
      else showAuthenticationError();
    });
  };

  const verifySession = async (): Promise<void> => {
    if (authentication.active || authentication.checking || window.isDestroyed()) return;
    authentication.checking = true;
    try {
      if (!(await readAccessCookie())) {
        beginAuthentication();
        return;
      }

      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 15_000);
      let response: Response;
      try {
        response = await contents.session.fetch(authentication.protectedWebAppUrl, {
          ...AUTH_SESSION_CHECK_REQUEST,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(abortTimer);
      }

      if (sessionCheckRequiresAuthentication(response.status)) {
        beginAuthentication();
      }
    } catch (error: unknown) {
      console.warn(
        '[desktop] Session verification was deferred because the protected origin was unavailable.',
        error instanceof Error ? error.message : error,
      );
    } finally {
      authentication.checking = false;
    }
  };

  contents.on('did-start-navigation', (details) => {
    if (
      details.isMainFrame &&
      authentication.active &&
      authenticationDestination(
        details.url,
        authentication.protectedWebAppUrl,
        authentication.accessHostname,
      ) === 'protected-app'
    ) {
      window.hide();
    }
  });

  contents.on('did-navigate', (_event, currentUrl, httpResponseCode) => {
    if (!authentication.active) return;
    const destination = authenticationDestination(
      currentUrl,
      authentication.protectedWebAppUrl,
      authentication.accessHostname,
    );

    if (destination === 'cloudflare-access' && !authentication.accessHostname) {
      authentication.accessHostname = new URL(currentUrl).hostname.toLowerCase();
      return;
    }
    if (destination !== 'protected-app' || currentUrl !== authentication.protectedWebAppUrl) return;

    if (httpResponseCode < 200 || httpResponseCode >= 300) {
      showAuthenticationError();
      return;
    }
    if (authentication.completing) return;
    authentication.completing = true;
    void readAccessCookie()
      .then((accessCookieIsValid) => {
        if (
          !accessCookieIsValid ||
          !authentication.active ||
          contents.getURL() !== authentication.protectedWebAppUrl
        ) {
          if (authentication.active) showAuthenticationError();
          return;
        }

        authentication.active = false;
        authentication.accessHostname = null;
        return window.loadURL(PRODUCTION_RENDERER_URL).catch((error: unknown) => {
          console.error('[desktop] Authenticated renderer failed to load.', error);
          if (packagedAuthenticationSmokeMode) app.exit(1);
        });
      })
      .catch((error: unknown) => {
        console.error('[desktop] Access cookie verification failed.', error);
        showAuthenticationError();
      })
      .finally(() => {
        authentication.completing = false;
      });
  });

  contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    if (
      !isMainFrame ||
      !authentication.active ||
      errorCode === -3 ||
      validatedUrl === AUTHENTICATION_ERROR_URL
    ) {
      return;
    }
    console.error(
      `[desktop] Protected login failed to load ${validatedUrl}: ${errorCode} ${errorDescription}`,
    );
    if (packagedAuthenticationSmokeMode) app.exit(1);
    else showAuthenticationError();
  });

  const interval = setInterval(() => void verifySession(), AUTH_SESSION_CHECK_INTERVAL_MS);
  interval.unref();
  window.on('focus', () => void verifySession());
  window.once('closed', () => clearInterval(interval));
  return beginAuthentication;
}

function createMainWindow(): BrowserWindow {
  const authentication: AuthenticationState | null = app.isPackaged
    ? {
        protectedWebAppUrl: protectedWebAppUrl(),
        accessHostname: null,
        active: true,
        checking: false,
        completing: false,
        showingError: false,
      }
    : null;
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

  installWindowRestrictions(window, authentication);
  const startAuthentication = authentication
    ? installAuthenticationFlow(window, authentication)
    : null;
  if (sourceSmokeMode) installSmokeProbe(window);
  if (packagedAuthenticationSmokeMode && authentication) {
    installAuthenticationSmokeProbe(window, authentication);
  }

  window.webContents.on('did-finish-load', () => {
    if (smokeMode || window.isVisible()) return;
    const currentUrl = window.webContents.getURL();
    const localRendererIsReady =
      isAllowedNavigation(currentUrl, rendererEntryUrl) && !authentication?.active;
    if (
      localRendererIsReady ||
      (authentication?.active && currentUrl === AUTHENTICATION_ERROR_URL) ||
      (authentication &&
        authenticationDestination(
          currentUrl,
          authentication.protectedWebAppUrl,
          authentication.accessHostname,
        ) === 'cloudflare-access')
    ) {
      window.show();
    }
  });
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });

  if (startAuthentication) {
    startAuthentication();
    return window;
  }

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
