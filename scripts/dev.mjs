import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vite = resolve(root, 'node_modules', 'vite', 'bin', 'vite.js');
const spawnVite = (args) =>
  spawn(process.execPath, [vite, ...args], { cwd: root, stdio: 'inherit' });

const children = [
  spawnVite(['apps/tv', '--configLoader', 'runner', '--host', '127.0.0.1', '--port', '5173']),
  spawnVite(['apps/admin', '--configLoader', 'runner', '--host', '127.0.0.1', '--port', '4174']),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 200);
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(error);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 0);
  });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
