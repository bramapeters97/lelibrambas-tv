import { z } from 'zod';

export const SourceTypeSchema = z.enum(['regular-video', 'video-ts', 'dvd-title']);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const ConversionStatusSchema = z.enum([
  'pending',
  'planned',
  'running',
  'completed',
  'failed',
  'interrupted',
  'skipped',
]);
export type ConversionStatus = z.infer<typeof ConversionStatusSchema>;

export const UploadStatusSchema = z.enum([
  'not-requested',
  'ready',
  'uploading',
  'uploaded',
  'failed',
]);

export const TrackSchema = z.object({
  index: z.number().int().nonnegative(),
  codec: z.string(),
  language: z.string().nullable(),
  title: z.string().nullable(),
});

export const ImportManifestEntrySchema = z.object({
  id: z.string().min(1),
  sourcePath: z.string().min(1),
  relativeSourcePath: z.string().min(1),
  sourceType: SourceTypeSchema,
  fingerprint: z.string().min(1),
  fileSizeBytes: z.number().int().nonnegative(),
  durationSeconds: z.number().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  aspectRatio: z.string().nullable(),
  frameRate: z.number().positive().nullable(),
  interlaced: z.boolean().nullable(),
  audioTracks: z.array(TrackSchema),
  subtitleTracks: z.array(TrackSchema),
  dvdTitleNumber: z.number().int().positive().nullable(),
  chapterCount: z.number().int().nonnegative().nullable(),
  inferredTitle: z.string().min(1),
  inferredDate: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  proposedCollection: z.string().nullable(),
  reviewNotes: z.array(z.string()),
  conversionStatus: ConversionStatusSchema,
  outputPath: z.string().nullable(),
  outputChecksum: z.string().nullable(),
  uploadStatus: UploadStatusSchema,
  providerAssetId: z.string().nullable(),
  error: z.string().nullable(),
  requiresHydration: z.boolean(),
  duplicateOf: z.string().nullable(),
  legacyFormat: z.string().nullable(),
  technicalProbe: z.enum(['ffprobe', 'handbrake', 'fallback', 'unavailable']),
});
export type ImportManifestEntry = z.infer<typeof ImportManifestEntrySchema>;

export const ImportManifestSchema = z.object({
  schemaVersion: z.literal(1),
  createdAt: z.string().datetime(),
  sourceRoot: z.string().min(1),
  outputRoot: z.string().min(1),
  tools: z.object({
    importer: z.string(),
    ffprobe: z.string().nullable(),
    ffmpeg: z.string().nullable(),
    handBrakeCli: z.string().nullable(),
  }),
  entries: z.array(ImportManifestEntrySchema),
});
export type ImportManifest = z.infer<typeof ImportManifestSchema>;

export const JobEntryStateSchema = z.object({
  id: z.string(),
  status: ConversionStatusSchema,
  attempts: z.number().int().nonnegative(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  error: z.string().nullable(),
  outputPath: z.string().nullable(),
  outputChecksum: z.string().nullable(),
});
export type JobEntryState = z.infer<typeof JobEntryStateSchema>;

export const ImportJobStateSchema = z.object({
  schemaVersion: z.literal(1),
  jobId: z.string().min(1),
  manifestPath: z.string().min(1),
  outputRoot: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  interrupted: z.boolean(),
  entries: z.array(JobEntryStateSchema),
});
export type ImportJobState = z.infer<typeof ImportJobStateSchema>;

export interface TechnicalProbeResult {
  readonly durationSeconds: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly aspectRatio: string | null;
  readonly frameRate: number | null;
  readonly interlaced: boolean | null;
  readonly audioTracks: readonly z.infer<typeof TrackSchema>[];
  readonly subtitleTracks: readonly z.infer<typeof TrackSchema>[];
  readonly chapterCount: number | null;
}

export interface TechnicalProber {
  probe(filePath: string, signal?: AbortSignal): Promise<TechnicalProbeResult>;
  version(): Promise<string | null>;
}

export interface ScanLogEvent {
  readonly level: 'info' | 'warning' | 'error';
  readonly code: string;
  readonly path?: string;
  readonly message: string;
}

export type ScanLogger = (event: ScanLogEvent) => void;
