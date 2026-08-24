import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { platform } from 'node:process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRuntimePaths } from './runtime-paths.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = platform === 'win32';
const corepack = isWindows ? 'corepack.cmd' : 'corepack';
const tar = isWindows ? 'tar.exe' : 'tar';
const yarnCli = process.env.npm_execpath;
const npmCli = resolve(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const runtime = getRuntimePaths();
process.on('exit', () => rmSync(runtime.cache, { recursive: true, force: true }));
const projectNodeModules = join(root, 'node_modules');
const dependencyMarkers = [
  join(runtime.nodeModules, 'typescript', 'bin', 'tsc'),
  join(runtime.nodeModules, 'vite', 'bin', 'vite.js'),
  join(runtime.nodeModules, 'expo', 'package.json'),
  join(runtime.nodeModules, 'tsx', 'dist', 'cli.mjs'),
  join(runtime.nodeModules, 'vitest', 'vitest.mjs'),
  join(runtime.nodeModules, 'eslint', 'bin', 'eslint.js'),
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed.`);
}

function runYarn(args) {
  if (yarnCli && existsSync(yarnCli)) {
    run(process.execPath, [yarnCli, ...args]);
    return;
  }
  run(corepack, ['yarn', ...args]);
}

function samePath(left, right) {
  return isWindows ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function ensureDependencyLink(projectPath, externalPath) {
  mkdirSync(externalPath, { recursive: true });
  if (!existsSync(projectPath)) {
    symlinkSync(externalPath, projectPath, isWindows ? 'junction' : 'dir');
    return;
  }
  if (!lstatSync(projectPath).isSymbolicLink()) {
    throw new Error(`Project-local dependencies must be moved from ${projectPath} to ${externalPath}.`);
  }
  if (!samePath(realpathSync(projectPath), realpathSync(externalPath))) {
    throw new Error(`${projectPath} must point to ${externalPath}.`);
  }
}

function ensureExternalDependencyLinks() {
  ensureDependencyLink(projectNodeModules, runtime.nodeModules);
  for (const group of ['apps', 'packages', 'services', 'tools', 'infra']) {
    const groupPath = join(root, group);
    if (!existsSync(groupPath)) continue;
    for (const entry of readdirSync(groupPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      ensureDependencyLink(
        join(groupPath, entry.name, 'node_modules'),
        join(runtime.workspaceNodeModules, group, entry.name, 'node_modules'),
      );
    }
  }
}

function linkEntryExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function getWorkspacePackages() {
  const workspaces = [];
  for (const group of ['apps', 'packages', 'services', 'tools', 'infra']) {
    const groupPath = join(root, group);
    if (!existsSync(groupPath)) continue;
    for (const entry of readdirSync(groupPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const workspacePath = join(groupPath, entry.name);
      const manifestPath = join(workspacePath, 'package.json');
      if (!existsSync(manifestPath)) continue;
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (typeof manifest.name === 'string' && manifest.name.length > 0) {
        workspaces.push({ name: manifest.name, path: workspacePath });
      }
    }
  }
  return workspaces;
}

function ensureWorkspacePackageLinks() {
  for (const workspace of getWorkspacePackages()) {
    const linkPath = join(runtime.nodeModules, ...workspace.name.split('/'));
    mkdirSync(dirname(linkPath), { recursive: true });
    if (linkEntryExists(linkPath)) {
      if (!lstatSync(linkPath).isSymbolicLink()) {
        throw new Error(`Expected a workspace link at ${linkPath}.`);
      }
      const currentTarget = resolve(readlinkSync(linkPath));
      if (samePath(currentTarget, workspace.path)) continue;
      rmSync(linkPath, { recursive: true, force: true });
    }
    symlinkSync(workspace.path, linkPath, isWindows ? 'junction' : 'dir');
    console.log(`[setup] Linked ${workspace.name} to ${workspace.path}.`);
  }
}
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || major >= 25 || (major === 22 && minor < 13)) {
  throw new Error(
    'LeliBramBas+ requires Node.js 22.13 or newer, up to Node 24. Node 24 LTS is recommended.',
  );
}

ensureExternalDependencyLinks();

if (dependencyMarkers.some((marker) => !existsSync(marker))) {
  runYarn([
    'install',
    '--frozen-lockfile',
    '--modules-folder',
    runtime.nodeModules,
    '--cache-folder',
    runtime.yarnCache,
  ]);
} else {
  console.log(`[setup] Reusing external dependencies from ${runtime.nodeModules}.`);
}

ensureWorkspacePackageLinks();

const electronPathMarker = join(runtime.nodeModules, 'electron', 'path.txt');
if (!existsSync(electronPathMarker)) {
  run(process.execPath, [join(runtime.nodeModules, 'electron', 'install.js')], {
    env: {
      ...process.env,
      electron_config_cache: runtime.electronCache,
    },
  });
}

const demoMediaMarkers = [
  ...['archive-16x9.mp4', 'archive-4x3.mp4', 'short-memory.mp4', 'up-next.mp4'].map((name) =>
    join(root, 'apps', 'tv', 'public', 'media', name),
  ),
  join(root, 'apps', 'tv', 'assets', 'archive-demo.mp4'),
];

if (demoMediaMarkers.some((marker) => !existsSync(marker))) {
  const systemFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
  if (isWindows && !systemFfmpeg) {
    const toolsDir = runtime.ffmpegDir;
    const binary = runtime.ffmpegBinary;
    if (!existsSync(binary)) {
      mkdirSync(toolsDir, { recursive: true });
      run(
        process.execPath,
        [
          npmCli,
          'pack',
          '@ffmpeg-installer/win32-x64@4.1.0',
          '--ignore-scripts',
          '--force',
          '--cache',
          runtime.npmCache,
        ],
        { cwd: toolsDir },
      );
      run(tar, ['-xf', 'ffmpeg-installer-win32-x64-4.1.0.tgz'], { cwd: toolsDir });
      rmSync(join(toolsDir, 'ffmpeg-installer-win32-x64-4.1.0.tgz'), { force: true });
    }
  }

  run(process.execPath, [join(root, 'scripts', 'generate-demo-media.mjs')], {
    env: {
      ...process.env,
      ...(existsSync(runtime.ffmpegBinary)
        ? { LELIBRAMBAS_FFMPEG_PATH: runtime.ffmpegBinary }
        : {}),
    },
  });
} else {
  console.log('[setup] Reusing the existing synthetic demo media.');
}
rmSync(runtime.cache, { recursive: true, force: true });
console.log(`LeliBramBas+ setup is complete. Runtime files: ${runtime.home}`);
