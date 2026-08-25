import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const vitest = resolve(root, 'node_modules', 'vitest', 'vitest.mjs');
const tsc = resolve(root, 'node_modules', 'typescript', 'bin', 'tsc');
const suites = [
  { path: 'packages/types' },
  { path: 'packages/catalog' },
  { path: 'packages/media' },
  { path: 'packages/navigation' },
  { path: 'packages/shared' },
  { path: 'apps/tv' },
  { path: 'tools/video-importer' },
  { path: 'services/api' },
  { path: 'infra/d1' },
];

function run(label, command, args, cwd = root) {
  process.stdout.write(`\n[test] ${label}\n`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('generated media catalogue', process.execPath, [
  resolve(root, 'scripts/validate-media-catalog.mjs'),
]);

for (const suite of suites) {
  const suiteRoot = resolve(root, suite.path);
  const localVitest = resolve(suiteRoot, 'node_modules', 'vitest', 'vitest.mjs');
  const suiteVitest = existsSync(localVitest) ? localVitest : vitest;
  const configArgs = suite.config ? ['--config', resolve(suiteRoot, suite.config)] : [];
  run(
    suite.path,
    process.execPath,
    [suiteVitest, 'run', '--configLoader', 'runner', ...configArgs],
    suiteRoot,
  );
}

run('apps/desktop build', process.execPath, [
  tsc,
  '-p',
  resolve(root, 'apps/desktop/tsconfig.json'),
]);
run('apps/desktop smoke', process.execPath, [
  '--test',
  resolve(root, 'apps/desktop/test/smoke.test.mjs'),
]);

process.stdout.write('\nAll workspace test suites passed.\n');
