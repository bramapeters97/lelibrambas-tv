#!/usr/bin/env node
import path from 'node:path';
import { exportErrors } from './export-errors.js';
import { readManifest, writeManifest } from './manifest.js';
import { FfprobeProber } from './probe.js';
import { prepareImport, defaultImporterDataRoot } from './prepare.js';
import { detectToolVersion, SpawnProcessRunner } from './process.js';
import { runConversionJob } from './conversion.js';
import { sanitizeOutputStem } from './path-safety.js';
import { scanSource } from './scanner.js';
import {
  createJobState,
  defaultStatePath,
  readJobState,
  summarizeState,
  writeJobState,
} from './state.js';
import { verifyJob } from './verify.js';
import type { ImportManifest } from './types.js';

type ParsedOption = string | boolean;

function parseOptions(args: readonly string[]): Map<string, ParsedOption> {
  const options = new Map<string, ParsedOption>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === undefined || !token.startsWith('--'))
      throw new Error(`Unexpected argument: ${token ?? ''}`);
    const equals = token.indexOf('=');
    if (equals > 2) {
      options.set(token.slice(2, equals), token.slice(equals + 1));
      continue;
    }
    const key = token.slice(2);
    const next = args[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      options.set(key, next);
      index += 1;
    } else {
      options.set(key, true);
    }
  }
  return options;
}

function stringOption(
  options: ReadonlyMap<string, ParsedOption>,
  key: string,
  required = false,
): string | undefined {
  const value = options.get(key);
  if (typeof value === 'string' && value.length > 0) return value;
  if (required) throw new Error(`Missing required option --${key}.`);
  return undefined;
}

function numberOption(
  options: ReadonlyMap<string, ParsedOption>,
  key: string,
  fallback: number,
): number {
  const value = stringOption(options, key);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0)
    throw new Error(`--${key} must be a non-negative integer.`);
  return parsed;
}

function log(event: Readonly<Record<string, unknown>>): void {
  process.stderr.write(`${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`);
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage(): string {
  return [
    'LELIBRAMBAS+ non-destructive video importer',
    '',
    'Commands:',
    '  scan --folder <path> [--manifest <json|csv>] [--output <folder>]',
    '  prepare --folder <path> [--manifest <json|csv>] [--output <folder>] [--state <json>] [--dry-run]',
    '  convert --manifest <json|csv> [--state <json>] [--concurrency 1] [--retries 2] [--dry-run]',
    '  resume --state <json> [--concurrency 1] [--retries 2] [--dry-run]',
    '  verify --state <json>',
    '  status --state <json>',
    '  export-errors --state <json> --output <json|csv>',
  ].join('\n');
}

async function scanCommand(
  options: ReadonlyMap<string, ParsedOption>,
  signal: AbortSignal,
): Promise<void> {
  const sourceRoot = path.resolve(stringOption(options, 'folder', true) as string);
  const outputRoot = path.resolve(
    stringOption(options, 'output') ?? path.join(defaultImporterDataRoot(), 'viewing-copies'),
  );
  const runner = new SpawnProcessRunner();
  const prober = new FfprobeProber(runner);
  const entries = await scanSource({
    sourceRoot,
    prober,
    signal,
    logger: (event) => log({ event: 'scan', ...event }),
  });
  const manifest: ImportManifest = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
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
  const manifestPath = stringOption(options, 'manifest');
  if (manifestPath === undefined) print(manifest);
  else {
    await writeManifest(path.resolve(manifestPath), manifest);
    print({ manifestPath: path.resolve(manifestPath), entries: entries.length });
  }
}

async function prepareCommand(
  options: ReadonlyMap<string, ParsedOption>,
  signal: AbortSignal,
): Promise<void> {
  const dryRun = options.get('dry-run') === true;
  const requestedManifestPath = stringOption(options, 'manifest');
  if (!dryRun && requestedManifestPath === undefined) {
    throw new Error('Missing required option --manifest unless --dry-run is used.');
  }
  const manifestPath =
    requestedManifestPath ?? path.join(defaultImporterDataRoot(), 'dry-run', 'manifest.json');
  const prepared = await prepareImport({
    sourceRoot: stringOption(options, 'folder', true) as string,
    manifestPath,
    dryRun,
    signal,
    logger: (event) => log({ event: 'scan', ...event }),
    ...(stringOption(options, 'output') === undefined
      ? {}
      : { outputRoot: stringOption(options, 'output') as string }),
    ...(stringOption(options, 'state') === undefined
      ? {}
      : { statePath: stringOption(options, 'state') as string }),
  });
  print({
    dryRun,
    manifestPath: prepared.manifestPath,
    statePath: prepared.statePath,
    outputRoot: prepared.manifest.outputRoot,
    entries: prepared.manifest.entries.length,
  });
}

async function convertCommand(
  options: ReadonlyMap<string, ParsedOption>,
  signal: AbortSignal,
): Promise<void> {
  const manifestPath = path.resolve(stringOption(options, 'manifest', true) as string);
  const statePath = path.resolve(stringOption(options, 'state') ?? defaultStatePath(manifestPath));
  const manifest = await readManifest(manifestPath);
  let state;
  try {
    state = await readJobState(statePath);
  } catch {
    state = createJobState(manifestPath, manifest);
    if (options.get('dry-run') !== true) await writeJobState(statePath, state);
  }
  const result = await runConversionJob(manifest, state, {
    manifestPath,
    statePath,
    dryRun: options.get('dry-run') === true,
    concurrency: numberOption(options, 'concurrency', 1),
    retries: numberOption(options, 'retries', 2),
    signal,
    onProgress: log,
  });
  print(
    options.get('dry-run') === true
      ? { dryRun: true, plans: result.plans }
      : summarizeState(result.state),
  );
}

async function resumeCommand(
  options: ReadonlyMap<string, ParsedOption>,
  signal: AbortSignal,
): Promise<void> {
  const statePath = path.resolve(stringOption(options, 'state', true) as string);
  const state = await readJobState(statePath);
  const manifest = await readManifest(state.manifestPath);
  const result = await runConversionJob(manifest, state, {
    manifestPath: state.manifestPath,
    statePath,
    dryRun: options.get('dry-run') === true,
    concurrency: numberOption(options, 'concurrency', 1),
    retries: numberOption(options, 'retries', 2),
    signal,
    onProgress: log,
  });
  print(
    options.get('dry-run') === true
      ? { dryRun: true, plans: result.plans }
      : summarizeState(result.state),
  );
}

async function verifyCommand(options: ReadonlyMap<string, ParsedOption>): Promise<void> {
  const state = await readJobState(path.resolve(stringOption(options, 'state', true) as string));
  const manifest = await readManifest(state.manifestPath);
  const results = await verifyJob(manifest, state);
  print({
    valid: results.filter((result) => result.valid).length,
    invalid: results.filter((result) => !result.valid).length,
    results,
  });
  if (results.some((result) => !result.valid)) process.exitCode = 1;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command === undefined || command === 'help' || command === '--help') {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const options = parseOptions(args);
  const abortController = new AbortController();
  const interrupt = (): void => {
    log({
      level: 'warning',
      event: 'interrupt',
      message: 'Stopping safely; source files remain untouched.',
    });
    abortController.abort();
  };
  process.once('SIGINT', interrupt);
  try {
    if (command === 'scan') await scanCommand(options, abortController.signal);
    else if (command === 'prepare') await prepareCommand(options, abortController.signal);
    else if (command === 'convert') await convertCommand(options, abortController.signal);
    else if (command === 'resume') await resumeCommand(options, abortController.signal);
    else if (command === 'verify') await verifyCommand(options);
    else if (command === 'status') {
      print(
        summarizeState(
          await readJobState(path.resolve(stringOption(options, 'state', true) as string)),
        ),
      );
    } else if (command === 'export-errors') {
      const statePath = path.resolve(stringOption(options, 'state', true) as string);
      const outputPath = path.resolve(stringOption(options, 'output', true) as string);
      print({
        outputPath,
        failures: await exportErrors(await readJobState(statePath), outputPath),
      });
    } else {
      throw new Error(`Unknown command: ${command}\n\n${usage()}`);
    }
  } finally {
    process.removeListener('SIGINT', interrupt);
  }
}

await main().catch((error: unknown) => {
  log({
    level: 'error',
    event: 'fatal',
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
