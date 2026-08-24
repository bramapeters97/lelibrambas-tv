import type {
  AdminSettings,
  DeviceRecord,
  HomeRail,
  ImportJob,
  LibrarySnapshot,
  ProcessingStatus,
  VideoRecord,
} from '../types';

type CatalogueCategory = 'JEUGDFILMS' | 'VAKANTIEFILMS' | 'EVENTS' | 'OVERIGE';

interface CatalogueSeed {
  title: string;
  description: string;
  year: number | null;
  category: CatalogueCategory;
  shelf: string;
}

interface CategorySeed {
  category: CatalogueCategory;
  titlePrefix: string;
  shelf: string;
  itemCount: number;
}

const categorySeeds: CategorySeed[] = [
  {
    category: 'JEUGDFILMS',
    titlePrefix: 'Jeugdfilm',
    shelf: 'Synthetic childhood collection',
    itemCount: 3,
  },
  {
    category: 'VAKANTIEFILMS',
    titlePrefix: 'Vakantiefilm',
    shelf: 'Synthetic holiday collection',
    itemCount: 17,
  },
  {
    category: 'EVENTS',
    titlePrefix: 'Evenementfilm',
    shelf: 'Synthetic event collection',
    itemCount: 8,
  },
  {
    category: 'OVERIGE',
    titlePrefix: 'Overige film',
    shelf: 'Synthetic miscellaneous collection',
    itemCount: 7,
  },
];

const catalogueSeeds: CatalogueSeed[] = categorySeeds.flatMap((category) =>
  Array.from({ length: category.itemCount }, (_, index) => {
    const sequence = String(index + 1).padStart(2, '0');
    return {
      title: `${category.titlePrefix} ${sequence}`,
      description: `Fictional ${category.category} catalogue placeholder ${sequence}.`,
      year: null,
      category: category.category,
      shelf: category.shelf,
    };
  }),
);

const palettes: Array<[string, string]> = [
  ['#6E4A3E', '#E9C778'],
  ['#244B68', '#78D7CF'],
  ['#3B2F68', '#9B8EE6'],
  ['#244A47', '#D3C47C'],
  ['#634047', '#E2A675'],
  ['#573044', '#C56D72'],
  ['#1F5061', '#8CC4B2'],
  ['#2B233F', '#F0C58B'],
];

const processingByIndex: Record<number, ProcessingStatus> = {
  0: 'uploaded',
  1: 'uploaded',
  2: 'processing',
  3: 'uploaded',
  5: 'failed',
  10: 'uploaded',
  11: 'processing',
  14: 'uploaded',
  19: 'awaiting-review',
  22: 'awaiting-review',
  27: 'uploaded',
  28: 'ready-to-upload',
  34: 'unavailable',
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const demoVideos: VideoRecord[] = catalogueSeeds.map((seed, index) => {
  const processingStatus = processingByIndex[index] ?? 'ready-to-upload';
  const durationSeconds = 900 + ((index * 311) % 4_200);
  const palette = palettes[index % palettes.length] ?? palettes[0] ?? ['#6E4A3E', '#E9C778'];
  const generatedDate = `2026-08-${String((index % 14) + 1).padStart(2, '0')}T10:00:00.000Z`;

  return {
    id: `video-${String(index + 1).padStart(2, '0')}`,
    slug: slugify(seed.title),
    title: seed.title,
    subtitle: 'Fictional catalogue-only archive placeholder',
    description: seed.description,
    originalFilename: `synthetic-admin-entry-${String(index + 1).padStart(2, '0')}.placeholder`,
    sourceType: 'generated-demo',
    sourceReference: `Synthetic demo source ${String(index + 1).padStart(2, '0')}`,
    recordingDate: null,
    approximateDate: true,
    year: seed.year,
    durationSeconds,
    aspectRatio: seed.category === 'JEUGDFILMS' ? '4:3' : '16:9',
    resolution: 'Synthetic placeholder',
    frameRate: 25,
    interlaced: seed.category === 'JEUGDFILMS',
    people: ['Synthetic family'],
    place: seed.shelf,
    country: '',
    tags: [seed.category, 'synthetic', 'catalogue-only'],
    categories: [seed.category],
    collection: seed.shelf,
    seasonNumber: seed.category === 'JEUGDFILMS' ? 1 : null,
    episodeNumber:
      seed.category === 'JEUGDFILMS'
        ? catalogueSeeds.filter((candidate, candidateIndex) => {
            return candidate.category === seed.category && candidateIndex <= index;
          }).length
        : null,
    previewStartSeconds: 0,
    featured: index === 0 || index === 3 || index === 20 || index === 28,
    visibility: index === 34 ? 'hidden' : 'family',
    processingStatus,
    playbackProvider: processingStatus === 'uploaded' ? 'cloudflare-stream' : 'local',
    playbackAssetId: processingStatus === 'uploaded' ? `synthetic_stream_${index + 1}` : null,
    progress: [0, 0.18, 0.42, 0.76, 0.94][index % 5] ?? 0,
    lastWatched:
      index % 4 === 0
        ? null
        : `2026-08-${String(15 - (index % 12)).padStart(2, '0')}T20:15:00.000Z`,
    addedDate: generatedDate,
    restorationNotes:
      'Fictional demo record only. No original media, private filenames, source paths or production references are bundled.',
    legacyFormat: seed.category === 'JEUGDFILMS' ? 'Synthetic 4:3 placeholder' : null,
    chapters: [
      { id: `chapter-${index}-1`, title: 'Opening placeholder', timeSeconds: 0 },
      {
        id: `chapter-${index}-2`,
        title: 'Middle placeholder',
        timeSeconds: Math.floor(durationSeconds * 0.45),
      },
    ],
    publishState:
      processingStatus === 'uploaded'
        ? 'published'
        : processingStatus === 'awaiting-review'
          ? 'draft'
          : 'ready',
    artworkStatus: index % 7 === 0 ? 'generated' : index % 11 === 0 ? 'missing-poster' : 'complete',
    sourceSizeBytes: 280_000_000 + index * 91_000_000,
    checksum: `synthetic-demo-${String(index + 1).padStart(2, '0')}`,
    palette,
  };
});

export const demoJobs: ImportJob[] = [
  {
    id: 'job-video-ts-review',
    displayName: 'Synthetic VIDEO_TS review',
    sourceReference: 'Synthetic demo source VIDEO_TS-01',
    sourceKind: 'video-ts',
    status: 'review',
    progress: 100,
    filesFound: 12,
    sourceSizeBytes: 3_812_000_000,
    outputSizeBytes: 0,
    detectedAt: '2026-08-17T08:42:00.000Z',
    updatedAt: '2026-08-17T08:43:14.000Z',
    preset: 'Synthetic PAL placeholder - H.264 viewing copy',
    etaMinutes: null,
    error: null,
    duplicateOf: null,
    requiresHydration: false,
    candidates: [
      {
        id: 'synthetic-title-1',
        titleNumber: 1,
        label: 'Synthetic main title',
        durationSeconds: 3_218,
        chapters: 10,
        resolution: '720 x 576',
        frameRate: 25,
        aspectRatio: '4:3',
        interlaced: true,
        confidence: 0.96,
        selected: true,
        role: 'main-title',
      },
      {
        id: 'synthetic-title-2',
        titleNumber: 2,
        label: 'Synthetic possible extra',
        durationSeconds: 512,
        chapters: 3,
        resolution: '720 x 576',
        frameRate: 25,
        aspectRatio: '4:3',
        interlaced: true,
        confidence: 0.78,
        selected: true,
        role: 'extra',
      },
      {
        id: 'synthetic-title-3',
        titleNumber: 7,
        label: 'Synthetic menu loop',
        durationSeconds: 24,
        chapters: 1,
        resolution: '720 x 576',
        frameRate: 25,
        aspectRatio: '4:3',
        interlaced: true,
        confidence: 0.99,
        selected: false,
        role: 'menu-loop',
      },
    ],
    log: [
      'Synthetic VIDEO_TS-like structure indexed',
      '12 placeholder files represented without source media',
      '3 playable title candidates detected',
    ],
  },
  {
    id: 'job-processing-demo',
    displayName: 'Synthetic viewing copy',
    sourceReference: 'Synthetic demo source FILE-01',
    sourceKind: 'file',
    status: 'processing',
    progress: 64,
    filesFound: 1,
    sourceSizeBytes: 3_148_000_000,
    outputSizeBytes: 1_084_000_000,
    detectedAt: '2026-08-16T20:10:00.000Z',
    updatedAt: '2026-08-17T09:01:00.000Z',
    preset: 'Synthetic HD placeholder - high-quality derivative',
    etaMinutes: 18,
    error: null,
    duplicateOf: null,
    requiresHydration: false,
    candidates: [],
    log: ['Synthetic source verified', 'Viewing copy 64% complete', 'Source is read-only'],
  },
  {
    id: 'job-failed-demo',
    displayName: 'Synthetic unavailable source',
    sourceReference: 'Synthetic demo source FILE-02',
    sourceKind: 'file',
    status: 'failed',
    progress: 37,
    filesFound: 1,
    sourceSizeBytes: 1_402_000_000,
    outputSizeBytes: 0,
    detectedAt: '2026-08-16T18:22:00.000Z',
    updatedAt: '2026-08-16T18:29:00.000Z',
    preset: 'Synthetic SD placeholder - H.264',
    etaMinutes: null,
    error: 'Synthetic source bytes are intentionally unavailable in this prototype.',
    duplicateOf: null,
    requiresHydration: true,
    candidates: [],
    log: ['Catalogue placeholder detected', 'Source bytes unavailable by design'],
  },
  {
    id: 'job-ready-demo',
    displayName: 'Synthetic prepared viewing copy',
    sourceReference: 'Synthetic demo source FILE-03',
    sourceKind: 'file',
    status: 'ready',
    progress: 100,
    filesFound: 1,
    sourceSizeBytes: 2_116_000_000,
    outputSizeBytes: 704_000_000,
    detectedAt: '2026-08-16T14:16:00.000Z',
    updatedAt: '2026-08-16T14:44:00.000Z',
    preset: 'Synthetic Full HD placeholder',
    etaMinutes: null,
    error: null,
    duplicateOf: null,
    requiresHydration: false,
    candidates: [],
    log: ['Conversion verified', 'Thumbnail candidates generated', 'Ready for demo upload job'],
  },
  {
    id: 'job-uploaded-demo',
    displayName: 'Synthetic uploaded viewing copy',
    sourceReference: 'Synthetic demo source FILE-04',
    sourceKind: 'file',
    status: 'uploaded',
    progress: 100,
    filesFound: 1,
    sourceSizeBytes: 3_290_000_000,
    outputSizeBytes: 1_204_000_000,
    detectedAt: '2026-08-14T11:03:00.000Z',
    updatedAt: '2026-08-14T12:22:00.000Z',
    preset: 'Synthetic Full HD placeholder',
    etaMinutes: null,
    error: null,
    duplicateOf: null,
    requiresHydration: false,
    candidates: [],
    log: ['Upload job completed in demo mode', 'Synthetic provider mapping stored locally'],
  },
  {
    id: 'job-duplicate-demo',
    displayName: 'Synthetic duplicate placeholder',
    sourceReference: 'Synthetic demo source DUPLICATE-01',
    sourceKind: 'file',
    status: 'review',
    progress: 100,
    filesFound: 1,
    sourceSizeBytes: 1_544_000_000,
    outputSizeBytes: 0,
    detectedAt: '2026-08-17T07:15:00.000Z',
    updatedAt: '2026-08-17T07:16:00.000Z',
    preset: 'Automatic',
    etaMinutes: null,
    error: null,
    duplicateOf: 'video-01',
    requiresHydration: false,
    candidates: [],
    log: ['Synthetic fingerprint matches another fictional record', 'Awaiting review'],
  },
];

export const demoDevices: DeviceRecord[] = [
  {
    id: 'device-tv-demo',
    name: 'Demo Apple TV',
    platform: 'Apple TV',
    state: 'approved',
    pairingCode: null,
    codeExpiresAt: null,
    approvedAt: '2026-08-12T19:20:00.000Z',
    lastSeen: '2026-08-17T08:51:00.000Z',
    profile: 'Bart & Astrid',
  },
  {
    id: 'device-desktop-demo',
    name: 'Demo Windows preview',
    platform: 'Windows',
    state: 'approved',
    pairingCode: null,
    codeExpiresAt: null,
    approvedAt: '2026-08-15T17:08:00.000Z',
    lastSeen: '2026-08-17T09:04:00.000Z',
    profile: 'Bram & Edvin',
  },
  {
    id: 'device-mobile-demo',
    name: 'Demo iPhone preview',
    platform: 'iPhone',
    state: 'pending',
    pairingCode: 'DEMO-01',
    codeExpiresAt: '2026-08-17T10:30:00.000Z',
    approvedAt: null,
    lastSeen: '2026-08-17T10:20:00.000Z',
    profile: 'Eline & Luca',
  },
  {
    id: 'device-browser-demo',
    name: 'Demo browser preview',
    platform: 'Web preview',
    state: 'revoked',
    pairingCode: null,
    codeExpiresAt: null,
    approvedAt: '2026-07-21T11:00:00.000Z',
    lastSeen: '2026-07-22T09:32:00.000Z',
    profile: 'Bart & Astrid',
  },
];

export const demoRails: HomeRail[] = [
  {
    id: 'continue',
    title: 'Continue Watching',
    rule: 'Partially watched synthetic placeholders, newest activity first',
    visible: true,
    itemCount: 6,
  },
  {
    id: 'jeugdfilms',
    title: 'JEUGDFILMS',
    rule: 'Top-level structural category',
    visible: true,
    itemCount: 3,
  },
  {
    id: 'vakantiefilms',
    title: 'VAKANTIEFILMS',
    rule: 'Top-level structural category',
    visible: true,
    itemCount: 17,
  },
  {
    id: 'events',
    title: 'EVENTS',
    rule: 'Top-level structural category',
    visible: true,
    itemCount: 8,
  },
  {
    id: 'overige',
    title: 'OVERIGE',
    rule: 'Top-level structural category',
    visible: true,
    itemCount: 7,
  },
  {
    id: 'recent-demo',
    title: 'Recently Prepared',
    rule: 'Ready or published, newest fictional activity first',
    visible: true,
    itemCount: 9,
  },
  {
    id: 'featured',
    title: 'Synthetic Screening Shelf',
    rule: 'Featured fictional catalogue placeholders',
    visible: true,
    itemCount: 4,
  },
];

export const demoSettings: AdminSettings = {
  libraryLabel: 'LELIBRAMBAS+ Private Archive',
  outputFolder: '.\\synthetic-library-output',
  concurrency: 1,
  autoGenerateArtwork: true,
  preserveFrameRate: true,
  deinterlaceWhenDetected: true,
  defaultVisibility: 'family',
  cloudMode: 'demo',
};

export function createDemoSnapshot(): LibrarySnapshot {
  return {
    schemaVersion: 1,
    videos: structuredClone(demoVideos),
    jobs: structuredClone(demoJobs),
    devices: structuredClone(demoDevices),
    rails: structuredClone(demoRails),
    settings: structuredClone(demoSettings),
  };
}
