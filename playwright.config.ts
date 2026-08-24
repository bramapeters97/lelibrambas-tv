import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const executablePath = [edge, chrome].find(existsSync);
const managedServer = process.env.LELIBRAMBAS_E2E_MANAGED_SERVER === '1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: managedServer
    ? undefined
    : {
        command:
          'node ./node_modules/vite/bin/vite.js preview apps/tv --host 127.0.0.1 --port 4173 --strictPort --configLoader runner',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
