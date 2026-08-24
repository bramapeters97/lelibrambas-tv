import { stat } from 'node:fs/promises';
import { checksumFile } from './fingerprint.js';
import type { ImportJobState, ImportManifest } from './types.js';

export interface VerificationResult {
  readonly entryId: string;
  readonly valid: boolean;
  readonly outputPath: string | null;
  readonly checksum: string | null;
  readonly error: string | null;
}

export async function verifyJob(
  manifest: ImportManifest,
  state: ImportJobState,
): Promise<readonly VerificationResult[]> {
  const results: VerificationResult[] = [];
  for (const jobEntry of state.entries.filter((entry) => entry.status === 'completed')) {
    const manifestEntry = manifest.entries.find((entry) => entry.id === jobEntry.id);
    const outputPath = jobEntry.outputPath ?? manifestEntry?.outputPath ?? null;
    if (outputPath === null) {
      results.push({
        entryId: jobEntry.id,
        valid: false,
        outputPath: null,
        checksum: null,
        error: 'Missing output path.',
      });
      continue;
    }
    try {
      const outputStat = await stat(outputPath);
      if (!outputStat.isFile() || outputStat.size === 0)
        throw new Error('Viewing copy is empty or not a file.');
      const checksum = await checksumFile(outputPath);
      const expected = jobEntry.outputChecksum ?? manifestEntry?.outputChecksum;
      if (expected !== null && expected !== undefined && checksum !== expected) {
        throw new Error('Viewing-copy checksum does not match the recorded checksum.');
      }
      results.push({ entryId: jobEntry.id, valid: true, outputPath, checksum, error: null });
    } catch (error) {
      results.push({
        entryId: jobEntry.id,
        valid: false,
        outputPath,
        checksum: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
