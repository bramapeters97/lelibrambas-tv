import { z } from 'zod';

export const processingStatuses = ['ready', 'processing', 'failed', 'unavailable'] as const;
export const sourceTypes = [
  'mp4',
  'mov',
  'avi',
  'mkv',
  'mpeg',
  'm2ts',
  'vob',
  'video_ts',
  'synthetic',
] as const;
export const playbackProviders = ['mock', 'local', 'cloudflare-stream'] as const;

export const chapterSchema = z.object({
  title: z.string().min(1),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
});

export const artworkSchema = z.object({
  thumbnail: z.string(),
  landscape: z.string(),
  portrait: z.string(),
  backdrop: z.string(),
  palette: z.tuple([z.string(), z.string(), z.string()]),
});

export const videoRecordSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  subtitle: z.string(),
  description: z.string().min(1),
  originalFilename: z.string().min(1),
  sourceType: z.enum(sourceTypes),
  sourcePath: z.string().optional(),
  recordingDate: z.string().nullable(),
  dateApproximate: z.boolean(),
  year: z.number().int().min(1900).max(2100).nullable(),
  durationSeconds: z.number().positive(),
  aspectRatio: z.enum(['4:3', '16:9', '2.35:1', 'unknown']),
  resolution: z.string(),
  frameRate: z.number().positive(),
  interlaced: z.boolean(),
  people: z.array(z.string()),
  location: z.string().nullable(),
  country: z.string().nullable(),
  tags: z.array(z.string()),
  categories: z.array(z.string()),
  collectionId: z.string().nullable(),
  seasonNumber: z.number().int().positive().nullable(),
  episodeNumber: z.number().int().positive().nullable(),
  artwork: artworkSchema,
  previewStartSeconds: z.number().nonnegative(),
  featured: z.boolean(),
  visibility: z.enum(['private', 'family', 'hidden']),
  processingStatus: z.enum(processingStatuses),
  playbackProvider: z.enum(playbackProviders),
  playbackAssetId: z.string().nullable(),
  playbackUrl: z.string().nullable(),
  progressSeconds: z.number().nonnegative(),
  lastWatched: z.string().nullable(),
  addedDate: z.string(),
  restorationNotes: z.string().nullable(),
  legacyFormat: z.string().nullable(),
  chapterMarkers: z.array(chapterSchema),
  playCount: z.number().int().nonnegative(),
});

export type VideoRecord = z.infer<typeof videoRecordSchema>;
export type ProcessingStatus = (typeof processingStatuses)[number];
export type SourceType = (typeof sourceTypes)[number];

export interface Profile {
  id: string;
  name: string;
  initials: string;
  accent: string;
  pin?: string;
  watchlist: string[];
  recentlyDiscovered: string[];
}

export interface Person {
  id: string;
  name: string;
  initials: string;
  description?: string;
  accent: string;
}

export interface Place {
  id: string;
  name: string;
  country: string;
  description: string;
  palette: [string, string, string];
}

export interface Collection {
  id: string;
  title: string;
  kind: 'series' | 'trip' | 'holiday' | 'year' | 'person' | 'restoration' | 'curated';
  description: string;
  videoIds: string[];
}

export interface HomeRail {
  id: string;
  title: string;
  videoIds: string[];
  visible: boolean;
  order: number;
}

export interface Device {
  id: string;
  name: string;
  platform: 'tvos' | 'windows' | 'web';
  status: 'pending' | 'approved' | 'denied' | 'revoked' | 'expired';
  pairingCode: string;
  expiresAt: string;
  approvedAt: string | null;
  lastSeenAt: string | null;
}

export interface PlaybackProgress {
  videoId: string;
  profileId: string;
  seconds: number;
  durationSeconds: number;
  updatedAt: string;
  completed: boolean;
}

export function validateCatalogue(input: unknown): VideoRecord[] {
  return z.array(videoRecordSchema).parse(input);
}
