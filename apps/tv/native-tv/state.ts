import { canResume, clampSeek, shouldMarkComplete } from '@lelibrambas/shared';
import type { PlaybackProgress } from '@lelibrambas/types';

export const SPLASH_BACKGROUND_DELAY_MS = 1000;
export const SPLASH_LOGO_ANIMATION_MS = 2200;
export const SPLASH_FINAL_HOLD_MS = 3000;
export const SPLASH_TOTAL_DURATION_MS =
  SPLASH_BACKGROUND_DELAY_MS + SPLASH_LOGO_ANIMATION_MS + SPLASH_FINAL_HOLD_MS;

export type SplashPhase = 'background' | 'logo' | 'hold' | 'done';

export function splashPhaseAt(elapsedMs: number): SplashPhase {
  const elapsed = Math.max(0, elapsedMs);
  if (elapsed < SPLASH_BACKGROUND_DELAY_MS) return 'background';
  if (elapsed < SPLASH_BACKGROUND_DELAY_MS + SPLASH_LOGO_ANIMATION_MS) return 'logo';
  if (elapsed < SPLASH_TOTAL_DURATION_MS) return 'hold';
  return 'done';
}

export function formatPlaybackTimestamp(seconds: number): string {
  const totalSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function emptyPlaybackProgress(
  profileId: string,
  videoId: string,
  durationSeconds = 1,
): PlaybackProgress {
  return {
    profileId,
    videoId,
    seconds: 0,
    durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 1,
    updatedAt: new Date(0).toISOString(),
    completed: false,
  };
}

export function normalizePlaybackProgress(
  value: unknown,
  profileId: string,
  videoId: string,
  fallbackDurationSeconds = 1,
): PlaybackProgress {
  const fallback = emptyPlaybackProgress(profileId, videoId, fallbackDurationSeconds);
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<PlaybackProgress>;
  if (candidate.profileId !== profileId || candidate.videoId !== videoId) return fallback;

  const duration =
    typeof candidate.durationSeconds === 'number' &&
    Number.isFinite(candidate.durationSeconds) &&
    candidate.durationSeconds > 0
      ? candidate.durationSeconds
      : fallback.durationSeconds;
  const seconds =
    typeof candidate.seconds === 'number' && Number.isFinite(candidate.seconds)
      ? clampSeek(0, candidate.seconds, duration)
      : 0;
  const completed = Boolean(candidate.completed) || shouldMarkComplete(seconds, duration);

  return {
    profileId,
    videoId,
    seconds,
    durationSeconds: duration,
    updatedAt:
      typeof candidate.updatedAt === 'string' && Number.isFinite(Date.parse(candidate.updatedAt))
        ? candidate.updatedAt
        : fallback.updatedAt,
    completed,
  };
}

export function resumableSeconds(progress: PlaybackProgress | null | undefined): number {
  if (!progress || progress.completed) return 0;
  if (!Number.isFinite(progress.seconds) || !Number.isFinite(progress.durationSeconds)) return 0;
  const duration = progress.durationSeconds;
  if (duration <= 0) return 0;
  const seconds = clampSeek(0, progress.seconds, duration);
  return canResume(seconds, duration) ? seconds : 0;
}

export function createPlaybackProgress(
  profileId: string,
  videoId: string,
  seconds: number,
  durationSeconds: number,
  now = new Date(),
  forceCompleted = false,
): PlaybackProgress {
  const duration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 1;
  const safeSeconds = clampSeek(0, Number.isFinite(seconds) ? seconds : 0, duration);
  return {
    profileId,
    videoId,
    seconds: safeSeconds,
    durationSeconds: duration,
    updatedAt: now.toISOString(),
    completed: forceCompleted || shouldMarkComplete(safeSeconds, duration),
  };
}

export function restartPlaybackProgress(
  progress: PlaybackProgress,
  now = new Date(),
): PlaybackProgress {
  return {
    ...progress,
    seconds: 0,
    completed: false,
    updatedAt: now.toISOString(),
  };
}

export function allMoviesForHome<
  T extends { id: string; visibility?: string; catalogueId?: number },
>(records: readonly T[]): T[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (record.visibility === 'hidden' || seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

export const NATIVE_COLLECTIONS_LABEL = 'Collections';
