import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImportJobState } from './types.js';

function csv(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export async function exportErrors(state: ImportJobState, outputPath: string): Promise<number> {
  const failures = state.entries.filter(
    (entry) => entry.status === 'failed' || entry.status === 'interrupted',
  );
  await mkdir(path.dirname(outputPath), { recursive: true });
  if (path.extname(outputPath).toLocaleLowerCase() === '.csv') {
    const lines = ['id,status,attempts,outputPath,error'];
    for (const entry of failures) {
      lines.push(
        [entry.id, entry.status, String(entry.attempts), entry.outputPath ?? '', entry.error ?? '']
          .map(csv)
          .join(','),
      );
    }
    await writeFile(outputPath, `${lines.join('\r\n')}\r\n`, 'utf8');
  } else {
    await writeFile(
      outputPath,
      `${JSON.stringify({ jobId: state.jobId, failures }, null, 2)}\n`,
      'utf8',
    );
  }
  return failures.length;
}
