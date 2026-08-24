import os from 'node:os';
import path from 'node:path';
import { detectToolVersion, SpawnProcessRunner, type ProcessRunner } from './process.js';
import { FfprobeProber } from './probe.js';
import { assertOutputOutsideSource, sanitizeOutputStem } from './path-safety.js';
import { scanSource, type ScanOptions } from './scanner.js';
import { writeManifest } from './manifest.js';
import { createJobState, defaultStatePath, writeJobState } from './state.js';
import type { ImportJobState, ImportManifest, TechnicalProber } from './types.js';

export interface PrepareOptions {
  readonly sourceRoot: string;
  readonly manifestPath: string;
  readonly outputRoot?: string;
  readonly statePath?: string;
  readonly prober?: TechnicalProber;
  readonly runner?: ProcessRunner;
  readonly logger?: ScanOptions['logger'];
  readonly signal?: AbortSignal;
  readonly now?: () => Date;
  readonly dryRun?: boolean;
}

export interface PreparedImport {
  readonly manifest: ImportManifest;
  readonly state: ImportJobState;
  readonly manifestPath: string;
  readonly statePath: string;
}

export function defaultImporterDataRoot(): string {
  const base = process.env.LOCALAPPDATA ?? process.env.APPDATA ?? os.homedir();
  return path.join(base, 'LeliBramBasPlus', 'video-importer');
}

export async function prepareImport(options: PrepareOptions): Promise<PreparedImport> {
  const sourceRoot = path.resolve(options.sourceRoot);
  const manifestPath = path.resolve(options.manifestPath);
  const outputRoot = path.resolve(
    options.outputRoot ?? path.join(defaultImporterDataRoot(), 'viewing-copies'),
  );
  const statePath = path.resolve(options.statePath ?? defaultStatePath(manifestPath));
  assertOutputOutsideSource(sourceRoot, outputRoot);
  const runner = options.runner ?? new SpawnProcessRunner();
  const prober = options.prober ?? new FfprobeProber(runner);
  const entries = await scanSource({
    sourceRoot,
    prober,
    ...(options.logger === undefined ? {} : { logger: options.logger }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  const timestamp = (options.now ?? (() => new Date()))().toISOString();
  const manifest: ImportManifest = {
    schemaVersion: 1,
    createdAt: timestamp,
    sourceRoot,
    outputRoot,
    tools: {
      importer: '0.1.0',
      ffprobe: await prober.version(),
      ffmpeg: await detectToolVersion(runner, 'ffmpeg', ['-version']),
      handBrakeCli: await detectToolVersion(runner, 'HandBrakeCLI', ['--version']),
    },
    entries: entries.map((entry) => ({
      ...entry,
      outputPath: path.join(
        outputRoot,
        `${sanitizeOutputStem(entry.inferredTitle)}-${entry.id.slice(-8)}.mp4`,
      ),
    })),
  };
  const state = createJobState(manifestPath, manifest, new Date(timestamp));
  if (options.dryRun !== true) {
    await writeManifest(manifestPath, manifest);
    await writeJobState(statePath, state);
  }
  return { manifest, state, manifestPath, statePath };
}
