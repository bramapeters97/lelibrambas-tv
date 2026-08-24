import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TVFocusGuideView,
  View,
  useTVEventHandler,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { catalogue } from '@lelibrambas/catalog';
import MobileApp from './mobile/MobileApp';
import { resolveNativePlaybackSource } from './src/media';

function NativeTvApp() {
  const [screen, setScreen] = useState<'profile' | 'home' | 'player'>('profile');
  const featuredMovie = catalogue[0]!;
  const playback = resolveNativePlaybackSource(featuredMovie.streamVideoId);
  const player = useVideoPlayer(playback.url, (instance) => {
    instance.loop = false;
  });
  const onTvEvent = useCallback(
    (event: { eventType?: string }) => {
      if (event.eventType === 'menu') setScreen('home');
      if (screen === 'player' && event.eventType === 'playPause') {
        if (player.playing) player.pause();
        else player.play();
      }
    },
    [player, screen],
  );
  useTVEventHandler(onTvEvent);

  if (screen === 'profile') {
    return (
      <View style={styles.root}>
        <Text style={styles.eyebrow}>WHO IS WATCHING?</Text>
        <Text style={styles.logo}>
          LELIBRAMBAS<Text style={styles.plus}>+</Text>
        </Text>
        <TVFocusGuideView style={styles.row} autoFocus trapFocusLeft trapFocusRight>
          {['Bart & Astrid', 'Bram & Edvin', 'Eline & Luca'].map((name) => (
            <Pressable
              key={name}
              hasTVPreferredFocus={name === 'Bart & Astrid'}
              onPress={() => setScreen('home')}
              style={({ focused }) => [styles.profile, focused && styles.focused]}
            >
              <Text style={styles.avatar}>{name.slice(0, 1)}</Text>
              <Text style={styles.label}>{name}</Text>
            </Pressable>
          ))}
        </TVFocusGuideView>
      </View>
    );
  }
  if (screen === 'player') {
    return (
      <View style={styles.player}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
        />
        <View style={styles.controls}>
          <Pressable
            hasTVPreferredFocus
            onPress={() => (player.playing ? player.pause() : player.play())}
            style={({ focused }) => [styles.button, focused && styles.focused]}
          >
            <Text style={styles.buttonText}>{player.playing ? 'Pause' : 'Play'}</Text>
          </Pressable>
          <Text style={styles.meta}>
            Original aspect · {Platform.isTV ? 'TV remote ready' : Platform.OS}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>A LELIBRAMBAS STUDIOS™ PRESENTATION</Text>
      <Text style={styles.hero}>{featuredMovie.title}</Text>
      <Text style={styles.copy}>{featuredMovie.description}</Text>
      <TVFocusGuideView style={styles.row} autoFocus>
        <Pressable
          hasTVPreferredFocus
          onPress={() => setScreen('player')}
          style={({ focused }) => [styles.button, focused && styles.focused]}
        >
          <Text style={styles.buttonText}>▶ Play</Text>
        </Pressable>
      </TVFocusGuideView>
    </View>
  );
}

export default function NativeApp() {
  if (Platform.isTV) {
    // The native TV shell is available only for the configured Apple target.
    return Platform.OS === 'ios' ? <NativeTvApp /> : null;
  }
  return <MobileApp />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#03050B',
    paddingHorizontal: 88,
    paddingVertical: 70,
    justifyContent: 'center',
  },
  eyebrow: { color: '#E9C778', fontSize: 18, letterSpacing: 4, marginBottom: 18 },
  logo: { color: '#F7F9FE', fontSize: 64, fontWeight: '800', marginBottom: 70 },
  plus: { color: '#70D8FF' },
  hero: { color: '#F7F9FE', fontSize: 74, fontWeight: '800', maxWidth: 850 },
  copy: { color: '#C2CBDC', fontSize: 27, lineHeight: 38, maxWidth: 780, marginVertical: 30 },
  row: { flexDirection: 'row', gap: 34, alignItems: 'center' },
  profile: {
    width: 230,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111C33',
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  focused: {
    transform: [{ scale: 1.055 }],
    borderColor: '#FFFFFF',
    shadowColor: '#70D8FF',
    shadowOpacity: 0.4,
    shadowRadius: 18,
  },
  avatar: { color: '#F7F9FE', fontSize: 64, fontWeight: '700', marginBottom: 25 },
  label: { color: '#F7F9FE', fontSize: 27 },
  button: {
    backgroundColor: '#F7F9FE',
    paddingVertical: 18,
    paddingHorizontal: 34,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  buttonText: { color: '#070D1B', fontSize: 24, fontWeight: '700' },
  player: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
  controls: {
    position: 'absolute',
    left: 70,
    right: 70,
    bottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  meta: { color: '#C2CBDC', fontSize: 20 },
});
