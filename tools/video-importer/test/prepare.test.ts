import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { prepareImport, type ProcessRunner } from '../src/index.js';
import { FakeProber, writeBytes } from './helpers.js';

const importerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const monorepoRoot = path.resolve(importerRoot, '../..');
const tsxCliPath = path.join(monorepoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const importerCliPath = path.join(importerRoot, 'src', 'cli.ts');

const fakeRunner: ProcessRunner = {
  async run(executable) {
    return Promise.resolve({ exitCode: 0, stdout: `${executable} fake`, stderr: '' });
  },
};

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runCli(
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
): Promise<{
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCliPath, importerCliPath, ...args], {
      cwd: importerRoot,
      env: { ...process.env, ...environment },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

describe('prepare dry run', () => {
  it('builds an in-memory manifest and state without creating importer output', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lelibrambas-prepare-dry-run-'));
    const sourceRoot = path.join(root, 'source');
    const sourcePath = path.join(sourceRoot, 'Family film.mp4');
    const manifestPath = path.join(root, 'imports', 'catalog.json');
    const statePath = path.join(root, 'imports', 'catalog.state.json');
    const outputRoot = path.join(root, 'viewing-copies');
    await writeBytes(sourcePath, 'source-remains-unchanged');

    const prepared = await prepareImport({
      sourceRoot,
      manifestPath,
      statePath,
      outputRoot,
      dryRun: true,
      prober: new FakeProber(),
      runner: fakeRunner,
      now: () => new Date('2026-08-17T00:00:00.000Z'),
    });

    expect(prepared.manifest.entries).toHaveLength(1);
    expect(prepared.state.entries).toHaveLength(1);
    expect(await exists(manifestPath)).toBe(false);
    expect(await exists(statePath)).toBe(false);
    expect(await exists(outputRoot)).toBe(false);
    await expect(readFile(sourcePath, 'utf8')).resolves.toBe('source-remains-unchanged');
  });

  it('accepts the UI command without --manifest and keeps the dry-run data root absent', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lelibrambas-prepare-cli-'));
    const sourceRoot = path.join(root, 'demo-source', 'Stockholm 2004');
    const sourcePath = path.join(sourceRoot, 'Midsummer.mp4');
    const appDataRoot = path.join(root, 'app-data');
    await writeBytes(sourcePath, 'source-remains-unchanged');

    const result = await runCli(['prepare', '--folder', sourceRoot, '--dry-run'], {
      LOCALAPPDATA: appDataRoot,
      APPDATA: appDataRoot,
    });

    expect(result.exitCode, result.stderr).toBe(0);
    const summary = JSON.parse(result.stdout) as {
      readonly dryRun: boolean;
      readonly manifestPath: string;
      readonly statePath: string;
      readonly outputRoot: string;
      readonly entries: number;
    };
    expect(summary).toMatchObject({ dryRun: true, entries: 1 });
    expect(path.resolve(summary.manifestPath).startsWith(path.resolve(appDataRoot))).toBe(true);
    expect(await exists(summary.manifestPath)).toBe(false);
    expect(await exists(summary.statePath)).toBe(false);
    expect(await exists(summary.outputRoot)).toBe(false);
    expect(await exists(appDataRoot)).toBe(false);
    await expect(readFile(sourcePath, 'utf8')).resolves.toBe('source-remains-unchanged');
  });
});
