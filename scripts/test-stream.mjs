import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { chromium } from '@playwright/test';
import { build, preview } from 'vite';

await import('./prepare-content.mjs');

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tvRoot = join(projectRoot, 'apps', 'tv');
const configFile = join(tvRoot, 'vite.config.ts');
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const executablePath = [edge, chrome].find(existsSync);
const moviesApiUrl =
  process.env.VITE_MOVIES_API_URL?.trim() ||
  'https://lelibrambas-api.bramapeters.workers.dev/api/movies';
const localCatalog = JSON.parse(
  readFileSync(join(projectRoot, 'data', 'media_catalog.json'), 'utf8'),
);
let catalog = localCatalog;
try {
  const response = await fetch(moviesApiUrl, { cache: 'no-store' });
  const payload = response.ok ? await response.json() : null;
  if (Array.isArray(payload) && payload.length) catalog = payload;
} catch {
  // The browser smoke remains runnable offline through the production fallback catalogue.
}
const movie = catalog[0];
if (!movie) throw new Error('Stream smoke requires at least one generated catalogue movie.');

const source = new URL(movie.stream_video_id);
const identifier = source.pathname.split('/').filter(Boolean)[0];
if (!identifier || !source.hostname.endsWith('.cloudflarestream.com')) {
  throw new Error(
    `First catalogue movie is not a supported Cloudflare Stream URL: ${movie.stream_video_id}`,
  );
}
const manifestUrl = `https://${source.hostname}/${identifier}/manifest/video.m3u8`;

const staticHeaders = readFileSync(join(tvRoot, 'public', '_headers'), 'utf8');
for (const requiredPolicy of [
  "script-src 'self'",
  "img-src 'self' data: blob: https://assets.lelibrambas.com",
  `connect-src 'self' ${new URL(moviesApiUrl).origin}`,
  'https://*.cloudflarestream.com',
  'https://videodelivery.net',
  'https://*.videodelivery.net',
  'frame-src https://*.cloudflarestream.com',
]) {
  if (!staticHeaders.includes(requiredPolicy)) {
    throw new Error(`Static hosting headers are missing the required policy: ${requiredPolicy}`);
  }
}

await build({ root: tvRoot, configFile, configLoader: 'runner', mode: 'production' });
if (readFileSync(join(tvRoot, 'dist', '_headers'), 'utf8') !== staticHeaders) {
  throw new Error('The production build did not preserve the reviewed static hosting headers.');
}

const server = await preview({
  root: tvRoot,
  configFile,
  configLoader: 'runner',
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
let browser;

try {
  browser = await chromium.launch(executablePath ? { executablePath } : undefined);
  const page = await browser.newPage();

  await page.goto(`http://127.0.0.1:4173/?screen=details&capture=1&video=${movie.id}`);
  const playbackResponsePromise = page.waitForResponse(
    (response) => response.url().startsWith(manifestUrl),
    { timeout: 20_000 },
  );
  await page.locator('[data-focus-id="detail-play"]').click();
  const player = page.locator('video[data-stream-video-id], iframe.stream-iframe');
  await player.waitFor({ state: 'visible' });
  if ((await player.getAttribute('data-stream-video-id')) !== movie.stream_video_id) {
    throw new Error('Viewer did not pass the selected catalogue row exact Stream URL to playback.');
  }
  const playbackResponse = await playbackResponsePromise;
  if (!playbackResponse.ok()) {
    throw new Error(
      `Cloudflare Stream manifest returned HTTP ${playbackResponse.status()}: ${manifestUrl}`,
    );
  }

  console.log(`[stream-smoke] OK: catalogue ${movie.id} loaded its secure Stream manifest.`);
} finally {
  await browser?.close();
  await server.close();
}
