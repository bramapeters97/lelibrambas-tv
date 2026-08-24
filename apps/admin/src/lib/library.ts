import { createDemoSnapshot } from '../data/demo';
import type { LibrarySnapshot, ProcessingStatus, VideoRecord } from '../types';

export const STORAGE_KEY = 'lelibrambas-admin-library-v1';

export interface LibraryMetrics {
  totalVideos: number;
  totalDurationSeconds: number;
  totalSourceBytes: number;
  convertedBytes: number;
  dvdSources: number;
  processing: number;
  failed: number;
  missingDates: number;
  missingPeople: number;
  missingLocations: number;
  missingArtwork: number;
  unwatched: number;
  recentlyAdded: number;
}

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  const hours = Math.floor(safeSeconds / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function formatCompactDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.round((totalSeconds % 3_600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1_024)), units.length - 1);
  const value = bytes / 1_024 ** unitIndex;
  const digits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex] ?? 'B'}`;
}

export function statusLabel(status: ProcessingStatus): string {
  const labels: Record<ProcessingStatus, string> = {
    'awaiting-review': 'Awaiting review',
    queued: 'Queued',
    processing: 'Processing',
    failed: 'Failed',
    'ready-to-upload': 'Ready to upload',
    uploaded: 'Uploaded',
    unavailable: 'Unavailable',
  };
  return labels[status];
}

export function calculateMetrics(snapshot: LibrarySnapshot): LibraryMetrics {
  const totalDurationSeconds = snapshot.videos.reduce(
    (total, video) => total + video.durationSeconds,
    0,
  );
  const totalSourceBytes = snapshot.videos.reduce(
    (total, video) => total + video.sourceSizeBytes,
    0,
  );
  const convertedBytes = snapshot.jobs.reduce((total, job) => total + job.outputSizeBytes, 0);

  return {
    totalVideos: snapshot.videos.length,
    totalDurationSeconds,
    totalSourceBytes,
    convertedBytes,
    dvdSources: snapshot.videos.filter((video) => video.sourceType === 'dvd-video-ts').length,
    processing: snapshot.jobs.filter((job) => job.status === 'processing').length,
    failed: snapshot.jobs.filter((job) => job.status === 'failed').length,
    missingDates: snapshot.videos.filter((video) => !video.recordingDate).length,
    missingPeople: snapshot.videos.filter((video) => video.people.length === 0).length,
    missingLocations: snapshot.videos.filter((video) => !video.place.trim()).length,
    missingArtwork: snapshot.videos.filter((video) => video.artworkStatus.startsWith('missing'))
      .length,
    unwatched: snapshot.videos.filter((video) => video.progress === 0).length,
    recentlyAdded: snapshot.videos.filter((video) => video.addedDate >= '2026-08-10').length,
  };
}

function csvEscape(value: string | number | boolean | null): string {
  const text = value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csvFields = [
  'id',
  'title',
  'subtitle',
  'description',
  'originalFilename',
  'sourceType',
  'sourceReference',
  'recordingDate',
  'year',
  'durationSeconds',
  'aspectRatio',
  'resolution',
  'frameRate',
  'interlaced',
  'people',
  'place',
  'country',
  'tags',
  'categories',
  'collection',
  'featured',
  'visibility',
  'processingStatus',
  'publishState',
  'artworkStatus',
] as const;

export function videosToCsv(videos: VideoRecord[]): string {
  const rows = videos.map((video) => {
    const values: Record<(typeof csvFields)[number], string | number | boolean | null> = {
      id: video.id,
      title: video.title,
      subtitle: video.subtitle,
      description: video.description,
      originalFilename: video.originalFilename,
      sourceType: video.sourceType,
      sourceReference: video.sourceReference,
      recordingDate: video.recordingDate,
      year: video.year,
      durationSeconds: video.durationSeconds,
      aspectRatio: video.aspectRatio,
      resolution: video.resolution,
      frameRate: video.frameRate,
      interlaced: video.interlaced,
      people: video.people.join('|'),
      place: video.place,
      country: video.country,
      tags: video.tags.join('|'),
      categories: video.categories.join('|'),
      collection: video.collection,
      featured: video.featured,
      visibility: video.visibility,
      processingStatus: video.processingStatus,
      publishState: video.publishState,
      artworkStatus: video.artworkStatus,
    };
    return csvFields.map((field) => csvEscape(values[field])).join(',');
  });
  return [csvFields.join(','), ...rows].join('\r\n');
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? '';
    const next = text[index + 1] ?? '';
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field.replace(/\r$/, ''));
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

function normaliseList(value: string): string[] {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeStatus(value: string): ProcessingStatus {
  const statuses: ProcessingStatus[] = [
    'awaiting-review',
    'queued',
    'processing',
    'failed',
    'ready-to-upload',
    'uploaded',
    'unavailable',
  ];
  return statuses.includes(value as ProcessingStatus)
    ? (value as ProcessingStatus)
    : 'awaiting-review';
}

export function videosFromCsv(text: string): VideoRecord[] {
  const rows = parseCsv(text);
  const header = rows[0];
  if (!header || !header.includes('title')) {
    throw new Error('CSV must include a title column.');
  }

  const demoTemplate = createDemoSnapshot().videos[0];
  if (!demoTemplate) throw new Error('Demo template is unavailable.');

  return rows.slice(1).map((cells, rowIndex) => {
    const record = Object.fromEntries(header.map((name, index) => [name, cells[index] ?? '']));
    const title = record.title?.trim();
    if (!title) throw new Error(`CSV row ${rowIndex + 2} has no title.`);
    const id = record.id?.trim() || `csv-${String(rowIndex + 1).padStart(3, '0')}`;
    const year = record.year ? Number(record.year) : null;
    const durationSeconds = Number(record.durationSeconds || 0);

    return {
      ...structuredClone(demoTemplate),
      id,
      slug: title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
      title,
      subtitle: record.subtitle ?? '',
      description: record.description ?? '',
      originalFilename: record.originalFilename ?? '',
      sourceReference: record.sourceReference ?? 'Imported CSV',
      recordingDate: record.recordingDate || null,
      year: Number.isFinite(year) ? year : null,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
      people: normaliseList(record.people ?? ''),
      place: record.place ?? '',
      country: record.country ?? '',
      tags: normaliseList(record.tags ?? ''),
      categories: normaliseList(record.categories ?? ''),
      collection: record.collection ?? '',
      featured: record.featured === 'true',
      processingStatus: safeStatus(record.processingStatus ?? ''),
      publishState:
        record.publishState === 'published' ||
        record.publishState === 'ready' ||
        record.publishState === 'hidden'
          ? record.publishState
          : 'draft',
      artworkStatus:
        record.artworkStatus === 'complete' ||
        record.artworkStatus === 'generated' ||
        record.artworkStatus === 'missing-backdrop'
          ? record.artworkStatus
          : 'missing-poster',
      checksum: `csv-import-${rowIndex + 1}`,
    };
  });
}

export function isLibrarySnapshot(value: unknown): value is LibrarySnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LibrarySnapshot>;
  return (
    candidate.schemaVersion === 1 &&
    Array.isArray(candidate.videos) &&
    Array.isArray(candidate.jobs) &&
    Array.isArray(candidate.devices) &&
    Array.isArray(candidate.rails) &&
    Boolean(candidate.settings && typeof candidate.settings === 'object')
  );
}

export function parseSnapshotJson(text: string): LibrarySnapshot {
  const value: unknown = JSON.parse(text);
  if (!isLibrarySnapshot(value)) {
    throw new Error('This JSON file is not a LeliBramBas+ library export.');
  }
  return value;
}

export function loadStoredSnapshot(storage: Pick<Storage, 'getItem'>): LibrarySnapshot {
  try {
    const stored = storage.getItem(STORAGE_KEY);
    if (!stored) return createDemoSnapshot();
    return parseSnapshotJson(stored);
  } catch {
    return createDemoSnapshot();
  }
}

export function downloadText(filename: string, text: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
