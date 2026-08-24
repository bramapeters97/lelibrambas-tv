import { spawn, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const setup = spawnSync(process.execPath, [join(root, 'scripts', 'setup.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
if (setup.error) throw setup.error;
if (setup.status !== 0) process.exit(setup.status ?? 1);

const dev = spawn(process.execPath, [join(root, 'scripts', 'dev.mjs')], {
  cwd: root,
  stdio: 'inherit',
});

dev.on('error', (error) => {
  throw error;
});
dev.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => dev.kill('SIGINT'));
process.on('SIGTERM', () => dev.kill('SIGTERM'));
