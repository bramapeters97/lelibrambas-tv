import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readManifest, writeManifest } from '../src/index.js';
import { makeEntry, makeManifest } from './helpers.js';

describe('manifest serialization', () => {
  it.each(['json', 'csv'])('round-trips %s manifests with validation', async (extension) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lelibrambas-manifest-'));
    const manifestPath = path.join(root, `manifest.${extension}`);
    const manifest = makeManifest(
      path.join(root, 'source'),
      path.join(root, 'output'),
      makeEntry(path.join(root, 'source', 'source.mp4'), path.join(root, 'output', 'copy.mp4')),
    );
    await writeManifest(manifestPath, manifest);
    await expect(readManifest(manifestPath)).resolves.toEqual(manifest);
  });

  it('rejects an invalid manifest row instead of silently discarding it', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lelibrambas-invalid-'));
    const manifestPath = path.join(root, 'invalid.json');
    await writeFile(
      manifestPath,
      JSON.stringify({ schemaVersion: 1, entries: [{ title: 'missing fields' }] }),
      'utf8',
    );
    await expect(readManifest(manifestPath)).rejects.toThrow();
  });
});
