import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tvDirectory = resolve(desktopDirectory, '../tv');
const require = createRequire(resolve(desktopDirectory, 'package.json'));
const electronBinary = require('electron');
const vitePackage = require.resolve('vite/package.json', { paths: [tvDirectory] });
const viteCli = resolve(dirname(vitePackage), 'bin/vite.js');
const devServerUrl = 'http://127.0.0.1:5173/';

let viteProcess;
let electronProcess;
let stopping = false;

function stopChildren() {
  if (stopping) return;
  stopping = true;
  if (electronProcess?.exitCode === null) electronProcess.kill();
  if (viteProcess?.exitCode === null) viteProcess.kill();
}

async function waitForVite() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (viteProcess.exitCode !== null) {
      throw new Error(`The TV Vite server exited early with code ${viteProcess.exitCode}.`);
    }

    try {
      const response = await globalThis.fetch(devServerUrl);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  }
  throw new Error(`Timed out waiting for ${devServerUrl}.`);
}

process.once('SIGINT', () => {
  stopChildren();
  process.exitCode = 130;
});
process.once('SIGTERM', () => {
  stopChildren();
  process.exitCode = 143;
});
process.once('exit', stopChildren);

try {
  viteProcess = spawn(
    process.execPath,
    [viteCli, '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    {
      cwd: tvDirectory,
      stdio: 'inherit',
      windowsHide: true,
    },
  );

  await waitForVite();
  electronProcess = spawn(electronBinary, ['.'], {
    cwd: desktopDirectory,
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      LELIBRAMBAS_TV_DEV_URL: devServerUrl,
    },
  });

  const [exitCode] = await once(electronProcess, 'exit');
  stopChildren();
  process.exitCode = typeof exitCode === 'number' ? exitCode : 1;
} catch (error) {
  console.error('[desktop-dev]', error instanceof Error ? error.message : error);
  stopChildren();
  process.exitCode = 1;
}
