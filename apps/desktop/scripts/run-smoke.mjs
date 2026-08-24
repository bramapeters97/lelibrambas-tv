import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(desktopDirectory, 'package.json'));
const electronBinary = require('electron');
const streamSmoke = process.argv.includes('--stream');
const smokeArgument = streamSmoke ? '--stream-smoke-test' : '--smoke-test';
const smokeDataRoot = mkdtempSync(join(tmpdir(), 'lelibrambas-electron-smoke-'));

let electronProcess;
let cleanupFailed = false;
const terminationHandlers = new Map();

function removeSmokeData() {
  try {
    rmSync(smokeDataRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch (error) {
    cleanupFailed = true;
    console.error(
      '[desktop-smoke] Could not remove the isolated smoke profile.',
      error instanceof Error ? error.message : error,
    );
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  const handler = () => electronProcess?.kill(signal);
  terminationHandlers.set(signal, handler);
  process.once(signal, handler);
}

let exitCode = 1;
try {
  electronProcess = spawn(electronBinary, [desktopDirectory, smokeArgument], {
    cwd: desktopDirectory,
    env: {
      ...process.env,
      LELIBRAMBAS_ELECTRON_SMOKE_DATA_ROOT: smokeDataRoot,
    },
    stdio: 'inherit',
    windowsHide: true,
  });

  exitCode = await new Promise((resolveExit, reject) => {
    electronProcess.once('error', reject);
    electronProcess.once('close', (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
  });
} catch (error) {
  console.error('[desktop-smoke] Electron could not be started.', error);
} finally {
  for (const [signal, handler] of terminationHandlers) {
    process.removeListener(signal, handler);
  }
  removeSmokeData();
}

if (exitCode !== 0 && process.platform === 'win32' && process.env.CODEX_SESSION_ID) {
  console.error(
    "[desktop-smoke] A nested managed Windows sandbox can prevent Electron from starting its own sandboxed child processes. Re-run this GUI smoke with permission to leave the outer sandbox; do not disable Electron's sandbox.",
  );
}

process.exitCode = exitCode === 0 && !cleanupFailed ? 0 : 1;
