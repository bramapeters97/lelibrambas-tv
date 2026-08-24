import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const setup = spawnSync(process.execPath, [join(root, 'scripts', 'setup.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
if (setup.error) throw setup.error;
if (setup.status !== 0) process.exit(setup.status ?? 1);

const content = spawnSync(process.execPath, [join(root, 'scripts', 'prepare-content.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
if (content.error) throw content.error;
if (content.status !== 0) process.exit(content.status ?? 1);

await import('./dev.mjs');
