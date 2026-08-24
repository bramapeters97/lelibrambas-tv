import type { Dir } from 'node:fs';
import { access, opendir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fingerprintFile } from './fingerprint.js';
import { FfprobeProber, EMPTY_PROBE } from './probe.js';
import { inspectVideoTs, isVideoTsDirectory } from './video-ts.js';
import type {
  ImportManifestEntry,
  ScanLogger,
  TechnicalProber,
  TechnicalProbeResult,
} from './types.js';

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.m4v',
  '.mov',
  '.avi',
  '.mkv',
  '.mpg',
  '.mpeg',
  '.m2ts',
  '.mts',
  '.vob',
]);

export interface ScanOptions {
  readonly sourceRoot: string;
  readonly prober?: TechnicalProber;
  readonly logger?: ScanLogger;
  readonly signal?: AbortSignal;
  readonly minimumAdditionalDvdTitleBytes?: number;
  readonly hydrationDetector?: (filePath: string, size: number) => Promise<boolean>;
  readonly openDirectory?: (directoryPath: string) => Promise<Dir>;
}

function inferredTitle(filePath: string): string {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[_-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

function inferredDate(filePath: string): string | null {
  const match =
    /(?:^|\D)((?:19|20)\d{2})[-_. ]?(0[1-9]|1[0-2])[-_. ]?(0[1-9]|[12]\d|3[01])(?:\D|$)/u.exec(
      filePath,
    );
  return match === null ? null : `${match[1]}-${match[2]}-${match[3]}`;
}

function ratio(width: number | null, height: number | null): string | null {
  if (width === null || height === null) return null;
  const divisor = (left: number, right: number): number =>
    right === 0 ? left : divisor(right, left % right);
  const common = divisor(width, height);
  return `${width / common}:${height / common}`;
}

async function defaultHydrationDetector(filePath: string, size: number): Promise<boolean> {
  try {
    await access(filePath);
  } catch {
    return true;
  }
  return size === 0 && filePath.toLocaleLowerCase().includes(`${path.sep}onedrive${path.sep}`);
}

function withProbe(
  base: Omit<ImportManifestEntry, keyof TechnicalProbeResult | 'aspectRatio'>,
  probe: TechnicalProbeResult,
): ImportManifestEntry {
  return {
    ...base,
    durationSeconds: probe.durationSeconds,
    width: probe.width,
    height: probe.height,
    aspectRatio: probe.aspectRatio ?? ratio(probe.width, probe.height),
    frameRate: probe.frameRate,
    interlaced: probe.interlaced,
    audioTracks: [...probe.audioTracks],
    subtitleTracks: [...probe.subtitleTracks],
    chapterCount: probe.chapterCount,
  };
}

async function* walk(
  directoryPath: string,
  signal: AbortSignal | undefined,
  openDirectory: (directoryPath: string) => Promise<Dir>,
  onError: (directoryPath: string, error: unknown) => void,
): AsyncGenerator<string> {
  signal?.throwIfAborted();
  let directory;
  try {
    directory = await openDirectory(directoryPath);
  } catch (error) {
    onError(directoryPath, error);
    return;
  }
  try {
    for await (const entry of directory) {
      signal?.throwIfAborted();
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        yield entryPath;
        yield* walk(entryPath, signal, openDirectory, onError);
      } else if (entry.isFile()) {
        yield entryPath;
      }
    }
  } catch (error) {
    signal?.throwIfAborted();
    onError(directoryPath, error);
  }
}

function markDuplicates(entries: readonly ImportManifestEntry[]): readonly ImportManifestEntry[] {
  const firstByFingerprint = new Map<string, ImportManifestEntry>();
  return entries.map((entry) => {
    const first = firstByFingerprint.get(entry.fingerprint);
    if (first === undefined) {
      firstByFingerprint.set(entry.fingerprint, entry);
      return entry;
    }
    return {
      ...entry,
      duplicateOf: first.id,
      conversionStatus: 'skipped',
      reviewNotes: [...entry.reviewNotes, `Possible duplicate of ${first.relativeSourcePath}.`],
    };
  });
}

export async function scanSource(options: ScanOptions): Promise<readonly ImportManifestEntry[]> {
  const sourceRoot = path.resolve(options.sourceRoot);
  const prober = options.prober ?? new FfprobeProber();
  const hydrationDetector = options.hydrationDetector ?? defaultHydrationDetector;
  const openDirectory =
    options.openDirectory ?? (async (directoryPath: string) => opendir(directoryPath));
  const results: ImportManifestEntry[] = [];
  const skippedDirectories = new Set<string>();

  const addVideoTsDirectory = async (candidatePath: string): Promise<void> => {
    const inspection = await inspectVideoTs(candidatePath, {
      ...(options.minimumAdditionalDvdTitleBytes === undefined
        ? {}
        : { minimumAdditionalTitleBytes: options.minimumAdditionalDvdTitleBytes }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    for (const title of inspection.titles) {
      const sourceLabel = `${path.basename(path.dirname(candidatePath))} Title ${title.titleNumber}`;
      results.push(
        withProbe(
          {
            id: `dvd-${title.fingerprint.slice(0, 16)}`,
            sourcePath: candidatePath,
            relativeSourcePath: path.relative(sourceRoot, candidatePath) || '.',
            sourceType: title.discovery === 'handbrake' ? 'dvd-title' : 'video-ts',
            fingerprint: title.fingerprint,
            fileSizeBytes: title.totalBytes,
            dvdTitleNumber: title.titleNumber,
            inferredTitle: sourceLabel,
            inferredDate: inferredDate(candidatePath),
            confidence: title.discovery === 'handbrake' ? 0.8 : 0.55,
            proposedCollection: path.basename(path.dirname(candidatePath)),
            reviewNotes: [
              title.isLikelyMainTitle
                ? 'Likely main DVD title.'
                : 'Additional meaningful DVD title.',
              title.discovery === 'fallback'
                ? 'HandBrakeCLI unavailable or title mapping ambiguous; sequential VOB fallback requires review.'
                : 'DVD title enumerated with HandBrakeCLI.',
            ],
            conversionStatus: 'pending',
            outputPath: null,
            outputChecksum: null,
            uploadStatus: 'not-requested',
            providerAssetId: null,
            error: null,
            requiresHydration: false,
            duplicateOf: null,
            legacyFormat: 'VIDEO_TS',
            technicalProbe: title.discovery,
          },
          {
            ...EMPTY_PROBE,
            durationSeconds: title.durationSeconds,
            chapterCount: title.chapterCount,
          },
        ),
      );
    }
  };

  let rootIsVideoTs = false;
  try {
    rootIsVideoTs = await isVideoTsDirectory(sourceRoot);
  } catch (error) {
    options.logger?.({
      level: 'warning',
      code: 'DIRECTORY_READ_FAILED',
      path: sourceRoot,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  if (rootIsVideoTs) {
    await addVideoTsDirectory(sourceRoot);
    return markDuplicates(results);
  }

  for await (const candidatePath of walk(
    sourceRoot,
    options.signal,
    openDirectory,
    (directoryPath, error) => {
      options.logger?.({
        level: 'warning',
        code: 'DIRECTORY_READ_FAILED',
        path: directoryPath,
        message: error instanceof Error ? error.message : String(error),
      });
    },
  )) {
    if (
      [...skippedDirectories].some((directory) =>
        candidatePath.startsWith(`${directory}${path.sep}`),
      )
    )
      continue;
    let candidateStat;
    try {
      candidateStat = await stat(candidatePath);
    } catch (error) {
      options.logger?.({
        level: 'warning',
        code: 'FILE_STAT_FAILED',
        path: candidatePath,
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    if (candidateStat.isDirectory()) {
      let dvd = false;
      try {
        dvd = await isVideoTsDirectory(candidatePath);
      } catch (error) {
        options.logger?.({
          level: 'warning',
          code: 'DIRECTORY_READ_FAILED',
          path: candidatePath,
          message: String(error),
        });
      }
      if (!dvd) continue;
      skippedDirectories.add(candidatePath);
      await addVideoTsDirectory(candidatePath);
      continue;
    }

    if (!VIDEO_EXTENSIONS.has(path.extname(candidatePath).toLocaleLowerCase())) continue;
    const requiresHydration = await hydrationDetector(candidatePath, candidateStat.size);
    let fingerprint: string;
    try {
      fingerprint = requiresHydration
        ? `unhydrated:${candidateStat.size}:${path.relative(sourceRoot, candidatePath).toLocaleLowerCase()}`
        : await fingerprintFile(candidatePath);
    } catch (error) {
      options.logger?.({
        level: 'warning',
        code: 'FINGERPRINT_FAILED',
        path: candidatePath,
        message: String(error),
      });
      fingerprint = `unreadable:${candidateStat.size}:${path.relative(sourceRoot, candidatePath).toLocaleLowerCase()}`;
    }
    let probe = EMPTY_PROBE;
    let technicalProbe: ImportManifestEntry['technicalProbe'] = 'unavailable';
    const reviewNotes: string[] = [];
    if (requiresHydration) {
      reviewNotes.push(
        'OneDrive or filesystem placeholder requires local hydration before conversion.',
      );
    } else {
      try {
        probe = await prober.probe(candidatePath, options.signal);
        technicalProbe = 'ffprobe';
      } catch (error) {
        reviewNotes.push(
          `Technical probe unavailable: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    results.push(
      withProbe(
        {
          id: `video-${fingerprint.slice(0, 16).replace(/[^a-z0-9]/giu, '-')}`,
          sourcePath: candidatePath,
          relativeSourcePath: path.relative(sourceRoot, candidatePath),
          sourceType: 'regular-video',
          fingerprint,
          fileSizeBytes: candidateStat.size,
          dvdTitleNumber: null,
          inferredTitle: inferredTitle(candidatePath),
          inferredDate: inferredDate(candidatePath),
          confidence: inferredDate(candidatePath) === null ? 0.45 : 0.7,
          proposedCollection:
            path.relative(sourceRoot, path.dirname(candidatePath)).split(path.sep)[0] || null,
          reviewNotes,
          conversionStatus: requiresHydration ? 'skipped' : 'pending',
          outputPath: null,
          outputChecksum: null,
          uploadStatus: 'not-requested',
          providerAssetId: null,
          error: requiresHydration ? 'Source file is not locally hydrated.' : null,
          requiresHydration,
          duplicateOf: null,
          legacyFormat: path.extname(candidatePath).slice(1).toLocaleUpperCase(),
          technicalProbe,
        },
        probe,
      ),
    );
  }

  return markDuplicates(results);
}

export const SUPPORTED_VIDEO_EXTENSIONS = Object.freeze([...VIDEO_EXTENSIONS]);
