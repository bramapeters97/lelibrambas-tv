import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(projectRoot, '..', '..');
const outputRoot = join(repositoryRoot, 'assets', 'lelibrambas-plus', 'screenshots');
const viteCli = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const executablePath = [edge, chrome].find(existsSync);

mkdirSync(outputRoot, { recursive: true });

function startVite(app, port) {
  return spawn(
    process.execPath,
    [
      viteCli,
      'preview',
      app,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
      '--configLoader',
      'runner',
    ],
    {
      cwd: projectRoot,
      // Keep stdin open: Vite exits when its inherited/ignored stdin closes.
      stdio: ['pipe', 'inherit', 'inherit'],
      windowsHide: true,
    },
  );
}

async function waitFor(url, process, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (process.exitCode !== null)
      throw new Error(`Preview server exited with code ${process.exitCode}.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

function stop(process) {
  if (process.exitCode === null) process.kill('SIGTERM');
}

const tv = startVite('apps/tv', 4173);
const admin = startVite('apps/admin', 4174);

try {
  await Promise.all([
    waitFor('http://127.0.0.1:4173', tv),
    waitFor('http://127.0.0.1:4174', admin),
  ]);

  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--disable-features=Translate', '--hide-scrollbars'],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const captures = [
    [
      '01-studio-ident.webp',
      'http://127.0.0.1:4173/?screen=ident&capture=1',
      '.ident-screen',
      'skip-ident',
    ],
    [
      '02-profile-picker.webp',
      'http://127.0.0.1:4173/?screen=profiles&capture=1',
      '.profile-screen',
      'profile-bram',
    ],
    ['03-home.webp', 'http://127.0.0.1:4173/?screen=home&capture=1', '.tv-shell', 'hero-play'],
    ['04-category-hubs.webp', 'http://127.0.0.1:4173/?screen=hubs&capture=1', '.hub-grid', 'hub-0'],
    [
      '05-video-details.webp',
      'http://127.0.0.1:4173/?screen=details&capture=1',
      '.details-screen',
      'detail-play',
    ],
    [
      '06-player.webp',
      'http://127.0.0.1:4173/?screen=player&capture=1',
      '.player-screen',
      'play-pause',
    ],
    [
      '07-timeline.webp',
      'http://127.0.0.1:4173/?screen=timeline&capture=1',
      '.timeline-list',
      'decade-2010',
    ],
    ['08-library-manager.webp', 'http://127.0.0.1:4174/#/dashboard', '.dashboard-view', null],
    [
      '09-video-ts-import.webp',
      'http://127.0.0.1:4174/#/video-ts',
      '[data-testid="video-ts-view"]',
      null,
    ],
  ];

  for (const [filename, url, readySelector, focusId] of captures) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator(readySelector).first().waitFor({ state: 'visible' });
    await page.evaluate(() => document.fonts.ready);
    if (focusId) await page.locator(`[data-focus-id="${focusId}"]`).focus();
    await page.waitForTimeout(250);
    await page.screenshot({
      path: join(outputRoot, filename),
      type: 'webp',
      quality: 88,
      animations: 'disabled',
    });
    console.log(`Captured ${filename}`);
  }

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('http://127.0.0.1:4173/?screen=home&capture=1', { waitUntil: 'networkidle' });
  await page.locator('[data-focus-id="hero-play"]').focus();
  await page.screenshot({
    path: join(outputRoot, '10-home-1280x720.webp'),
    type: 'webp',
    quality: 86,
    animations: 'disabled',
  });

  await browser.close();
} finally {
  stop(tv);
  stop(admin);
}
