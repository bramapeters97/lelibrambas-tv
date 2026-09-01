import type { Collection, HomeRail, Person, Place, Profile, VideoRecord } from '@lelibrambas/types';
import generatedCatalog from '../../../data/media_catalog.json';

export interface MediaCatalogItem {
  id: number;
  title: string;
  year: number | null;
  description: string;
  category: string;
  poster_url: string;
  stream_video_id: string;
  featured: 0 | 1;
  priority: -1 | 0 | 1 | 2;
  available: 0 | 1;
}

export interface CatalogueVideoRecord extends Omit<VideoRecord, 'durationSeconds'> {
  catalogueId: number;
  posterUrl: string;
  streamVideoId: string;
  durationSeconds: number | null;
  priority: -1 | 0 | 1 | 2;
  available: boolean;
}

export interface CatalogueCategory {
  name: string;
  description: string;
  movies: string[];
}

const requiredKeys = [
  'id',
  'title',
  'year',
  'description',
  'category',
  'poster_url',
  'stream_video_id',
] as const;

const categoryOrder = ['JEUGDFILMS', 'VAKANTIEFILMS', 'EVENTS', 'OTHERS'];
const palettes: Array<[string, string, string]> = [
  ['#241A22', '#6E4A3E', '#E9C778'],
  ['#10213D', '#25718A', '#D7B16A'],
  ['#2B233F', '#705B91', '#F0C58B'],
  ['#132B2B', '#417C6A', '#D5BE7C'],
  ['#311927', '#9B4E55', '#F0C58B'],
  ['#2B1E19', '#8E5A42', '#F1D7A1'],
  ['#07192A', '#254B75', '#8FC7E8'],
  ['#241B34', '#71556D', '#DCA86C'],
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function assertString(record: Record<string, unknown>, key: string, index: number): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`Catalogue item ${index + 1} has a non-string ${key}.`);
  }
  return value;
}

function binaryValue(
  record: Record<string, unknown>,
  key: 'featured' | 'available',
  index: number,
  fallback: 0 | 1,
): 0 | 1 {
  const value = record[key];
  if (value === undefined) return fallback;
  if (value !== 0 && value !== 1) {
    throw new Error(`Catalogue item ${index + 1} has an invalid binary ${key}.`);
  }
  return value;
}

function priorityValue(record: Record<string, unknown>, index: number): -1 | 0 | 1 | 2 {
  const value = record.priority;
  if (value === undefined) return 0;
  if (value !== -1 && value !== 0 && value !== 1 && value !== 2) {
    throw new Error(`Catalogue item ${index + 1} has an invalid priority.`);
  }
  return value;
}

export function parseMediaCatalog(input: unknown): MediaCatalogItem[] {
  if (!Array.isArray(input)) throw new Error('Catalogue payload must be a JSON array.');
  const ids = new Set<number>();
  const records = input.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Catalogue item ${index + 1} must be an object.`);
    }
    const record = value as Record<string, unknown>;
    for (const key of requiredKeys) {
      if (!(key in record)) throw new Error(`Catalogue item ${index + 1} is missing ${key}.`);
    }
    if (!Number.isInteger(record.id)) {
      throw new Error(`Catalogue item ${index + 1} has an invalid integer id.`);
    }
    const id = record.id as number;
    if (ids.has(id)) throw new Error(`Catalogue item ${index + 1} repeats id ${id}.`);
    ids.add(id);

    const title = assertString(record, 'title', index).trim();
    const description = assertString(record, 'description', index).trim();
    const category = assertString(record, 'category', index).trim();
    const posterUrl = assertString(record, 'poster_url', index).trim();
    const streamVideoId = assertString(record, 'stream_video_id', index).trim();
    if (!title || !category || !streamVideoId) {
      throw new Error(`Catalogue item ${index + 1} has an empty required string field.`);
    }
    if (record.year !== null && !Number.isInteger(record.year)) {
      throw new Error(`Catalogue item ${index + 1} has an invalid year.`);
    }
    return {
      id,
      title,
      year: record.year as number | null,
      description,
      category,
      poster_url: posterUrl,
      stream_video_id: streamVideoId,
      featured: binaryValue(record, 'featured', index, index === 0 ? 1 : 0),
      priority: priorityValue(record, index),
      available: binaryValue(record, 'available', index, 1),
    };
  });
  return records.sort((left, right) => left.id - right.id);
}

export function createCatalogue(input: unknown): CatalogueVideoRecord[] {
  return parseMediaCatalog(input).map((item, index) => {
    const id = String(item.id);
    const palette = palettes[index % palettes.length] ?? palettes[0]!;
    let playbackAssetId: string | null = null;
    try {
      const pathSegments = new URL(item.stream_video_id).pathname.split('/').filter(Boolean);
      playbackAssetId = pathSegments[0] ?? null;
    } catch {
      playbackAssetId = null;
    }
    return {
      catalogueId: item.id,
      posterUrl: item.poster_url,
      streamVideoId: item.stream_video_id,
      id,
      slug: `${slugify(item.title) || 'movie'}-${item.id}`,
      title: item.title,
      subtitle: [item.category, item.year].filter((value) => value !== null).join(' - '),
      description: item.description,
      originalFilename: `catalogue-record-${item.id}`,
      sourceType: 'mp4',
      recordingDate: item.year === null ? null : `${item.year}-01-01`,
      dateApproximate: true,
      year: item.year,
      durationSeconds: null,
      aspectRatio: '16:9',
      resolution: 'Adaptive Stream',
      frameRate: 25,
      interlaced: false,
      people: [],
      location: item.category,
      country: null,
      tags: [item.category],
      categories: [item.category],
      collectionId: slugify(item.category),
      seasonNumber: null,
      episodeNumber: index + 1,
      artwork: {
        thumbnail: item.poster_url,
        landscape: item.poster_url,
        portrait: item.poster_url,
        backdrop: item.poster_url,
        palette,
      },
      previewStartSeconds: 0,
      featured: item.featured === 1,
      priority: item.priority,
      available: item.available === 1,
      visibility: 'family',
      processingStatus: item.available === 1 ? 'ready' : 'unavailable',
      playbackProvider: 'cloudflare-stream',
      playbackAssetId,
      playbackUrl: item.stream_video_id,
      progressSeconds: 0,
      lastWatched: null,
      addedDate: '2026-08-24T00:00:00.000Z',
      restorationNotes: null,
      legacyFormat: null,
      chapterMarkers: [],
      playCount: 0,
    };
  });
}

function orderedCategoryNames(records: readonly CatalogueVideoRecord[]): string[] {
  const firstAppearance = [...new Set(records.map((video) => video.categories[0]!))];
  return [
    ...categoryOrder.filter((category) => firstAppearance.includes(category)),
    ...firstAppearance.filter((category) => !categoryOrder.includes(category)),
  ];
}

export function createCollections(records: readonly CatalogueVideoRecord[]): Collection[] {
  return orderedCategoryNames(records).map((category) => ({
    id: slugify(category),
    title: category,
    kind: category === 'VAKANTIEFILMS' ? 'holiday' : 'curated',
    description: `${records.filter((video) => video.categories.includes(category)).length} films in ${category}.`,
    videoIds: records
      .filter((video) => video.categories.includes(category))
      .sort((left, right) => left.catalogueId - right.catalogueId)
      .map((video) => video.id),
  }));
}

export function createCatalogueCategories(
  records: readonly CatalogueVideoRecord[],
): CatalogueCategory[] {
  return createCollections(records).map((collection) => ({
    name: collection.title,
    description: collection.description,
    movies: collection.videoIds
      .map((id) => records.find((video) => video.id === id)?.title)
      .filter((title): title is string => Boolean(title)),
  }));
}

export const catalogue = createCatalogue(generatedCatalog);
export const collections = createCollections(catalogue);
export const catalogueCategories = createCatalogueCategories(catalogue);

export const profiles: Profile[] = [
  {
    id: 'bart-astrid',
    name: 'Bart & Astrid',
    initials: 'BA',
    accent: '#70D8FF',
    watchlist: ['1', '3'],
    recentlyDiscovered: ['JEUGDFILMS', 'VAKANTIEFILMS'],
  },
  {
    id: 'bram-edvin',
    name: 'Bram & Edvin',
    initials: 'BE',
    accent: '#8275FF',
    watchlist: ['11'],
    recentlyDiscovered: ['OTHERS'],
  },
  {
    id: 'eline-luca',
    name: 'Eline & Luca',
    initials: 'EL',
    accent: '#E9C778',
    watchlist: ['2', '18'],
    recentlyDiscovered: ['JEUGDFILMS', 'EVENTS', 'OTHERS', 'VAKANTIEFILMS'],
  },
];

export const people: Person[] = [];
export const places: Place[] = [];

export const homeRails: HomeRail[] = collections.map((collection, index) => ({
  id: collection.id,
  title: collection.title,
  order: index + 1,
  visible: true,
  videoIds: collection.videoIds,
}));

export function getVideo(idOrSlug: string): CatalogueVideoRecord | undefined {
  return catalogue.find((video) => video.id === idOrSlug || video.slug === idOrSlug);
}

export function surpriseMe(): CatalogueVideoRecord {
  return catalogue[0]!;
}
