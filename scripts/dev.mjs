import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { platform } from 'node:process';

const yarnCli = process.env.npm_execpath;

function spawnYarn(args) {
  if (yarnCli && existsSync(yarnCli)) {
    return spawn(process.execPath, [yarnCli, ...args], { stdio: 'inherit' });
  }
  return spawn('corepack', ['yarn', ...args], {
    stdio: 'inherit',
    shell: platform === 'win32',
  });
}

const children = [
  spawnYarn(['workspace', '@lelibrambas/tv', 'dev']),
  spawnYarn(['workspace', '@lelibrambas/admin', 'dev']),
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
    if (!stopping && code) stop(code);
  });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
