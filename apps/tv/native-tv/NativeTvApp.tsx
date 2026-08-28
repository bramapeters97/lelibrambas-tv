import { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TVFocusGuideView,
  View,
  useTVEventHandler,
} from 'react-native';
import { profiles, type CatalogueVideoRecord } from '@lelibrambas/catalog';
import type { Profile } from '@lelibrambas/types';
import { BrowseSectionScreen, HomeScreen, MovieDetailScreen } from './MediaViews';
import { NATIVE_TV_RAIL_WIDTH, NavigationRail, type NativeBrowseSection } from './NavigationRail';
import { PlayerScreen } from './PlayerScreen';
import { SplashScreen } from './SplashScreen';

type NativeScreen = 'splash' | 'profiles' | 'browse' | 'details' | 'player';
type PlayerReturnScreen = 'browse' | 'details';

interface PlaybackLaunch {
  video: CatalogueVideoRecord;
  startSeconds: number;
  returnTo: PlayerReturnScreen;
}

function ProfileSelector({ onSelect }: { onSelect: (profile: Profile) => void }) {
  return (
    <View style={styles.profileRoot}>
      <Text style={styles.profileEyebrow}>WHO IS WATCHING?</Text>
      <Text style={styles.profileLogo}>
        LELIBRAMBAS<Text style={styles.profilePlus}>+</Text>
      </Text>
      <TVFocusGuideView autoFocus style={styles.profileRow} trapFocusLeft trapFocusRight>
        {profiles.map((profile, index) => (
          <Pressable
            accessibilityLabel={profile.name}
            accessibilityRole="button"
            hasTVPreferredFocus={index === 0}
            key={profile.id}
            onPress={() => onSelect(profile)}
            style={({ focused }) => [styles.profileCard, focused && styles.profileCardFocused]}
          >
            <View style={[styles.profileAvatar, { borderColor: profile.accent }]}>
              <Text style={styles.profileInitials}>{profile.initials}</Text>
            </View>
            <Text style={styles.profileName}>{profile.name}</Text>
          </Pressable>
        ))}
      </TVFocusGuideView>
    </View>
  );
}

export function NativeTvApp() {
  const [screen, setScreen] = useState<NativeScreen>('splash');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [browseSection, setBrowseSection] = useState<NativeBrowseSection>('home');
  const [selectedVideo, setSelectedVideo] = useState<CatalogueVideoRecord | null>(null);
  const [playback, setPlayback] = useState<PlaybackLaunch | null>(null);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);

  const showDetails = useCallback((video: CatalogueVideoRecord) => {
    setSelectedVideo(video);
    setScreen('details');
  }, []);

  const startPlayback = useCallback(
    (video: CatalogueVideoRecord, startSeconds: number, returnTo: PlayerReturnScreen) => {
      setPlayback({ video, startSeconds, returnTo });
      setScreen('player');
    },
    [],
  );

  const finishSplash = useCallback(() => setScreen('profiles'), []);
  const refreshDetails = useCallback(() => setDetailRefreshKey((current) => current + 1), []);

  const leavePlayer = useCallback(() => {
    const returnTo = playback?.returnTo ?? 'browse';
    setDetailRefreshKey((current) => current + 1);
    setPlayback(null);
    setScreen(returnTo);
  }, [playback?.returnTo]);

  useTVEventHandler(
    useCallback(
      (event: { eventType?: string }) => {
        if (event.eventType !== 'menu' || screen === 'player') return;
        if (screen === 'details') setScreen('browse');
        else if (screen === 'browse' && browseSection !== 'home') setBrowseSection('home');
      },
      [browseSection, screen],
    ),
  );

  if (screen === 'splash') {
    return <SplashScreen onDone={finishSplash} />;
  }

  if (screen === 'profiles' || !profile) {
    return (
      <ProfileSelector
        onSelect={(selectedProfile) => {
          setProfile(selectedProfile);
          setBrowseSection('home');
          setScreen('browse');
        }}
      />
    );
  }

  if (screen === 'player' && playback) {
    return (
      <PlayerScreen
        onExit={leavePlayer}
        onProgressSaved={refreshDetails}
        profile={profile}
        startSeconds={playback.startSeconds}
        video={playback.video}
      />
    );
  }

  if (screen === 'details' && selectedVideo) {
    return (
      <MovieDetailScreen
        onBack={() => setScreen('browse')}
        onPlay={(startSeconds) => startPlayback(selectedVideo, startSeconds, 'details')}
        profile={profile}
        refreshKey={detailRefreshKey}
        video={selectedVideo}
      />
    );
  }

  return (
    <View style={styles.browseRoot}>
      <View style={styles.browseMain}>
        {browseSection === 'home' ? (
          <HomeScreen
            onCollections={() => setBrowseSection('collections')}
            onDetails={showDetails}
            onPlay={(video, startSeconds) => startPlayback(video, startSeconds, 'browse')}
          />
        ) : (
          <BrowseSectionScreen onDetails={showDetails} section={browseSection} />
        )}
      </View>
      <NavigationRail
        active={browseSection}
        onNavigate={setBrowseSection}
        onProfile={() => setScreen('profiles')}
        onReplayIntro={() => setScreen('splash')}
        profile={profile}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  browseRoot: { flex: 1, backgroundColor: '#03050B' },
  browseMain: { flex: 1, marginLeft: NATIVE_TV_RAIL_WIDTH },
  profileRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#03050B',
  },
  profileEyebrow: {
    color: '#E9C778',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 5,
  },
  profileLogo: {
    marginTop: 17,
    marginBottom: 60,
    color: '#F7F9FE',
    fontSize: 62,
    fontWeight: '800',
  },
  profilePlus: { color: '#70D8FF' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 34 },
  profileCard: {
    width: 236,
    height: 270,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'transparent',
    borderRadius: 20,
    backgroundColor: '#111C33',
  },
  profileCardFocused: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
    shadowColor: '#70D8FF',
    shadowOpacity: 0.42,
    shadowRadius: 16,
  },
  profileAvatar: {
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderRadius: 58,
    backgroundColor: '#0A1425',
  },
  profileInitials: { color: '#FFFFFF', fontSize: 40, fontWeight: '800' },
  profileName: { marginTop: 25, color: '#FFFFFF', fontSize: 25, fontWeight: '700' },
});
