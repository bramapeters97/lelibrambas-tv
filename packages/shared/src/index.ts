import type { PlaybackProgress } from '@lelibrambas/types';

const prefix = 'lelibrambas-plus:';

export function getStored<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(`${prefix}${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function setStored<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
}

export function progressKey(profileId: string, videoId: string): string {
  return `progress:${profileId}:${videoId}`;
}

export function readProgress(
  profileId: string,
  videoId: string,
  durationSeconds: number,
): PlaybackProgress {
  return getStored<PlaybackProgress>(progressKey(profileId, videoId), {
    profileId,
    videoId,
    seconds: 0,
    durationSeconds,
    updatedAt: new Date(0).toISOString(),
    completed: false,
  });
}

export function writeProgress(progress: PlaybackProgress): void {
  setStored(progressKey(progress.profileId, progress.videoId), progress);
}

export function debounce<T extends (...args: Parameters<T>) => void>(fn: T, waitMs: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  }) as T;
}

export function clampSeek(
  currentSeconds: number,
  deltaSeconds: number,
  durationSeconds: number,
): number {
  return Math.max(0, Math.min(durationSeconds, currentSeconds + deltaSeconds));
}

export function shouldMarkComplete(currentSeconds: number, durationSeconds: number): boolean {
  return durationSeconds > 0 && currentSeconds / durationSeconds >= 0.94;
}

export function canResume(seconds: number, durationSeconds: number): boolean {
  return seconds >= 5 && !shouldMarkComplete(seconds, durationSeconds);
}

export function createPairingCode(seed: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = Math.abs(Math.trunc(seed)) || 1;
  return Array.from({ length: 6 }, () => {
    value = (value * 48271) % 2147483647;
    return alphabet[value % alphabet.length];
  }).join('');
}

export function isExpired(expiresAt: string, now = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function tokenNeedsRefresh(
  expiresAt: string,
  now = new Date(),
  thresholdSeconds = 60,
): boolean {
  return new Date(expiresAt).getTime() - now.getTime() <= thresholdSeconds * 1000;
}
