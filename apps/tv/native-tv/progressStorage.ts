import AsyncStorage from '@react-native-async-storage/async-storage';
import { progressKey } from '@lelibrambas/shared';
import type { PlaybackProgress } from '@lelibrambas/types';
import { emptyPlaybackProgress, normalizePlaybackProgress } from './state';

const nativeStoragePrefix = 'lelibrambas-plus:native:';

export function nativeProgressStorageKey(profileId: string, videoId: string): string {
  return `${nativeStoragePrefix}${progressKey(profileId, videoId)}`;
}

export async function readNativePlaybackProgress(
  profileId: string,
  videoId: string,
  fallbackDurationSeconds = 1,
): Promise<PlaybackProgress> {
  const fallback = emptyPlaybackProgress(profileId, videoId, fallbackDurationSeconds);
  try {
    const raw = await AsyncStorage.getItem(nativeProgressStorageKey(profileId, videoId));
    return raw
      ? normalizePlaybackProgress(JSON.parse(raw), profileId, videoId, fallbackDurationSeconds)
      : fallback;
  } catch {
    return fallback;
  }
}

export async function writeNativePlaybackProgress(progress: PlaybackProgress): Promise<void> {
  try {
    await AsyncStorage.setItem(
      nativeProgressStorageKey(progress.profileId, progress.videoId),
      JSON.stringify(progress),
    );
  } catch {
    // Progress persistence should never prevent playback.
  }
}

export async function clearNativePlaybackProgress(
  profileId: string,
  videoId: string,
): Promise<void> {
  try {
    await AsyncStorage.removeItem(nativeProgressStorageKey(profileId, videoId));
  } catch {
    // A storage failure still allows Restart to begin from zero for this session.
  }
}
