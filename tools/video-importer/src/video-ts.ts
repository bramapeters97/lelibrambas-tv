import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ProcessRunner } from './process.js';
import { SpawnProcessRunner } from './process.js';

export interface DvdTitleCandidate {
  readonly titleNumber: number;
  readonly sourceFiles: readonly string[];
  readonly totalBytes: number;
  readonly durationSeconds: number | null;
  readonly chapterCount: number | null;
  readonly fingerprint: string;
  readonly discovery: 'handbrake' | 'fallback';
  readonly isLikelyMainTitle: boolean;
}

export interface VideoTsInspection {
  readonly videoTsPath: string;
  readonly titles: readonly DvdTitleCandidate[];
  readonly handBrakeVersion: string | null;
}

interface FallbackTitleSet {
  readonly number: number;
  readonly files: readonly string[];
  readonly totalBytes: number;
}

async function fallbackTitleSets(videoTsPath: string): Promise<readonly FallbackTitleSet[]> {
  const names = await readdir(videoTsPath);
  const groups = new Map<number, string[]>();
  for (const name of names) {
    const match = /^VTS_(\d{2})_([1-9]\d*)\.VOB$/iu.exec(name);
    if (match === null) continue;
    const titleNumber = Number(match[1]);
    const existing = groups.get(titleNumber) ?? [];
    existing.push(path.join(videoTsPath, name));
    groups.set(titleNumber, existing);
  }
  const sets: FallbackTitleSet[] = [];
  for (const [number, files] of groups) {
    files.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    const sizes = await Promise.all(files.map(async (file) => (await stat(file)).size));
    sets.push({ number, files, totalBytes: sizes.reduce((sum, size) => sum + size, 0) });
  }
  return sets.sort((left, right) => left.number - right.number);
}

function parseDuration(value: string): number {
  const [hours, minutes, seconds] = value.split(':').map(Number);
  return (hours ?? 0) * 3_600 + (minutes ?? 0) * 60 + (seconds ?? 0);
}

function parseHandBrakeTitles(
  output: string,
): Map<number, { duration: number | null; chapters: number | null }> {
  const results = new Map<number, { duration: number | null; chapters: number | null }>();
  const titlePattern = /^\s*\+ title (\d+):/gmu;
  const matches = [...output.matchAll(titlePattern)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    if (match === undefined) continue;
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? output.length;
    const section = output.slice(start, end);
    const durationMatch = /\+ duration:\s*(\d{2}:\d{2}:\d{2})/u.exec(section);
    const chapterMatch = /\+ chapters:\s*(\d+)/u.exec(section);
    results.set(Number(match[1]), {
      duration: durationMatch === null ? null : parseDuration(durationMatch[1] ?? '00:00:00'),
      chapters: chapterMatch === null ? null : Number(chapterMatch[1]),
    });
  }
  return results;
}

function fingerprintTitle(files: readonly string[], sizes: readonly number[]): string {
  const hash = createHash('sha256');
  files.forEach((file, index) =>
    hash.update(`${path.basename(file).toLocaleUpperCase()}:${sizes[index] ?? 0}\n`),
  );
  return hash.digest('hex');
}

export async function inspectVideoTs(
  videoTsPath: string,
  options: {
    readonly runner?: ProcessRunner;
    readonly minimumAdditionalTitleBytes?: number;
    readonly signal?: AbortSignal;
  } = {},
): Promise<VideoTsInspection> {
  const runner = options.runner ?? new SpawnProcessRunner();
  const fallback = await fallbackTitleSets(videoTsPath);
  if (fallback.length === 0) {
    return { videoTsPath, titles: [], handBrakeVersion: null };
  }

  let handBrakeVersion: string | null = null;
  let handBrakeTitles = new Map<number, { duration: number | null; chapters: number | null }>();
  try {
    const version = await runner.run('HandBrakeCLI', ['--version'], options.signal);
    if (version.exitCode === 0) {
      handBrakeVersion = `${version.stdout}\n${version.stderr}`.trim().split(/\r?\n/u)[0] ?? null;
      const scan = await runner.run(
        'HandBrakeCLI',
        ['--scan', '--title', '0', '--input', path.dirname(videoTsPath)],
        options.signal,
      );
      handBrakeTitles = parseHandBrakeTitles(`${scan.stdout}\n${scan.stderr}`);
    }
  } catch {
    handBrakeVersion = null;
  }

  const largestBytes = Math.max(...fallback.map((set) => set.totalBytes));
  const minimumAdditional = options.minimumAdditionalTitleBytes ?? 20 * 1024 * 1024;
  const selected = fallback.filter(
    (set) => set.totalBytes === largestBytes || set.totalBytes >= minimumAdditional,
  );
  const titles = await Promise.all(
    selected.map(async (set): Promise<DvdTitleCandidate> => {
      const sizes = await Promise.all(set.files.map(async (file) => (await stat(file)).size));
      const handBrake = handBrakeTitles.get(set.number);
      return {
        titleNumber: set.number,
        sourceFiles: set.files,
        totalBytes: set.totalBytes,
        durationSeconds: handBrake?.duration ?? null,
        chapterCount: handBrake?.chapters ?? null,
        fingerprint: fingerprintTitle(set.files, sizes),
        discovery: handBrake === undefined ? 'fallback' : 'handbrake',
        isLikelyMainTitle: set.totalBytes === largestBytes,
      };
    }),
  );
  return { videoTsPath, titles, handBrakeVersion };
}

export async function isVideoTsDirectory(directoryPath: string): Promise<boolean> {
  const names = await readdir(directoryPath);
  const upper = new Set(names.map((name) => name.toLocaleUpperCase()));
  return upper.has('VIDEO_TS.IFO') && [...upper].some((name) => /^VTS_\d{2}_\d+\.VOB$/u.test(name));
}
