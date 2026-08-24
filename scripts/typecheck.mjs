import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const tsc = resolve(root, 'node_modules', 'typescript', 'bin', 'tsc');
const projects = [
  'packages/types',
  'packages/catalog',
  'packages/design-system',
  'packages/media',
  'packages/navigation',
  'packages/shared',
  'apps/tv',
  'apps/admin',
  'apps/desktop',
  'tools/video-importer',
  'services/api',
  'infra/d1',
];

for (const project of projects) {
  process.stdout.write(`\n[typecheck] ${project}\n`);
  const result = spawnSync(
    process.execPath,
    [tsc, '-p', resolve(root, project, 'tsconfig.json'), '--noEmit', '--pretty', 'false'],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

process.stdout.write('\nAll workspace TypeScript checks passed.\n');
