import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { build, preview } from 'vite';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tvRoot = resolve(projectRoot, 'apps/tv');
const configFile = resolve(tvRoot, 'vite.config.ts');

await build({
  root: tvRoot,
  configFile,
  configLoader: 'runner',
});

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

const playwright = spawn(
  process.execPath,
  [resolve(projectRoot, 'node_modules/@playwright/test/cli.js'), 'test'],
  {
    cwd: projectRoot,
    env: { ...process.env, LELIBRAMBAS_E2E_MANAGED_SERVER: '1' },
    stdio: 'inherit',
  },
);

const exitCode = await new Promise((resolveExit, reject) => {
  playwright.once('error', reject);
  playwright.once('exit', (code, signal) => {
    resolveExit(code ?? (signal ? 1 : 0));
  });
});

await server.close();
process.exitCode = exitCode;
