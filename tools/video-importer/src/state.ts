import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ImportJobStateSchema, type ImportJobState, type ImportManifest } from './types.js';

export function defaultStatePath(manifestPath: string): string {
  const extension = path.extname(manifestPath);
  return `${manifestPath.slice(0, -extension.length)}.state.json`;
}

export function createJobState(
  manifestPath: string,
  manifest: ImportManifest,
  now: Date = new Date(),
): ImportJobState {
  const timestamp = now.toISOString();
  return {
    schemaVersion: 1,
    jobId: `import-${crypto.randomUUID()}`,
    manifestPath: path.resolve(manifestPath),
    outputRoot: manifest.outputRoot,
    createdAt: timestamp,
    updatedAt: timestamp,
    interrupted: false,
    entries: manifest.entries.map((entry) => ({
      id: entry.id,
      status: entry.conversionStatus,
      attempts: 0,
      startedAt: null,
      completedAt: null,
      error: entry.error,
      outputPath: entry.outputPath,
      outputChecksum: entry.outputChecksum,
    })),
  };
}

export async function writeJobState(filePath: string, state: ImportJobState): Promise<void> {
  const validated = ImportJobStateSchema.parse(state);
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
  await rename(temporary, filePath);
}

export async function readJobState(filePath: string): Promise<ImportJobState> {
  return ImportJobStateSchema.parse(JSON.parse(await readFile(filePath, 'utf8')) as unknown);
}

export function summarizeState(state: ImportJobState): Readonly<Record<string, number>> {
  const summary: Record<string, number> = { total: state.entries.length };
  for (const entry of state.entries) summary[entry.status] = (summary[entry.status] ?? 0) + 1;
  return summary;
}
