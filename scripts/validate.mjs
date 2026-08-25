import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { platform } from 'node:process';

const corepack = platform === 'win32' ? 'corepack.cmd' : 'corepack';
const yarnCli = process.env.npm_execpath;
const checks = ['typecheck', 'lint', 'format:check', 'test', 'build:web'];
for (const check of checks) {
  console.log(`\n[validate] ${check}`);
  const command = yarnCli && existsSync(yarnCli) ? process.execPath : corepack;
  const args = yarnCli && existsSync(yarnCli) ? [yarnCli, check] : ['yarn', check];
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('\nAll locally available validation checks passed.');
