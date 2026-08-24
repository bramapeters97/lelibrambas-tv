import { mkdir, mkdtemp, opendir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanSource } from '../src/index.js';
import { FakeProber, writeBytes } from './helpers.js';

describe('scanSource', () => {
  it('detects normal media, duplicates, Unicode names and VIDEO_TS without treating menu VOBs as films', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lelibrambas-scan-'));
    await writeBytes(path.join(root, 'Trip', '2020-07-12 Stockholm.mp4'), 'same-video-content');
    await writeBytes(path.join(root, 'Trip', 'København copy.MP4'), 'same-video-content');
    const dvd = path.join(root, 'DVD 1999', 'VIDEO_TS');
    await writeBytes(path.join(dvd, 'VIDEO_TS.IFO'), 'ifo');
    await writeBytes(path.join(dvd, 'VTS_01_0.VOB'), 'menu');
    await writeBytes(path.join(dvd, 'VTS_01_1.VOB'), 'feature-one');
    await writeBytes(path.join(dvd, 'VTS_01_2.VOB'), 'feature-two');

    const entries = await scanSource({
      sourceRoot: root,
      prober: new FakeProber(),
      minimumAdditionalDvdTitleBytes: 0,
      hydrationDetector: async () => false,
    });

    expect(entries).toHaveLength(3);
    expect(entries.filter((entry) => entry.sourceType === 'regular-video')).toHaveLength(2);
    expect(entries.find((entry) => entry.duplicateOf !== null)).toBeDefined();
    const dvdEntry = entries.find(
      (entry) => entry.sourceType === 'video-ts' || entry.sourceType === 'dvd-title',
    );
    expect(dvdEntry).toMatchObject({ dvdTitleNumber: 1, legacyFormat: 'VIDEO_TS' });
    expect(dvdEntry?.reviewNotes.join(' ')).not.toContain('menu');
  });

  it('marks an unreadable OneDrive placeholder and keeps scanning', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lelibrambas-placeholder-'));
    const placeholder = path.join(root, 'OneDrive', 'online-only.mov');
    await writeBytes(placeholder, 'placeholder');
    const entries = await scanSource({
      sourceRoot: root,
      prober: new FakeProber(),
      hydrationDetector: async () => true,
    });
    expect(entries[0]).toMatchObject({ requiresHydration: true, conversionStatus: 'skipped' });
  });

  it('accepts a VIDEO_TS directory itself as the scan root', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'lelibrambas-direct-dvd-'));
    const root = path.join(parent, 'VIDEO_TS');
    await writeBytes(path.join(root, 'VIDEO_TS.IFO'), 'ifo');
    await writeBytes(path.join(root, 'VIDEO_TS.BUP'), 'backup');
    await writeBytes(path.join(root, 'VTS_01_1.VOB'), 'feature');

    const entries = await scanSource({
      sourceRoot: root,
      prober: new FakeProber(),
      minimumAdditionalDvdTitleBytes: 0,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      relativeSourcePath: '.',
      sourceType: 'video-ts',
      dvdTitleNumber: 1,
    });
  });

  it('reports an unreadable nested directory and continues scanning its siblings', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lelibrambas-unreadable-directory-'));
    const unreadableDirectory = path.join(root, 'unreadable');
    await mkdir(unreadableDirectory);
    await writeBytes(path.join(root, 'playable.mp4'), 'playable-content');
    const events: Array<{ readonly code: string; readonly path?: string }> = [];

    const entries = await scanSource({
      sourceRoot: root,
      prober: new FakeProber(),
      hydrationDetector: async () => false,
      logger: (event) => events.push(event),
      openDirectory: async (directoryPath) => {
        if (path.resolve(directoryPath) === path.resolve(unreadableDirectory)) {
          throw Object.assign(new Error('simulated access denial'), { code: 'EACCES' });
        }
        return opendir(directoryPath);
      },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.relativeSourcePath).toBe('playable.mp4');
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DIRECTORY_READ_FAILED', path: unreadableDirectory }),
      ]),
    );
  });
});
