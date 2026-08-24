import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ImportManifestEntrySchema,
  ImportManifestSchema,
  type ImportManifest,
  type ImportManifestEntry,
} from './types.js';

const ENTRY_COLUMNS = [
  'id',
  'sourcePath',
  'relativeSourcePath',
  'sourceType',
  'fingerprint',
  'fileSizeBytes',
  'durationSeconds',
  'width',
  'height',
  'aspectRatio',
  'frameRate',
  'interlaced',
  'audioTracks',
  'subtitleTracks',
  'dvdTitleNumber',
  'chapterCount',
  'inferredTitle',
  'inferredDate',
  'confidence',
  'proposedCollection',
  'reviewNotes',
  'conversionStatus',
  'outputPath',
  'outputChecksum',
  'uploadStatus',
  'providerAssetId',
  'error',
  'requiresHydration',
  'duplicateOf',
  'legacyFormat',
  'technicalProbe',
] as const satisfies readonly (keyof ImportManifestEntry)[];

const META_COLUMNS = [
  'schemaVersion',
  'createdAt',
  'sourceRoot',
  'outputRoot',
  'importerVersion',
  'ffprobeVersion',
  'ffmpegVersion',
  'handBrakeCliVersion',
] as const;

const CSV_COLUMNS = [...META_COLUMNS, ...ENTRY_COLUMNS] as const;

function escapeCsv(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function encodeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/u, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error('Invalid CSV: unterminated quoted field.');
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/u, ''));
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((value) => value.length > 0));
}

function required(columns: ReadonlyMap<string, string>, key: string): string {
  const value = columns.get(key);
  if (value === undefined || value === '') throw new Error(`Invalid manifest row: missing ${key}.`);
  return value;
}

function nullableNumber(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric manifest value: ${value}`);
  return parsed;
}

function nullable(value: string | undefined): string | null {
  return value === undefined || value === '' ? null : value;
}

function parseEntry(columns: ReadonlyMap<string, string>): ImportManifestEntry {
  const parseTracks = (key: string): unknown => JSON.parse(columns.get(key) || '[]') as unknown;
  return ImportManifestEntrySchema.parse({
    id: required(columns, 'id'),
    sourcePath: required(columns, 'sourcePath'),
    relativeSourcePath: required(columns, 'relativeSourcePath'),
    sourceType: required(columns, 'sourceType'),
    fingerprint: required(columns, 'fingerprint'),
    fileSizeBytes: Number(required(columns, 'fileSizeBytes')),
    durationSeconds: nullableNumber(columns.get('durationSeconds')),
    width: nullableNumber(columns.get('width')),
    height: nullableNumber(columns.get('height')),
    aspectRatio: nullable(columns.get('aspectRatio')),
    frameRate: nullableNumber(columns.get('frameRate')),
    interlaced:
      nullable(columns.get('interlaced')) === null ? null : columns.get('interlaced') === 'true',
    audioTracks: parseTracks('audioTracks'),
    subtitleTracks: parseTracks('subtitleTracks'),
    dvdTitleNumber: nullableNumber(columns.get('dvdTitleNumber')),
    chapterCount: nullableNumber(columns.get('chapterCount')),
    inferredTitle: required(columns, 'inferredTitle'),
    inferredDate: nullable(columns.get('inferredDate')),
    confidence: Number(required(columns, 'confidence')),
    proposedCollection: nullable(columns.get('proposedCollection')),
    reviewNotes: JSON.parse(columns.get('reviewNotes') || '[]') as unknown,
    conversionStatus: required(columns, 'conversionStatus'),
    outputPath: nullable(columns.get('outputPath')),
    outputChecksum: nullable(columns.get('outputChecksum')),
    uploadStatus: required(columns, 'uploadStatus'),
    providerAssetId: nullable(columns.get('providerAssetId')),
    error: nullable(columns.get('error')),
    requiresHydration: columns.get('requiresHydration') === 'true',
    duplicateOf: nullable(columns.get('duplicateOf')),
    legacyFormat: nullable(columns.get('legacyFormat')),
    technicalProbe: required(columns, 'technicalProbe'),
  });
}

function toCsv(manifest: ImportManifest): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const entry of manifest.entries) {
    const meta: Readonly<Record<(typeof META_COLUMNS)[number], unknown>> = {
      schemaVersion: manifest.schemaVersion,
      createdAt: manifest.createdAt,
      sourceRoot: manifest.sourceRoot,
      outputRoot: manifest.outputRoot,
      importerVersion: manifest.tools.importer,
      ffprobeVersion: manifest.tools.ffprobe,
      ffmpegVersion: manifest.tools.ffmpeg,
      handBrakeCliVersion: manifest.tools.handBrakeCli,
    };
    const values = CSV_COLUMNS.map((column) => {
      const value =
        column in meta
          ? meta[column as keyof typeof meta]
          : entry[column as keyof ImportManifestEntry];
      return escapeCsv(encodeValue(value));
    });
    lines.push(values.join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

function fromCsv(text: string): ImportManifest {
  const rows = parseCsv(text);
  const header = rows.shift();
  if (header === undefined) throw new Error('Invalid manifest CSV: missing header.');
  const indexes = new Map(header.map((column, index) => [column, index]));
  for (const column of CSV_COLUMNS) {
    if (!indexes.has(column)) throw new Error(`Invalid manifest CSV: missing column ${column}.`);
  }
  if (rows.length === 0) throw new Error('CSV manifests must contain at least one media entry.');
  const records = rows.map(
    (values) => new Map(header.map((column, index) => [column, values[index] ?? ''])),
  );
  const first = records[0];
  if (first === undefined) throw new Error('Invalid manifest CSV.');
  return ImportManifestSchema.parse({
    schemaVersion: Number(required(first, 'schemaVersion')),
    createdAt: required(first, 'createdAt'),
    sourceRoot: required(first, 'sourceRoot'),
    outputRoot: required(first, 'outputRoot'),
    tools: {
      importer: required(first, 'importerVersion'),
      ffprobe: nullable(first.get('ffprobeVersion')),
      ffmpeg: nullable(first.get('ffmpegVersion')),
      handBrakeCli: nullable(first.get('handBrakeCliVersion')),
    },
    entries: records.map(parseEntry),
  });
}

async function atomicWrite(filePath: string, contents: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, contents, 'utf8');
  await rename(temporary, filePath);
}

export async function writeManifest(filePath: string, manifest: ImportManifest): Promise<void> {
  const validated = ImportManifestSchema.parse(manifest);
  const contents =
    path.extname(filePath).toLocaleLowerCase() === '.csv'
      ? toCsv(validated)
      : `${JSON.stringify(validated, null, 2)}\n`;
  await atomicWrite(filePath, contents);
}

export async function readManifest(filePath: string): Promise<ImportManifest> {
  const contents = await readFile(filePath, 'utf8');
  return path.extname(filePath).toLocaleLowerCase() === '.csv'
    ? fromCsv(contents)
    : ImportManifestSchema.parse(JSON.parse(contents) as unknown);
}
