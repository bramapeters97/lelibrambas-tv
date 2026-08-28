import { useCallback, useEffect, useRef } from 'react';
import { useEvent, useEventListener } from 'expo';
import {
  Pressable,
  StyleSheet,
  Text,
  TVFocusGuideView,
  View,
  useTVEventHandler,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { CatalogueVideoRecord } from '@lelibrambas/catalog';
import { SEEK_INTERVAL_SECONDS, clampSeek } from '@lelibrambas/shared';
import type { Profile } from '@lelibrambas/types';
import { resolveNativePlaybackSource } from '../src/media';
import { writeNativePlaybackProgress } from './progressStorage';
import { createPlaybackProgress } from './state';

const PROGRESS_WRITE_INTERVAL_SECONDS = 5;

interface PlayerScreenProps {
  profile: Profile;
  video: CatalogueVideoRecord;
  startSeconds: number;
  onExit: () => void;
  onProgressSaved: () => void;
}

export function PlayerScreen(props: PlayerScreenProps) {
  const source = resolveNativePlaybackSource(props.video.streamVideoId);
  if (!source.url) {
    return (
      <View style={styles.errorRoot}>
        <Text style={styles.errorTitle}>This movie cannot be played</Text>
        <Text style={styles.errorCopy}>
          The bundled catalogue does not contain a tvOS-compatible source.
        </Text>
        <Pressable
          accessibilityLabel="Return to movie details"
          accessibilityRole="button"
          hasTVPreferredFocus
          onPress={props.onExit}
          style={({ focused }) => [styles.controlButton, focused && styles.focusedControl]}
        >
          <Text style={styles.controlText}>‹ Back</Text>
        </Pressable>
      </View>
    );
  }

  return <PlayablePlayerScreen {...props} sourceUrl={source.url} />;
}

function PlayablePlayerScreen({
  profile,
  video,
  startSeconds,
  onExit,
  onProgressSaved,
  sourceUrl,
}: PlayerScreenProps & { sourceUrl: string }) {
  const durationRef = useRef(video.durationSeconds ?? 1);
  const currentTimeRef = useRef(0);
  const startedRef = useRef(false);
  const exitingRef = useRef(false);
  const lastWrittenSecondRef = useRef(-PROGRESS_WRITE_INTERVAL_SECONDS);
  const player = useVideoPlayer(sourceUrl, (instance) => {
    instance.loop = false;
    instance.timeUpdateEventInterval = PROGRESS_WRITE_INTERVAL_SECONDS;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  const persist = useCallback(
    (forceCompleted = false) => {
      const seconds = currentTimeRef.current;
      const duration = durationRef.current;
      if (!forceCompleted && (!Number.isFinite(seconds) || seconds <= 0)) return;
      lastWrittenSecondRef.current = Math.floor(seconds);
      void writeNativePlaybackProgress(
        createPlaybackProgress(profile.id, video.id, seconds, duration, new Date(), forceCompleted),
      ).then(onProgressSaved);
    },
    [onProgressSaved, profile.id, video.id],
  );

  const exitPlayer = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    currentTimeRef.current = player.currentTime;
    durationRef.current = player.duration > 0 ? player.duration : durationRef.current;
    persist();
    player.pause();
    onExit();
  }, [onExit, persist, player]);

  const beginPlayback = useCallback(
    (loadedDuration: number) => {
      if (startedRef.current) return;
      const safeDuration =
        Number.isFinite(loadedDuration) && loadedDuration > 0
          ? loadedDuration
          : durationRef.current;
      durationRef.current = safeDuration;
      const target = clampSeek(0, startSeconds, safeDuration);
      currentTimeRef.current = target;
      player.currentTime = target;
      startedRef.current = true;
      player.play();
    },
    [player, startSeconds],
  );

  useEventListener(player, 'sourceLoad', ({ duration }) => beginPlayback(duration));

  useEffect(() => {
    if (status === 'readyToPlay') beginPlayback(player.duration);
  }, [beginPlayback, player.duration, status]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    currentTimeRef.current = currentTime;
    const wholeSecond = Math.floor(currentTime);
    if (wholeSecond - lastWrittenSecondRef.current >= PROGRESS_WRITE_INTERVAL_SECONDS) {
      persist();
    }
  });

  useEventListener(player, 'playingChange', ({ isPlaying: nowPlaying, oldIsPlaying }) => {
    if (startedRef.current && oldIsPlaying && !nowPlaying && !exitingRef.current) {
      currentTimeRef.current = player.currentTime;
      persist();
    }
  });

  useEventListener(player, 'playToEnd', () => {
    const duration = player.duration > 0 ? player.duration : durationRef.current;
    durationRef.current = duration;
    currentTimeRef.current = duration;
    persist(true);
  });

  useEffect(
    () => () => {
      if (!exitingRef.current) persist();
    },
    [persist],
  );

  useTVEventHandler(
    useCallback(
      (event: { eventType?: string }) => {
        if (event.eventType === 'menu') exitPlayer();
        if (event.eventType === 'playPause') {
          if (player.playing) player.pause();
          else player.play();
        }
      },
      [exitPlayer, player],
    ),
  );

  const seek = (deltaSeconds: number) => {
    player.seekBy(deltaSeconds);
    currentTimeRef.current = clampSeek(currentTimeRef.current, deltaSeconds, durationRef.current);
  };

  return (
    <View style={styles.playerRoot}>
      <VideoView contentFit="contain" nativeControls={false} player={player} style={styles.video} />
      <TVFocusGuideView autoFocus style={styles.controls} trapFocusLeft trapFocusRight>
        <Pressable
          accessibilityLabel="Skip back 10 seconds"
          accessibilityRole="button"
          onPress={() => seek(-SEEK_INTERVAL_SECONDS)}
          style={({ focused }) => [styles.controlButton, focused && styles.focusedControl]}
        >
          <Text style={styles.controlText}>↶ 10</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          accessibilityRole="button"
          hasTVPreferredFocus
          onPress={() => (isPlaying ? player.pause() : player.play())}
          style={({ focused }) => [styles.controlButton, focused && styles.focusedControl]}
        >
          <Text style={styles.controlText}>{isPlaying ? 'Pause' : 'Play'}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Skip forward 10 seconds"
          accessibilityRole="button"
          onPress={() => seek(SEEK_INTERVAL_SECONDS)}
          style={({ focused }) => [styles.controlButton, focused && styles.focusedControl]}
        >
          <Text style={styles.controlText}>↷ 10</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.playerTitle}>
          {video.title}
        </Text>
      </TVFocusGuideView>
    </View>
  );
}

const styles = StyleSheet.create({
  playerRoot: { flex: 1, backgroundColor: '#000000' },
  video: { flex: 1 },
  controls: {
    position: 'absolute',
    left: 70,
    right: 70,
    bottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  controlButton: {
    minWidth: 142,
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    borderWidth: 4,
    borderColor: 'transparent',
    borderRadius: 12,
    backgroundColor: 'rgba(247, 249, 254, 0.94)',
  },
  focusedControl: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.045 }],
    shadowColor: '#70D8FF',
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  controlText: { color: '#070D1B', fontSize: 23, fontWeight: '800' },
  playerTitle: { flex: 1, color: '#D9E0EB', fontSize: 20, fontWeight: '600' },
  errorRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#03050B',
  },
  errorTitle: { color: '#FFFFFF', fontSize: 44, fontWeight: '800' },
  errorCopy: { marginTop: 14, marginBottom: 28, color: '#B9C5D8', fontSize: 21 },
});
