import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ImportManifest,
  ImportManifestEntry,
  TechnicalProber,
  TechnicalProbeResult,
} from '../src/index.js';

export const EMPTY_TECHNICAL: TechnicalProbeResult = {
  durationSeconds: 12,
  width: 1920,
  height: 1080,
  aspectRatio: '16:9',
  frameRate: 25,
  interlaced: false,
  audioTracks: [{ index: 1, codec: 'aac', language: 'und', title: null }],
  subtitleTracks: [],
  chapterCount: 0,
};

export class FakeProber implements TechnicalProber {
  public async probe(): Promise<TechnicalProbeResult> {
    return Promise.resolve(EMPTY_TECHNICAL);
  }
  public async version(): Promise<string> {
    return Promise.resolve('ffprobe fake');
  }
}

export async function writeBytes(filePath: string, text: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text, 'utf8');
}

export function makeEntry(sourcePath: string, outputPath: string): ImportManifestEntry {
  return {
    id: 'video-0000000000000001',
    sourcePath,
    relativeSourcePath: 'source.mp4',
    sourceType: 'regular-video',
    fingerprint: 'abc123',
    fileSizeBytes: 100,
    durationSeconds: 12,
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    frameRate: 25,
    interlaced: false,
    audioTracks: [],
    subtitleTracks: [],
    dvdTitleNumber: null,
    chapterCount: 0,
    inferredTitle: 'Source',
    inferredDate: null,
    confidence: 0.5,
    proposedCollection: null,
    reviewNotes: [],
    conversionStatus: 'pending',
    outputPath,
    outputChecksum: null,
    uploadStatus: 'not-requested',
    providerAssetId: null,
    error: null,
    requiresHydration: false,
    duplicateOf: null,
    legacyFormat: 'MP4',
    technicalProbe: 'ffprobe',
  };
}

export function makeManifest(
  sourceRoot: string,
  outputRoot: string,
  entry: ImportManifestEntry,
): ImportManifest {
  return {
    schemaVersion: 1,
    createdAt: '2026-08-17T00:00:00.000Z',
    sourceRoot,
    outputRoot,
    tools: { importer: '0.1.0', ffprobe: 'fake', ffmpeg: 'fake', handBrakeCli: null },
    entries: [entry],
  };
}
