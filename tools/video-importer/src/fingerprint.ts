import { createHash } from 'node:crypto';
import { open, stat } from 'node:fs/promises';

const SAMPLE_BYTES = 64 * 1024;

export async function fingerprintFile(filePath: string): Promise<string> {
  const metadata = await stat(filePath);
  const hash = createHash('sha256');
  hash.update(`size:${metadata.size}\n`);
  if (metadata.size === 0) return hash.digest('hex');

  const handle = await open(filePath, 'r');
  try {
    const positions = new Set([
      0,
      Math.max(0, Math.floor(metadata.size / 2) - Math.floor(SAMPLE_BYTES / 2)),
      Math.max(0, metadata.size - SAMPLE_BYTES),
    ]);
    for (const position of [...positions].sort((left, right) => left - right)) {
      const length = Math.min(SAMPLE_BYTES, metadata.size - position);
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, position);
      hash.update(`offset:${position}:length:${bytesRead}\n`);
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}

export async function checksumFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(1024 * 1024);
    let position = 0;
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}
