import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createJobState,
  defaultStatePath,
  readJobState,
  runConversionJob,
  verifyJob,
  writeJobState,
  writeManifest,
  type ProcessResult,
  type ProcessRunner,
} from '../src/index.js';
import { makeEntry, makeManifest, writeBytes } from './helpers.js';

describe('runConversionJob', () => {
  it('keeps dry runs side-effect free and never invokes FFmpeg', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lelibrambas-dry-run-'));
    const sourceRoot = path.join(root, 'source');
    const outputRoot = path.join(root, 'output');
    const sourcePath = path.join(sourceRoot, 'source.mp4');
    await writeBytes(sourcePath, 'source remains intact');
    const manifest = makeManifest(
      sourceRoot,
      outputRoot,
      makeEntry(sourcePath, path.join(outputRoot, 'copy.mp4')),
    );
    const manifestPath = path.join(root, 'manifest.json');
    const statePath = defaultStatePath(manifestPath);
    const state = createJobState(manifestPath, manifest, new Date('2026-08-17T00:00:00.000Z'));
    const runner: ProcessRunner = {
      async run(): Promise<ProcessResult> {
        throw new Error('must not run');
      },
    };

    const result = await runConversionJob(manifest, state, {
      manifestPath,
      statePath,
      dryRun: true,
      runner,
    });
    expect(result.plans).toHaveLength(1);
    await expect(
      import('node:fs/promises').then(({ access }) => access(outputRoot)),
    ).rejects.toThrow();
  });

  it('retries, persists state, promotes a partial file, and verifies the checksum', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lelibrambas-convert-'));
    const sourceRoot = path.join(root, 'source');
    const outputRoot = path.join(root, 'output');
    const sourcePath = path.join(sourceRoot, 'source.mp4');
    const outputPath = path.join(outputRoot, 'copy.mp4');
    await writeBytes(sourcePath, 'source remains intact');
    const manifest = makeManifest(sourceRoot, outputRoot, makeEntry(sourcePath, outputPath));
    const manifestPath = path.join(root, 'manifest.json');
    const statePath = defaultStatePath(manifestPath);
    const state = createJobState(manifestPath, manifest, new Date('2026-08-17T00:00:00.000Z'));
    await writeManifest(manifestPath, manifest);
    await writeJobState(statePath, state);
    let calls = 0;
    const runner: ProcessRunner = {
      async run(_executable, args): Promise<ProcessResult> {
        calls += 1;
        if (calls === 1) return { exitCode: 1, stdout: '', stderr: 'temporary encoder failure' };
        const partialPath = args.at(-1);
        if (partialPath === undefined) throw new Error('missing output');
        await mkdir(path.dirname(partialPath), { recursive: true });
        await writeFile(partialPath, 'converted viewing copy', 'utf8');
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };

    const result = await runConversionJob(manifest, state, {
      manifestPath,
      statePath,
      retries: 1,
      runner,
      sleep: async () => {},
      now: () => new Date('2026-08-17T00:00:10.000Z'),
    });
    expect(calls).toBe(2);
    expect(result.state.entries[0]).toMatchObject({ status: 'completed', attempts: 2 });
    expect((await readJobState(statePath)).entries[0]?.status).toBe('completed');
    await expect(verifyJob(result.manifest, result.state)).resolves.toEqual([
      expect.objectContaining({ entryId: manifest.entries[0]?.id, valid: true }),
    ]);
  });
});
