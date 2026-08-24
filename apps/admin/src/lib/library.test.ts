import { describe, expect, it } from 'vitest';
import { createDemoSnapshot } from '../data/demo';
import {
  calculateMetrics,
  formatBytes,
  formatDuration,
  loadStoredSnapshot,
  parseCsv,
  parseSnapshotJson,
  videosFromCsv,
  videosToCsv,
} from './library';

describe('library helpers', () => {
  it('calculates deterministic dashboard metrics', () => {
    const snapshot = createDemoSnapshot();
    const metrics = calculateMetrics(snapshot);

    expect(metrics.totalVideos).toBe(35);
    expect(metrics.dvdSources).toBe(0);
    expect(metrics.processing).toBe(1);
    expect(metrics.failed).toBe(1);
    expect(metrics.missingDates).toBe(35);
    expect(metrics.missingArtwork).toBe(3);
    expect([...new Set(snapshot.devices.map((device) => device.profile))]).toEqual([
      'Bart & Astrid',
      'Bram & Edvin',
      'Eline & Luca',
    ]);
  });

  it('formats archive sizes and durations for the interface', () => {
    expect(formatDuration(4_218)).toBe('1h 10m');
    expect(formatDuration(125)).toBe('2m 05s');
    expect(formatBytes(1_073_741_824)).toBe('1.00 GB');
  });

  it('parses quoted CSV fields including embedded commas and quotes', () => {
    expect(parseCsv('title,description\r\n"A, B","Said ""hello"""')).toEqual([
      ['title', 'description'],
      ['A, B', 'Said "hello"'],
    ]);
  });

  it('round-trips catalogue titles, lists and metadata through CSV', () => {
    const source = createDemoSnapshot().videos.slice(0, 2);
    const imported = videosFromCsv(videosToCsv(source));

    expect(imported).toHaveLength(2);
    expect(imported[0]?.title).toBe('Jeugdfilm 01');
    expect(imported[0]?.people).toEqual(['Synthetic family']);
    expect(imported[1]?.recordingDate).toBeNull();
  });

  it('rejects unrelated JSON and falls back safely for corrupt local state', () => {
    expect(() => parseSnapshotJson('{"hello":"world"}')).toThrow(/not a LeliBramBas\+/);
    const fallback = loadStoredSnapshot({ getItem: () => '{not-json' });
    expect(fallback.videos).toHaveLength(35);
  });
});
