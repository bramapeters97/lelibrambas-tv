export type AppView =
  | 'dashboard'
  | 'review'
  | 'queue'
  | 'video-ts'
  | 'catalogue'
  | 'collections'
  | 'rails'
  | 'devices'
  | 'settings';

export type ProcessingStatus =
  | 'awaiting-review'
  | 'queued'
  | 'processing'
  | 'failed'
  | 'ready-to-upload'
  | 'uploaded'
  | 'unavailable';

export type SourceType =
  | 'modern-video'
  | 'dvd-video-ts'
  | 'camcorder'
  | 'mobile'
  | 'generated-demo';

export type PublishState = 'draft' | 'ready' | 'published' | 'hidden';
export type ArtworkStatus = 'complete' | 'missing-poster' | 'missing-backdrop' | 'generated';
export type PlaybackProvider = 'mock' | 'local' | 'cloudflare-stream';

export interface ChapterMarker {
  id: string;
  title: string;
  timeSeconds: number;
}

export interface VideoRecord {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  originalFilename: string;
  sourceType: SourceType;
  sourceReference: string;
  recordingDate: string | null;
  approximateDate: boolean;
  year: number | null;
  durationSeconds: number;
  aspectRatio: '4:3' | '16:9' | '9:16';
  resolution: string;
  frameRate: number;
  interlaced: boolean;
  people: string[];
  place: string;
  country: string;
  tags: string[];
  categories: string[];
  collection: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  previewStartSeconds: number;
  featured: boolean;
  visibility: 'family' | 'selected-profiles' | 'hidden';
  processingStatus: ProcessingStatus;
  playbackProvider: PlaybackProvider;
  playbackAssetId: string | null;
  progress: number;
  lastWatched: string | null;
  addedDate: string;
  restorationNotes: string;
  legacyFormat: string | null;
  chapters: ChapterMarker[];
  publishState: PublishState;
  artworkStatus: ArtworkStatus;
  sourceSizeBytes: number;
  checksum: string;
  palette: [string, string];
}

export type ImportJobStatus = 'review' | 'queued' | 'processing' | 'failed' | 'ready' | 'uploaded';

export interface DvdCandidate {
  id: string;
  titleNumber: number;
  label: string;
  durationSeconds: number;
  chapters: number;
  resolution: string;
  frameRate: number;
  aspectRatio: '4:3' | '16:9';
  interlaced: boolean;
  confidence: number;
  selected: boolean;
  role: 'main-title' | 'extra' | 'menu-loop';
}

export interface ImportJob {
  id: string;
  displayName: string;
  sourceReference: string;
  sourceKind: 'file' | 'folder' | 'video-ts';
  status: ImportJobStatus;
  progress: number;
  filesFound: number;
  sourceSizeBytes: number;
  outputSizeBytes: number;
  detectedAt: string;
  updatedAt: string;
  preset: string;
  etaMinutes: number | null;
  error: string | null;
  duplicateOf: string | null;
  requiresHydration: boolean;
  candidates: DvdCandidate[];
  log: string[];
}

export interface DeviceRecord {
  id: string;
  name: string;
  platform: 'Apple TV' | 'iPhone' | 'Windows' | 'Desktop Web' | 'Web preview';
  state: 'approved' | 'pending' | 'revoked';
  pairingCode: string | null;
  codeExpiresAt: string | null;
  approvedAt: string | null;
  lastSeen: string | null;
  profile: string;
}

export interface HomeRail {
  id: string;
  title: string;
  rule: string;
  visible: boolean;
  itemCount: number;
}

export interface AdminSettings {
  libraryLabel: string;
  outputFolder: string;
  concurrency: number;
  autoGenerateArtwork: boolean;
  preserveFrameRate: boolean;
  deinterlaceWhenDetected: boolean;
  defaultVisibility: 'family' | 'selected-profiles';
  cloudMode: 'demo' | 'configured';
}

export interface LibrarySnapshot {
  schemaVersion: 1;
  videos: VideoRecord[];
  jobs: ImportJob[];
  devices: DeviceRecord[];
  rails: HomeRail[];
  settings: AdminSettings;
}

export type QueueFilter = 'all' | ImportJobStatus;
export type CatalogueFilter =
  | 'all'
  | 'missing-metadata'
  | 'missing-artwork'
  | 'duplicates'
  | 'drafts';
