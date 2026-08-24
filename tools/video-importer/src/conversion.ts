import { mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { checksumFile } from './fingerprint.js';
import { writeManifest } from './manifest.js';
import { assertDistinctFile, assertOutputOutsideSource, isPathInside } from './path-safety.js';
import { SpawnProcessRunner, type ProcessRunner } from './process.js';
import { writeJobState } from './state.js';
import type {
  ImportJobState,
  ImportManifest,
  ImportManifestEntry,
  JobEntryState,
} from './types.js';

export type ConversionProfile = 'dvd-pal' | 'dvd-ntsc' | 'sd-progressive' | 'hd' | 'full-hd' | '4k';

export interface ConversionPlan {
  readonly entryId: string;
  readonly profile: ConversionProfile;
  readonly executable: 'ffmpeg';
  readonly args: readonly string[];
  readonly outputPath: string;
  readonly workingOutputPath: string;
  readonly concatFilePath: string | null;
}

export interface ConversionRunOptions {
  readonly statePath: string;
  readonly manifestPath: string;
  readonly dryRun?: boolean;
  readonly concurrency?: number;
  readonly retries?: number;
  readonly runner?: ProcessRunner;
  readonly signal?: AbortSignal;
  readonly now?: () => Date;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly onProgress?: (message: Readonly<Record<string, unknown>>) => void;
}

function chooseProfile(entry: ImportManifestEntry): ConversionProfile {
  if (entry.sourceType !== 'regular-video') {
    return entry.frameRate !== null && entry.frameRate < 27 ? 'dvd-pal' : 'dvd-ntsc';
  }
  const height = entry.height ?? 0;
  if (height >= 2160) return '4k';
  if (height >= 1080) return 'full-hd';
  if (height >= 720) return 'hd';
  return 'sd-progressive';
}

function profileCrf(profile: ConversionProfile): string {
  return profile === 'dvd-pal' || profile === 'dvd-ntsc' || profile === 'sd-progressive'
    ? '19'
    : '18';
}

export function buildConversionPlan(
  entry: ImportManifestEntry,
  outputRoot: string,
): ConversionPlan {
  if (entry.outputPath === null) throw new Error(`Manifest entry ${entry.id} has no output path.`);
  assertOutputOutsideSource(entry.sourcePath, outputRoot);
  assertDistinctFile(entry.sourcePath, entry.outputPath);
  if (!isPathInside(outputRoot, entry.outputPath)) {
    throw new Error(`Output path escapes the configured output root: ${entry.outputPath}`);
  }
  const profile = chooseProfile(entry);
  const workingOutputPath = `${entry.outputPath}.partial`;
  const concatFilePath =
    entry.sourceType === 'regular-video'
      ? null
      : path.join(outputRoot, '.work', `${entry.id}.concat.txt`);
  const inputArgs =
    concatFilePath === null
      ? ['-i', entry.sourcePath]
      : ['-f', 'concat', '-safe', '0', '-i', concatFilePath];
  const videoFilter =
    entry.interlaced === true ? ['-vf', 'bwdif=mode=send_field:parity=auto:deint=interlaced'] : [];
  return {
    entryId: entry.id,
    profile,
    executable: 'ffmpeg',
    args: [
      '-hide_banner',
      '-nostdin',
      '-y',
      ...inputArgs,
      '-map',
      '0:v:0',
      '-map',
      '0:a?',
      '-map_metadata',
      '0',
      ...videoFilter,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      profileCrf(profile),
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      workingOutputPath,
    ],
    outputPath: entry.outputPath,
    workingOutputPath,
    concatFilePath,
  };
}

function concatEscape(filePath: string): string {
  return filePath.replaceAll('\\', '/').replaceAll("'", "'\\''");
}

async function writeDvdConcat(entry: ImportManifestEntry, concatFilePath: string): Promise<void> {
  const title = entry.dvdTitleNumber;
  if (title === null) throw new Error(`DVD entry ${entry.id} has no title number.`);
  const titlePrefix = String(title).padStart(2, '0');
  const files = (await readdir(entry.sourcePath))
    .filter((name) => new RegExp(`^VTS_${titlePrefix}_[1-9]\\d*\\.VOB$`, 'iu').test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  if (files.length === 0) throw new Error(`No playable VOB files found for DVD title ${title}.`);
  await mkdir(path.dirname(concatFilePath), { recursive: true });
  await writeFile(
    concatFilePath,
    `${files.map((name) => `file '${concatEscape(path.join(entry.sourcePath, name))}'`).join('\n')}\n`,
    'utf8',
  );
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function cloneState(state: ImportJobState): ImportJobState {
  return structuredClone(state);
}

export async function runConversionJob(
  manifestInput: ImportManifest,
  stateInput: ImportJobState,
  options: ConversionRunOptions,
): Promise<{
  readonly manifest: ImportManifest;
  readonly state: ImportJobState;
  readonly plans: readonly ConversionPlan[];
}> {
  assertOutputOutsideSource(manifestInput.sourceRoot, manifestInput.outputRoot);
  const plans = manifestInput.entries
    .filter(
      (entry) =>
        entry.conversionStatus !== 'skipped' &&
        entry.duplicateOf === null &&
        !entry.requiresHydration,
    )
    .map((entry) => buildConversionPlan(entry, manifestInput.outputRoot));
  if (options.dryRun === true) return { manifest: manifestInput, state: stateInput, plans };

  const runner = options.runner ?? new SpawnProcessRunner();
  const now = options.now ?? (() => new Date());
  const sleep =
    options.sleep ??
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const concurrency = Math.max(1, Math.min(8, options.concurrency ?? 1));
  const retries = Math.max(0, Math.min(5, options.retries ?? 2));
  let state = cloneState(stateInput);
  let manifest = structuredClone(manifestInput);
  let writeQueue = Promise.resolve();

  const persist = async (): Promise<void> => {
    const snapshot = cloneState({ ...state, updatedAt: now().toISOString() });
    writeQueue = writeQueue.then(async () => writeJobState(options.statePath, snapshot));
    await writeQueue;
  };

  const updateStateEntry = (id: string, update: (entry: JobEntryState) => JobEntryState): void => {
    state = {
      ...state,
      entries: state.entries.map((entry) => (entry.id === id ? update(entry) : entry)),
    };
  };
  const updateManifestEntry = (
    id: string,
    update: (entry: ImportManifestEntry) => ImportManifestEntry,
  ): void => {
    manifest = {
      ...manifest,
      entries: manifest.entries.map((entry) => (entry.id === id ? update(entry) : entry)),
    };
  };

  const queue = plans.filter((plan) => {
    const current = state.entries.find((entry) => entry.id === plan.entryId);
    return current !== undefined && current.status !== 'completed' && current.status !== 'skipped';
  });
  let nextIndex = 0;

  const processPlan = async (plan: ConversionPlan): Promise<void> => {
    const manifestEntry = manifest.entries.find((entry) => entry.id === plan.entryId);
    if (manifestEntry === undefined)
      throw new Error(`State references unknown entry ${plan.entryId}.`);
    if (await pathExists(plan.outputPath)) {
      const checksum = await checksumFile(plan.outputPath);
      updateStateEntry(plan.entryId, (entry) => ({
        ...entry,
        status: 'completed',
        completedAt: now().toISOString(),
        error: null,
        outputChecksum: checksum,
      }));
      updateManifestEntry(plan.entryId, (entry) => ({
        ...entry,
        conversionStatus: 'completed',
        outputChecksum: checksum,
        error: null,
      }));
      await persist();
      return;
    }

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      options.signal?.throwIfAborted();
      updateStateEntry(plan.entryId, (entry) => ({
        ...entry,
        status: 'running',
        attempts: entry.attempts + 1,
        startedAt: now().toISOString(),
        error: null,
      }));
      updateManifestEntry(plan.entryId, (entry) => ({
        ...entry,
        conversionStatus: 'running',
        error: null,
      }));
      await persist();
      options.onProgress?.({
        event: 'conversion-started',
        entryId: plan.entryId,
        attempt: attempt + 1,
        profile: plan.profile,
      });
      try {
        await mkdir(path.dirname(plan.outputPath), { recursive: true });
        if (await pathExists(plan.workingOutputPath)) await unlink(plan.workingOutputPath);
        if (plan.concatFilePath !== null) await writeDvdConcat(manifestEntry, plan.concatFilePath);
        const result = await runner.run(plan.executable, plan.args, options.signal);
        if (result.exitCode !== 0)
          throw new Error(result.stderr.trim() || `ffmpeg exited with ${result.exitCode}`);
        const outputStat = await stat(plan.workingOutputPath);
        if (outputStat.size === 0) throw new Error('ffmpeg produced an empty viewing copy.');
        await rename(plan.workingOutputPath, plan.outputPath);
        const checksum = await checksumFile(plan.outputPath);
        const completedAt = now().toISOString();
        updateStateEntry(plan.entryId, (entry) => ({
          ...entry,
          status: 'completed',
          completedAt,
          error: null,
          outputChecksum: checksum,
        }));
        updateManifestEntry(plan.entryId, (entry) => ({
          ...entry,
          conversionStatus: 'completed',
          outputChecksum: checksum,
          error: null,
        }));
        await persist();
        options.onProgress?.({
          event: 'conversion-completed',
          entryId: plan.entryId,
          outputPath: plan.outputPath,
        });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (options.signal?.aborted === true) {
          updateStateEntry(plan.entryId, (entry) => ({
            ...entry,
            status: 'interrupted',
            error: 'Interrupted by user.',
          }));
          updateManifestEntry(plan.entryId, (entry) => ({
            ...entry,
            conversionStatus: 'interrupted',
            error: 'Interrupted by user.',
          }));
          state = { ...state, interrupted: true };
          await persist();
          return;
        }
        if (attempt < retries) {
          options.onProgress?.({
            event: 'conversion-retry',
            entryId: plan.entryId,
            error: message,
            attempt: attempt + 1,
          });
          await sleep(500 * 2 ** attempt);
          continue;
        }
        updateStateEntry(plan.entryId, (entry) => ({ ...entry, status: 'failed', error: message }));
        updateManifestEntry(plan.entryId, (entry) => ({
          ...entry,
          conversionStatus: 'failed',
          error: message,
        }));
        await persist();
        options.onProgress?.({ event: 'conversion-failed', entryId: plan.entryId, error: message });
      }
    }
  };

  const worker = async (): Promise<void> => {
    while (nextIndex < queue.length && options.signal?.aborted !== true) {
      const plan = queue[nextIndex];
      nextIndex += 1;
      if (plan !== undefined) await processPlan(plan);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  await writeQueue;
  await writeManifest(options.manifestPath, manifest);
  return { manifest, state, plans };
}
