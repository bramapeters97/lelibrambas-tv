import { homedir } from 'node:os';
import { env, platform } from 'node:process';
import { join, resolve } from 'node:path';

function defaultRuntimeHome() {
  if (platform === 'win32') {
    return join(env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'LeliBramBasPlus', 'runtime');
  }
  if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Caches', 'LeliBramBasPlus', 'runtime');
  }
  return join(env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'lelibrambas-plus', 'runtime');
}

export function getRuntimePaths() {
  const home = resolve(env.LELIBRAMBAS_RUNTIME_HOME || defaultRuntimeHome());
  const cache = join(home, 'cache');
  const ffmpegDir = join(home, 'tools', 'ffmpeg');
  return {
    home,
    cache,
    nodeModules: join(home, 'node_modules'),
    workspaceNodeModules: join(home, 'workspaces'),
    yarnCache: join(cache, 'yarn'),
    npmCache: join(cache, 'npm'),
    electronCache: join(cache, 'electron'),
    ffmpegDir,
    ffmpegBinary: join(ffmpegDir, 'package', 'ffmpeg.exe'),
  };
}
