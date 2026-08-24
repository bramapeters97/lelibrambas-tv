import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build, preview } from 'vite';

await import('./prepare-content.mjs');

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tvRoot = join(projectRoot, 'apps', 'tv');
const configFile = join(tvRoot, 'vite.config.ts');
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const executablePath = [edge, chrome].find(existsSync);
const catalog = JSON.parse(readFileSync(join(projectRoot, 'data', 'media_catalog.json'), 'utf8'));
const movie = catalog[0];
if (!movie) throw new Error('Stream smoke requires at least one generated catalogue movie.');

const source = new URL(movie.stream_video_id);
const identifier = source.pathname.split('/').filter(Boolean)[0];
if (!identifier || !source.hostname.endsWith('.cloudflarestream.com')) {
  throw new Error(
    `First catalogue movie is not a supported Cloudflare Stream URL: ${movie.stream_video_id}`,
  );
}
const iframeUrl = `https://${source.hostname}/${identifier}/iframe`;

const staticHeaders = readFileSync(join(tvRoot, 'public', '_headers'), 'utf8');
for (const requiredPolicy of [
  "script-src 'self'",
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
  const iframeResponsePromise = page.waitForResponse(
    (response) => response.url().startsWith(iframeUrl),
    { timeout: 20_000 },
  );
  await page.locator('[data-focus-id="detail-play"]').click();
  const iframe = page.locator('iframe.stream-iframe');
  await iframe.waitFor({ state: 'visible' });
  if ((await iframe.getAttribute('data-stream-video-id')) !== movie.stream_video_id) {
    throw new Error('Viewer did not pass the selected catalogue row exact Stream URL to playback.');
  }
  const iframeResponse = await iframeResponsePromise;
  if (!iframeResponse.ok()) {
    throw new Error(
      `Cloudflare Stream iframe returned HTTP ${iframeResponse.status()}: ${iframeUrl}`,
    );
  }

  console.log(`[stream-smoke] OK: catalogue ${movie.id} loaded its secure Stream iframe.`);
} finally {
  await browser?.close();
  await server.close();
}
