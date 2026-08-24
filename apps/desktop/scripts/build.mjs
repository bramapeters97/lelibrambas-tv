import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectDirectory = resolve(desktopDirectory, '../..');
const tvDirectory = resolve(desktopDirectory, '../tv');
const nodeModules = resolve(projectDirectory, 'node_modules');

const tvOnly = process.argv.includes('--tv-only');
const electronOnly = process.argv.includes('--electron-only');

if (tvOnly && electronOnly) {
  throw new Error('Choose either --tv-only or --electron-only, not both.');
}

function run(label, entry, args, cwd) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

if (!electronOnly) {
  run(
    'TV typecheck',
    resolve(nodeModules, 'typescript/bin/tsc'),
    ['-p', resolve(tvDirectory, 'tsconfig.json'), '--noEmit'],
    projectDirectory,
  );
  run(
    'TV production build',
    resolve(nodeModules, 'vite/bin/vite.js'),
    ['build', tvDirectory, '--configLoader', 'runner'],
    projectDirectory,
  );
  run(
    'TV renderer verification',
    resolve(desktopDirectory, 'scripts/verify-tv-dist.mjs'),
    [],
    desktopDirectory,
  );
}

if (!tvOnly) {
  run(
    'Electron main-process build',
    resolve(nodeModules, 'typescript/bin/tsc'),
    ['-p', resolve(desktopDirectory, 'tsconfig.json')],
    desktopDirectory,
  );
}
