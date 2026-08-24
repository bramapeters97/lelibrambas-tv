import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build, loadEnv, preview } from 'vite';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tvRoot = join(projectRoot, 'apps', 'tv');
const configFile = join(tvRoot, 'vite.config.ts');
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const executablePath = [edge, chrome].find(existsSync);
const publicStream = loadEnv('production', tvRoot, 'VITE_STREAM_PLACEHOLDER_');
const assetId = publicStream.VITE_STREAM_PLACEHOLDER_ASSET_ID?.trim();
const playbackUrl = publicStream.VITE_STREAM_PLACEHOLDER_HLS_URL?.trim();

if (!assetId || !playbackUrl) {
  throw new Error(
    'Stream smoke requires both public VITE_STREAM_PLACEHOLDER_* values in apps/tv/.env.local.',
  );
}

const staticHeaders = readFileSync(join(tvRoot, 'public', '_headers'), 'utf8');
for (const requiredPolicy of [
  "script-src 'self'",
  'https://*.cloudflarestream.com',
  'https://videodelivery.net',
  'https://*.videodelivery.net',
  "frame-src 'none'",
]) {
  if (!staticHeaders.includes(requiredPolicy)) {
    throw new Error(`Static hosting headers are missing the required policy: ${requiredPolicy}`);
  }
}

await build({
  root: tvRoot,
  configFile,
  configLoader: 'runner',
  mode: 'production',
});
if (readFileSync(join(tvRoot, 'dist', '_headers'), 'utf8') !== staticHeaders) {
  throw new Error('The production build did not preserve the reviewed static hosting headers.');
}

const server = await preview({
  root: tvRoot,
  configFile,
  configLoader: 'runner',
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
});
let browser;

try {
  browser = await chromium.launch(executablePath ? { executablePath } : undefined);
  const page = await browser.newPage();
  let manifestLoaded = false;
  page.on('response', (response) => {
    if (response.url() === playbackUrl && response.ok()) manifestLoaded = true;
  });

  await page.goto('http://127.0.0.1:4173/?screen=profiles&capture=1');
  await page.getByRole('button', { name: /Bart & Astrid/i }).click();
  await page.getByRole('button', { name: /^Play/ }).click();
  const video = page.locator('video');
  await video.waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(
    () => {
      const media = document.querySelector('video');
      return media instanceof HTMLVideoElement && media.currentTime > 0.5 && media.error === null;
    },
    undefined,
    { timeout: 20_000 },
  );

  const state = await video.evaluate((media) => ({
    currentTime: media.currentTime,
    duration: media.duration,
    errorCode: media.error?.code ?? null,
  }));
  if (!manifestLoaded || state.errorCode !== null || state.currentTime <= 0.5) {
    throw new Error('The configured Stream asset did not reach advancing, error-free playback.');
  }

  console.log(
    `[stream-smoke] OK: playback advanced to ${state.currentTime.toFixed(1)}s of ${state.duration.toFixed(1)}s.`,
  );
} finally {
  await browser?.close();
  await server.close();
}
