import { useMemo, useState } from 'react';
import {
  ImageBackground,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  catalogue,
  catalogueCategories,
  profiles,
  type CatalogueVideoRecord,
} from '@lelibrambas/catalog';
import { midnightArchive } from '@lelibrambas/design-system';
import { clampSeek, SEEK_INTERVAL_SECONDS } from '@lelibrambas/shared';
import type { Profile } from '@lelibrambas/types';

const demoSource = require('../assets/archive-demo.mp4');
const studioArtwork = require('../assets/lelibrambas-studios.png');

type MobileTab = 'home' | 'search' | 'collections' | 'saved';

const demo = {
  title: 'Private Archive Preview',
  subtitle: 'A short synthetic LELIBRAMBAS+ preview',
  description:
    'A warm placeholder reel for testing mobile playback without family media, real filenames or personal paths.',
};

const tabItems: Array<{ id: MobileTab; label: string; icon: string }> = [
  { id: 'home', label: 'Home', icon: '\u2302' },
  { id: 'search', label: 'Search', icon: '\u2315' },
  { id: 'collections', label: 'Collections', icon: '\u25a6' },
  { id: 'saved', label: 'Saved', icon: '\u2661' },
];

function pressedStyle(pressed: boolean) {
  return pressed ? styles.pressed : undefined;
}

function Wordmark() {
  return (
    <Text style={styles.wordmark} accessibilityRole="header">
      LELIBRAMBAS<Text style={styles.wordmarkPlus}>+</Text>
    </Text>
  );
}

function ProfilePicker({
  activeProfile,
  onCancel,
  onSelect,
}: {
  activeProfile: Profile | null;
  onCancel: (() => void) | null;
  onSelect: (profile: Profile) => void;
}) {
  return (
    <SafeAreaView style={styles.appRoot}>
      <StatusBar barStyle="light-content" backgroundColor={midnightArchive.void} />
      <ScrollView
        contentContainerStyle={styles.profileContent}
        showsVerticalScrollIndicator={false}
      >
        {onCancel ? (
          <Pressable
            accessibilityLabel="Cancel profile switch"
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [styles.circleButton, pressedStyle(pressed)]}
          >
            <Text style={styles.circleButtonText}>←</Text>
          </Pressable>
        ) : (
          <View style={styles.profileTopSpacer} />
        )}

        <View style={styles.profileBrandBlock}>
          <Text style={styles.eyebrow}>PRIVATE FAMILY ARCHIVE</Text>
          <Wordmark />
          <Text style={styles.profileTitle}>Who is watching?</Text>
          <Text style={styles.profileIntro}>
            Choose a profile to personalise this preview on your phone.
          </Text>
        </View>

        <View style={styles.profileList}>
          {profiles.map((profile) => {
            const isActive = activeProfile?.id === profile.id;
            return (
              <Pressable
                accessibilityHint="Opens the mobile archive preview"
                accessibilityRole="button"
                key={profile.id}
                onPress={() => onSelect(profile)}
                style={({ pressed }) => [
                  styles.profileRow,
                  isActive && styles.profileRowActive,
                  pressedStyle(pressed),
                ]}
              >
                <View
                  style={[
                    styles.profileAvatar,
                    { borderColor: profile.accent, backgroundColor: `${profile.accent}24` },
                  ]}
                >
                  <Text style={styles.profileAvatarText}>{profile.initials}</Text>
                </View>
                <View style={styles.profileCopy}>
                  <Text style={styles.profileName}>{profile.name}</Text>
                  <Text style={styles.profileMeta}>
                    {isActive ? 'Current profile' : 'Tap to continue'}
                  </Text>
                </View>
                <Text style={styles.profileArrow}>›</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.privacyCard}>
          <Text style={styles.privacyIcon}>◈</Text>
          <View style={styles.privacyCopy}>
            <Text style={styles.privacyTitle}>A private local preview</Text>
            <Text style={styles.privacyText}>
              The checked-in titles and media used here are synthetic. This screen does not connect
              to a personal archive or cloud account.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MobileHeader({ profile, onProfile }: { profile: Profile; onProfile: () => void }) {
  return (
    <View style={styles.header}>
      <Wordmark />
      <Pressable
        accessibilityLabel={`Switch profile. Current profile ${profile.name}`}
        accessibilityRole="button"
        onPress={onProfile}
        style={({ pressed }) => [
          styles.headerAvatar,
          { borderColor: profile.accent },
          pressedStyle(pressed),
        ]}
      >
        <Text style={styles.headerAvatarText}>{profile.initials}</Text>
      </Pressable>
    </View>
  );
}

function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

function PaletteArtwork({
  video,
  size = 'card',
}: {
  video: CatalogueVideoRecord;
  size?: 'card' | 'row' | 'detail';
}) {
  const [first, second, accent] = video.artwork.palette;
  return (
    <View
      style={[
        styles.paletteArtwork,
        size === 'row' && styles.paletteArtworkRow,
        size === 'detail' && styles.paletteArtworkDetail,
        { backgroundColor: first },
      ]}
    >
      <View style={[styles.paletteField, { backgroundColor: second }]} />
      <View style={[styles.paletteOrbit, { borderColor: `${accent}80` }]} />
      <View style={[styles.paletteGlow, { backgroundColor: accent }]} />
      <Text style={[styles.paletteCategory, { color: accent }]} numberOfLines={1}>
        {video.categories[0]}
      </Text>
      <Text style={styles.paletteNumber}>{video.id}</Text>
    </View>
  );
}

function MemoryCard({ video, onPress }: { video: CatalogueVideoRecord; onPress: () => void }) {
  return (
    <Pressable
      accessibilityHint="Opens archive details"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.memoryCard, pressedStyle(pressed)]}
    >
      <PaletteArtwork video={video} />
      <View style={styles.memoryCardCopy}>
        <Text style={styles.memoryCardTitle} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={styles.memoryCardMeta}>{video.year ?? 'Year unknown'} · Catalogue only</Text>
      </View>
    </Pressable>
  );
}

function HomeScreen({
  profile,
  onOpenVideo,
  onPlayDemo,
  onProfile,
  onSelectCollection,
}: {
  profile: Profile;
  onOpenVideo: (video: CatalogueVideoRecord) => void;
  onPlayDemo: () => void;
  onProfile: () => void;
  onSelectCollection: (name: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <MobileHeader profile={profile} onProfile={onProfile} />

      <ImageBackground
        source={studioArtwork}
        resizeMode="contain"
        imageStyle={styles.heroBrandImage}
        style={styles.hero}
      >
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <View style={styles.demoBadge}>
            <Text style={styles.demoBadgeText}>SYNTHETIC MOBILE PREVIEW</Text>
          </View>
          <Text style={styles.heroTitle}>{demo.title}</Text>
          <Text style={styles.heroSubtitle}>{demo.subtitle}</Text>
          <Text style={styles.heroDescription} numberOfLines={3}>
            {demo.description}
          </Text>
          <Pressable
            accessibilityHint="Opens the bundled demo video"
            accessibilityRole="button"
            onPress={onPlayDemo}
            style={({ pressed }) => [styles.primaryButton, pressedStyle(pressed)]}
          >
            <Text style={styles.primaryButtonIcon}>▶</Text>
            <Text style={styles.primaryButtonText}>Play preview</Text>
          </Pressable>
        </View>
      </ImageBackground>

      <SectionHeading title={`Welcome, ${profile.name}`} detail="A phone-sized first look" />
      <Text style={styles.sectionIntro}>
        Browse the synthetic catalogue, inspect archive status, and try the bundled video player.
      </Text>

      <SectionHeading title="Archive rooms" detail={`${catalogueCategories.length} collections`} />
      <ScrollView
        horizontal
        contentContainerStyle={styles.horizontalList}
        showsHorizontalScrollIndicator={false}
      >
        {catalogueCategories.map((category, index) => {
          const colors = [
            midnightArchive.aurora,
            midnightArchive.indigo,
            midnightArchive.memoryGold,
            '#C56D72',
          ];
          const accent = colors[index] ?? midnightArchive.aurora;
          return (
            <Pressable
              accessibilityRole="button"
              key={category.name}
              onPress={() => onSelectCollection(category.name)}
              style={({ pressed }) => [
                styles.channelCard,
                { borderColor: `${accent}55` },
                pressedStyle(pressed),
              ]}
            >
              <Text style={[styles.channelIndex, { color: accent }]}>
                {String(index + 1).padStart(2, '0')}
              </Text>
              <Text style={styles.channelLabel}>LELIBRAMBAS+</Text>
              <Text style={styles.channelTitle}>{category.name}</Text>
              <Text style={styles.channelMeta}>{category.movies.length} catalogue records</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionHeading title="Explore the archive" detail={`${catalogue.length} records`} />
      <ScrollView
        horizontal
        contentContainerStyle={styles.horizontalList}
        showsHorizontalScrollIndicator={false}
      >
        {catalogue.slice(0, 10).map((video) => (
          <MemoryCard key={video.id} video={video} onPress={() => onOpenVideo(video)} />
        ))}
      </ScrollView>

      <View style={styles.localOnlyCard}>
        <Text style={styles.localOnlyEyebrow}>DESIGNED FOR PRIVATE VIEWING</Text>
        <Text style={styles.localOnlyTitle}>Your archive stays yours.</Text>
        <Text style={styles.localOnlyText}>
          This prototype uses local synthetic assets. No media is uploaded by the mobile preview.
        </Text>
      </View>
    </ScrollView>
  );
}

function SearchScreen({ onOpenVideo }: { onOpenVideo: (video: CatalogueVideoRecord) => void }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = useMemo(() => {
    if (!normalizedQuery) return catalogue.slice(0, 12);
    return catalogue.filter((video) =>
      [
        video.title,
        video.subtitle,
        video.description,
        String(video.year ?? ''),
        ...video.categories,
        ...video.tags,
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [normalizedQuery]);

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenEyebrow}>FIND A MEMORY</Text>
      <Text style={styles.screenTitle}>Search</Text>
      <Text style={styles.screenDescription}>
        Search titles, years, tags, or one of the four archive rooms.
      </Text>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          accessibilityLabel="Search the synthetic archive"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={setQuery}
          placeholder="Try JEUGDFILMS or 2014"
          placeholderTextColor={midnightArchive.textMuted}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
      </View>

      <ScrollView
        horizontal
        contentContainerStyle={styles.chipList}
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {catalogueCategories.map((category) => (
          <Pressable
            accessibilityRole="button"
            key={category.name}
            onPress={() => setQuery(category.name)}
            style={({ pressed }) => [styles.chip, pressedStyle(pressed)]}
          >
            <Text style={styles.chipText}>{category.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <SectionHeading
        title={normalizedQuery ? 'Results' : 'Browse all'}
        detail={`${matches.length} ${matches.length === 1 ? 'record' : 'records'}`}
      />

      {matches.length ? (
        <View style={styles.resultList}>
          {matches.map((video) => (
            <Pressable
              accessibilityRole="button"
              key={video.id}
              onPress={() => onOpenVideo(video)}
              style={({ pressed }) => [styles.resultRow, pressedStyle(pressed)]}
            >
              <PaletteArtwork video={video} size="row" />
              <View style={styles.resultCopy}>
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {video.title}
                </Text>
                <Text style={styles.resultMeta}>
                  {video.year ?? 'Year unknown'} · {video.categories[0]}
                </Text>
                <Text style={styles.unavailableLabel}>CATALOGUE ONLY</Text>
              </View>
              <Text style={styles.resultArrow}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No matching memories</Text>
          <Text style={styles.emptyStateText}>
            Try another title, year, folder, or archive room.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function CollectionsScreen({
  selectedCollection,
  onBack,
  onOpenVideo,
  onSelectCollection,
}: {
  selectedCollection: string | null;
  onBack: () => void;
  onOpenVideo: (video: CatalogueVideoRecord) => void;
  onSelectCollection: (name: string) => void;
}) {
  const category = catalogueCategories.find((item) => item.name === selectedCollection);
  const videos = category
    ? catalogue.filter((video) => video.categories.includes(category.name))
    : [];

  if (category) {
    return (
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityLabel="Back to collections"
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressedStyle(pressed)]}
        >
          <Text style={styles.backButtonIcon}>←</Text>
          <Text style={styles.backButtonText}>Collections</Text>
        </Pressable>
        <Text style={styles.screenEyebrow}>ARCHIVE ROOM</Text>
        <Text style={styles.screenTitle}>{category.name}</Text>
        <Text style={styles.screenDescription}>
          {category.movies.length} films from the generated local catalogue.
        </Text>
        <View style={styles.resultList}>
          {videos.map((video, index) => (
            <Pressable
              accessibilityRole="button"
              key={video.id}
              onPress={() => onOpenVideo(video)}
              style={({ pressed }) => [styles.episodeRow, pressedStyle(pressed)]}
            >
              <Text style={styles.episodeIndex}>{String(index + 1).padStart(2, '0')}</Text>
              <PaletteArtwork video={video} size="row" />
              <View style={styles.resultCopy}>
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {video.title}
                </Text>
                <Text style={styles.resultMeta}>{video.year ?? 'Year unknown'}</Text>
              </View>
              <Text style={styles.resultArrow}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.screenEyebrow}>BROWSE TOGETHER</Text>
      <Text style={styles.screenTitle}>Collections</Text>
      <Text style={styles.screenDescription}>
        The mobile view keeps the same four generated catalogue collections as the TV viewer.
      </Text>
      <View style={styles.collectionList}>
        {catalogueCategories.map((item, index) => {
          const accents = [
            midnightArchive.aurora,
            midnightArchive.indigo,
            midnightArchive.memoryGold,
            '#C56D72',
          ];
          const accent = accents[index] ?? midnightArchive.aurora;
          return (
            <Pressable
              accessibilityRole="button"
              key={item.name}
              onPress={() => onSelectCollection(item.name)}
              style={({ pressed }) => [
                styles.collectionCard,
                { borderColor: `${accent}44` },
                pressedStyle(pressed),
              ]}
            >
              <View style={styles.collectionCardTop}>
                <Text style={[styles.collectionNumber, { color: accent }]}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <Text style={[styles.collectionMonogram, { color: `${accent}42` }]}>LB</Text>
              </View>
              <Text style={styles.collectionTitle}>{item.name}</Text>
              <Text style={styles.collectionText}>{item.movies.length} catalogue records</Text>
              <Text style={styles.collectionAction}>Open collection →</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function SavedScreen({
  profile,
  savedIds,
  onOpenVideo,
}: {
  profile: Profile;
  savedIds: string[];
  onOpenVideo: (video: CatalogueVideoRecord) => void;
}) {
  const savedVideos = savedIds
    .map((id) => catalogue.find((video) => video.id === id))
    .filter((video): video is (typeof catalogue)[number] => Boolean(video));

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.screenEyebrow}>{profile.name.toLocaleUpperCase()}'S LIST</Text>
      <Text style={styles.screenTitle}>Saved</Text>
      <Text style={styles.screenDescription}>
        Keep a short list while you explore. Changes in this prototype last for the current session.
      </Text>
      {savedVideos.length ? (
        <View style={styles.resultList}>
          {savedVideos.map((video) => (
            <Pressable
              accessibilityRole="button"
              key={video.id}
              onPress={() => onOpenVideo(video)}
              style={({ pressed }) => [styles.resultRow, pressedStyle(pressed)]}
            >
              <PaletteArtwork video={video} size="row" />
              <View style={styles.resultCopy}>
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {video.title}
                </Text>
                <Text style={styles.resultMeta}>
                  {video.year ?? 'Year unknown'} · {video.categories[0]}
                </Text>
              </View>
              <Text style={styles.resultArrow}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>♡</Text>
          <Text style={styles.emptyStateTitle}>Nothing saved yet</Text>
          <Text style={styles.emptyStateText}>Open a catalogue record and tap Add to saved.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function DetailsScreen({
  saved,
  video,
  onBack,
  onToggleSaved,
}: {
  saved: boolean;
  video: CatalogueVideoRecord;
  onBack: () => void;
  onToggleSaved: () => void;
}) {
  return (
    <SafeAreaView style={styles.appRoot}>
      <StatusBar barStyle="light-content" backgroundColor={midnightArchive.void} />
      <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.circleButton, pressedStyle(pressed)]}
        >
          <Text style={styles.circleButtonText}>←</Text>
        </Pressable>

        <PaletteArtwork video={video} size="detail" />

        <Text style={styles.detailEyebrow}>LELIBRAMBAS+ CATALOGUE PLACEHOLDER</Text>
        <Text style={styles.detailTitle}>{video.title}</Text>
        <Text style={styles.detailSubtitle}>{video.subtitle}</Text>
        <View style={styles.metadataRow}>
          <Text style={styles.metadataPill}>{video.year ?? 'Year unknown'}</Text>
          <Text style={styles.metadataPill}>{video.categories[0]}</Text>
        </View>
        <Text style={styles.detailDescription}>{video.description}</Text>

        <View style={styles.availabilityCard}>
          <Text style={styles.availabilityEyebrow}>VIEWING COPY UNAVAILABLE</Text>
          <Text style={styles.availabilityTitle}>This record is catalogue-only.</Text>
          <Text style={styles.availabilityText}>
            The archive entry is preserved, but no playable media is connected to this synthetic
            placeholder. Try the preview on Home to test playback.
          </Text>
        </View>

        <View style={styles.detailActions}>
          <View style={styles.disabledButton} accessibilityState={{ disabled: true }}>
            <Text style={styles.disabledButtonText}>Playback unavailable</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: saved }}
            onPress={onToggleSaved}
            style={({ pressed }) => [
              styles.secondaryButton,
              saved && styles.secondaryButtonSelected,
              pressedStyle(pressed),
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {saved ? '\u2713 Saved' : '+ Add to saved'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.factList}>
          <View style={styles.factRow}>
            <Text style={styles.factLabel}>Recorded</Text>
            <Text style={styles.factValue}>
              {video.recordingDate ?? 'Date unknown'}
              {video.dateApproximate ? ' (approx.)' : ''}
            </Text>
          </View>
          <View style={styles.factRow}>
            <Text style={styles.factLabel}>Status</Text>
            <Text style={styles.factValue}>Media not inspected</Text>
          </View>
          <View style={styles.factRow}>
            <Text style={styles.factLabel}>Visibility</Text>
            <Text style={styles.factValue}>Private family prototype</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlayerScreen({ onBack }: { onBack: () => void }) {
  const player = useVideoPlayer(demoSource, (instance) => {
    instance.loop = false;
  });

  const closePlayer = () => {
    player.pause();
    onBack();
  };

  const skipBy = (deltaSeconds: number) => {
    const currentSeconds = Number.isFinite(player.currentTime) ? player.currentTime : 0;
    const durationSeconds =
      Number.isFinite(player.duration) && player.duration > 0 ? player.duration : null;
    const targetSeconds =
      durationSeconds === null
        ? Math.max(0, currentSeconds + deltaSeconds)
        : clampSeek(currentSeconds, deltaSeconds, durationSeconds);
    player.seekBy(targetSeconds - currentSeconds);
  };

  return (
    <SafeAreaView style={styles.playerRoot}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.playerHeader}>
        <Pressable
          accessibilityLabel="Close video player"
          accessibilityRole="button"
          onPress={closePlayer}
          style={({ pressed }) => [styles.playerBack, pressedStyle(pressed)]}
        >
          <Text style={styles.playerBackText}>←</Text>
        </Pressable>
        <View style={styles.playerHeaderCopy}>
          <Text style={styles.playerKicker}>SYNTHETIC PREVIEW</Text>
          <Text style={styles.playerTitle} numberOfLines={1}>
            {demo.title}
          </Text>
        </View>
      </View>
      <VideoView
        contentFit="contain"
        fullscreenOptions={{ enable: true, orientation: 'landscape' }}
        nativeControls
        player={player}
        playsInline
        style={styles.video}
      />
      <View style={styles.playerSeekControls}>
        <Pressable
          accessibilityLabel="Skip back 10 seconds"
          accessibilityRole="button"
          onPress={() => skipBy(-SEEK_INTERVAL_SECONDS)}
          style={({ pressed }) => [styles.playerSeekButton, pressedStyle(pressed)]}
        >
          <Text style={styles.playerSeekIcon}>↶</Text>
          <Text style={styles.playerSeekInterval}>10</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Skip forward 10 seconds"
          accessibilityRole="button"
          onPress={() => skipBy(SEEK_INTERVAL_SECONDS)}
          style={({ pressed }) => [styles.playerSeekButton, pressedStyle(pressed)]}
        >
          <Text style={styles.playerSeekIcon}>↷</Text>
          <Text style={styles.playerSeekInterval}>10</Text>
        </Pressable>
      </View>
      <View style={styles.playerFooter}>
        <Text style={styles.playerFooterTitle}>Original shape, always.</Text>
        <Text style={styles.playerFooterText}>
          Use the native controls to play, scrub, adjust volume, or enter fullscreen. The matching
          buttons skip exactly 10 seconds without changing play or pause state.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function TabBar({ active, onSelect }: { active: MobileTab; onSelect: (tab: MobileTab) => void }) {
  return (
    <View style={styles.tabBar} accessibilityRole="tablist">
      {tabItems.map((item) => {
        const selected = active === item.id;
        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [styles.tabItem, pressedStyle(pressed)]}
          >
            <Text style={[styles.tabIcon, selected && styles.tabIconActive]}>{item.icon}</Text>
            <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{item.label}</Text>
            {selected ? <View style={styles.tabIndicator} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function MobileApp() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [switchingProfile, setSwitchingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<CatalogueVideoRecord | null>(null);
  const [playingDemo, setPlayingDemo] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const chooseProfile = (nextProfile: Profile) => {
    setProfile(nextProfile);
    setSavedIds(nextProfile.watchlist);
    setSwitchingProfile(false);
    setActiveTab('home');
    setSelectedCollection(null);
    setSelectedVideo(null);
  };

  const selectTab = (tab: MobileTab) => {
    setActiveTab(tab);
    if (tab !== 'collections') setSelectedCollection(null);
  };

  const openCollection = (name: string) => {
    setSelectedCollection(name);
    setActiveTab('collections');
  };

  const toggleSaved = (videoId: string) => {
    setSavedIds((current) =>
      current.includes(videoId)
        ? current.filter((candidate) => candidate !== videoId)
        : [...current, videoId],
    );
  };

  if (!profile || switchingProfile) {
    return (
      <ProfilePicker
        activeProfile={profile}
        onCancel={profile ? () => setSwitchingProfile(false) : null}
        onSelect={chooseProfile}
      />
    );
  }

  if (playingDemo) {
    return <PlayerScreen onBack={() => setPlayingDemo(false)} />;
  }

  if (selectedVideo) {
    return (
      <DetailsScreen
        onBack={() => setSelectedVideo(null)}
        onToggleSaved={() => toggleSaved(selectedVideo.id)}
        saved={savedIds.includes(selectedVideo.id)}
        video={selectedVideo}
      />
    );
  }

  let screen: React.ReactNode;
  if (activeTab === 'search') {
    screen = <SearchScreen onOpenVideo={setSelectedVideo} />;
  } else if (activeTab === 'collections') {
    screen = (
      <CollectionsScreen
        onBack={() => setSelectedCollection(null)}
        onOpenVideo={setSelectedVideo}
        onSelectCollection={setSelectedCollection}
        selectedCollection={selectedCollection}
      />
    );
  } else if (activeTab === 'saved') {
    screen = <SavedScreen onOpenVideo={setSelectedVideo} profile={profile} savedIds={savedIds} />;
  } else {
    screen = (
      <HomeScreen
        onOpenVideo={setSelectedVideo}
        onPlayDemo={() => setPlayingDemo(true)}
        onProfile={() => setSwitchingProfile(true)}
        onSelectCollection={openCollection}
        profile={profile}
      />
    );
  }

  return (
    <SafeAreaView style={styles.appRoot}>
      <StatusBar barStyle="light-content" backgroundColor={midnightArchive.void} />
      <View style={styles.mobileSurface}>
        <View style={styles.screen}>{screen}</View>
        <TabBar active={activeTab} onSelect={selectTab} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1, backgroundColor: midnightArchive.void },
  mobileSurface: {
    flex: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    backgroundColor: midnightArchive.void,
  },
  screen: { flex: 1 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  profileContent: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
  profileTopSpacer: { height: 52 },
  profileBrandBlock: { marginTop: 34, marginBottom: 30 },
  eyebrow: {
    marginBottom: 10,
    color: midnightArchive.memoryGold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  wordmark: {
    color: midnightArchive.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0,
  },
  wordmarkPlus: { color: midnightArchive.aurora },
  profileTitle: {
    marginTop: 44,
    color: midnightArchive.textPrimary,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 0,
  },
  profileIntro: {
    maxWidth: 420,
    marginTop: 10,
    color: midnightArchive.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  profileList: { gap: 10 },
  profileRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#23314C',
    borderRadius: 16,
    backgroundColor: midnightArchive.surface,
  },
  profileRowActive: { borderColor: '#57739B', backgroundColor: midnightArchive.surfaceRaised },
  profileAvatar: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 27,
  },
  profileAvatarText: { color: midnightArchive.textPrimary, fontSize: 17, fontWeight: '800' },
  profileCopy: { flex: 1, paddingHorizontal: 14 },
  profileName: { color: midnightArchive.textPrimary, fontSize: 17, fontWeight: '700' },
  profileMeta: { marginTop: 4, color: midnightArchive.textMuted, fontSize: 12 },
  profileArrow: { color: midnightArchive.textMuted, fontSize: 30, fontWeight: '300' },
  privacyCard: {
    flexDirection: 'row',
    marginTop: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#25483F',
    borderRadius: 16,
    backgroundColor: '#0B1B1B',
  },
  privacyIcon: { marginRight: 12, color: midnightArchive.success, fontSize: 24 },
  privacyCopy: { flex: 1 },
  privacyTitle: { color: midnightArchive.success, fontSize: 14, fontWeight: '800' },
  privacyText: {
    marginTop: 5,
    color: midnightArchive.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  circleButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2B3852',
    borderRadius: 23,
    backgroundColor: midnightArchive.surface,
  },
  circleButtonText: { color: midnightArchive.textPrimary, fontSize: 21, fontWeight: '600' },
  screenContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 21,
    backgroundColor: midnightArchive.surface,
  },
  headerAvatarText: { color: midnightArchive.textPrimary, fontSize: 12, fontWeight: '800' },
  hero: {
    minHeight: 430,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginHorizontal: -20,
    marginBottom: 30,
    backgroundColor: '#151018',
  },
  heroBrandImage: {
    width: '54%',
    height: '34%',
    left: '43%',
    top: 20,
    opacity: 0.28,
  },
  heroOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(6, 4, 3, 0.68)',
  },
  heroContent: { paddingHorizontal: 22, paddingTop: 120, paddingBottom: 26 },
  demoBadge: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: 'rgba(233,199,120,0.46)',
    borderRadius: 999,
    backgroundColor: 'rgba(3,5,11,0.58)',
  },
  demoBadgeText: {
    color: midnightArchive.memoryGold,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  heroTitle: {
    maxWidth: 540,
    color: midnightArchive.textPrimary,
    fontSize: 43,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 45,
  },
  heroSubtitle: {
    marginTop: 8,
    color: midnightArchive.aurora,
    fontSize: 13,
    fontWeight: '700',
  },
  heroDescription: {
    maxWidth: 520,
    marginTop: 10,
    color: midnightArchive.textPrimary,
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 9,
    marginTop: 20,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: midnightArchive.textPrimary,
  },
  primaryButtonIcon: { color: midnightArchive.midnight, fontSize: 13 },
  primaryButtonText: { color: midnightArchive.midnight, fontSize: 15, fontWeight: '800' },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitle: {
    flex: 1,
    color: midnightArchive.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0,
  },
  sectionDetail: { color: midnightArchive.textMuted, fontSize: 11 },
  sectionIntro: {
    marginTop: -4,
    marginBottom: 4,
    color: midnightArchive.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  horizontalList: { gap: 12, paddingRight: 20, paddingBottom: 8 },
  channelCard: {
    width: 228,
    minHeight: 150,
    overflow: 'hidden',
    padding: 17,
    borderWidth: 1,
    borderRadius: 15,
    backgroundColor: midnightArchive.surface,
  },
  channelIndex: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  channelLabel: {
    marginTop: 27,
    color: midnightArchive.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  channelTitle: {
    marginTop: 5,
    color: midnightArchive.textPrimary,
    fontSize: 19,
    fontWeight: '800',
  },
  channelMeta: { marginTop: 5, color: midnightArchive.textSecondary, fontSize: 11 },
  memoryCard: {
    width: 238,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#24314A',
    borderRadius: 14,
    backgroundColor: midnightArchive.surface,
  },
  paletteArtwork: { height: 134, overflow: 'hidden' },
  paletteArtworkRow: { width: 106, height: 74, flexShrink: 0, borderRadius: 9 },
  paletteArtworkDetail: { width: '100%', height: 265, marginTop: 22, borderRadius: 18 },
  paletteField: {
    position: 'absolute',
    width: '78%',
    height: '160%',
    right: '-28%',
    top: '-34%',
    opacity: 0.84,
    transform: [{ rotate: '23deg' }],
  },
  paletteOrbit: {
    position: 'absolute',
    width: '78%',
    height: '125%',
    right: '-11%',
    top: '-27%',
    borderWidth: 1,
    borderRadius: 999,
    transform: [{ rotate: '27deg' }],
  },
  paletteGlow: {
    position: 'absolute',
    width: 10,
    height: 10,
    left: '27%',
    top: '34%',
    borderRadius: 5,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  paletteCategory: {
    position: 'absolute',
    left: 11,
    bottom: 10,
    maxWidth: '66%',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  paletteNumber: {
    position: 'absolute',
    right: 8,
    bottom: -8,
    color: 'rgba(255,255,255,0.22)',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 0,
  },
  memoryCardCopy: { minHeight: 76, padding: 12 },
  memoryCardTitle: {
    color: midnightArchive.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  memoryCardMeta: { marginTop: 6, color: midnightArchive.textMuted, fontSize: 10 },
  localOnlyCard: {
    marginTop: 32,
    marginBottom: 6,
    padding: 20,
    borderWidth: 1,
    borderColor: '#263855',
    borderRadius: 17,
    backgroundColor: midnightArchive.deepNavy,
  },
  localOnlyEyebrow: {
    color: midnightArchive.aurora,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  localOnlyTitle: {
    marginTop: 9,
    color: midnightArchive.textPrimary,
    fontSize: 21,
    fontWeight: '800',
  },
  localOnlyText: {
    marginTop: 7,
    color: midnightArchive.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  screenEyebrow: {
    marginTop: 22,
    color: midnightArchive.memoryGold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  screenTitle: {
    marginTop: 7,
    color: midnightArchive.textPrimary,
    fontSize: 39,
    fontWeight: '900',
    letterSpacing: 0,
  },
  screenDescription: {
    maxWidth: 560,
    marginTop: 9,
    color: midnightArchive.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  searchBox: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#2A3B59',
    borderRadius: 14,
    backgroundColor: midnightArchive.surface,
  },
  searchIcon: { marginRight: 9, color: midnightArchive.aurora, fontSize: 22 },
  searchInput: { flex: 1, color: midnightArchive.textPrimary, fontSize: 15, paddingVertical: 13 },
  chipList: { gap: 8, paddingTop: 12, paddingBottom: 4 },
  chip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#2A3851',
    borderRadius: 999,
    backgroundColor: midnightArchive.surface,
  },
  chipText: { color: midnightArchive.textSecondary, fontSize: 11, fontWeight: '700' },
  resultList: { gap: 10, marginTop: 5 },
  resultRow: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 9,
    borderWidth: 1,
    borderColor: '#202E47',
    borderRadius: 13,
    backgroundColor: midnightArchive.surface,
  },
  resultCopy: { flex: 1, minWidth: 0 },
  resultTitle: {
    color: midnightArchive.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  resultMeta: { marginTop: 5, color: midnightArchive.textMuted, fontSize: 10 },
  unavailableLabel: {
    marginTop: 6,
    color: midnightArchive.warning,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  resultArrow: { color: midnightArchive.textMuted, fontSize: 26, fontWeight: '300' },
  emptyState: {
    minHeight: 250,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: '#25334B',
    borderStyle: 'dashed',
    borderRadius: 17,
    backgroundColor: 'rgba(17,28,51,0.38)',
  },
  emptyStateIcon: { marginBottom: 12, color: midnightArchive.aurora, fontSize: 38 },
  emptyStateTitle: { color: midnightArchive.textPrimary, fontSize: 18, fontWeight: '800' },
  emptyStateText: {
    maxWidth: 320,
    marginTop: 7,
    color: midnightArchive.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  backButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    marginTop: 6,
    paddingRight: 12,
  },
  backButtonIcon: { color: midnightArchive.textPrimary, fontSize: 19 },
  backButtonText: { color: midnightArchive.textSecondary, fontSize: 14, fontWeight: '700' },
  episodeRow: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 9,
    borderWidth: 1,
    borderColor: '#202E47',
    borderRadius: 13,
    backgroundColor: midnightArchive.surface,
  },
  episodeIndex: {
    width: 25,
    color: midnightArchive.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  collectionList: { gap: 13, marginTop: 27 },
  mobileGroupList: { gap: 9, marginTop: 20, marginBottom: 8 },
  mobileGroupCard: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(233,199,120,0.22)',
    borderRadius: 14,
    backgroundColor: '#171219',
  },
  mobileGroupIndex: {
    width: 34,
    color: midnightArchive.memoryGold,
    fontSize: 11,
    fontWeight: '900',
  },
  mobileGroupCopy: { flex: 1, minWidth: 0 },
  mobileGroupTitle: { color: midnightArchive.textPrimary, fontSize: 15, fontWeight: '800' },
  mobileGroupMeta: { marginTop: 3, color: midnightArchive.textMuted, fontSize: 11 },
  collectionCard: {
    minHeight: 190,
    overflow: 'hidden',
    padding: 19,
    borderWidth: 1,
    borderRadius: 17,
    backgroundColor: midnightArchive.surface,
  },
  collectionCardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  collectionNumber: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  collectionMonogram: { marginTop: -18, fontSize: 64, fontWeight: '900', letterSpacing: 0 },
  collectionTitle: {
    marginTop: 16,
    color: midnightArchive.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
  },
  collectionText: { marginTop: 6, color: midnightArchive.textSecondary, fontSize: 12 },
  collectionAction: {
    marginTop: 19,
    color: midnightArchive.aurora,
    fontSize: 12,
    fontWeight: '800',
  },
  detailContent: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 44,
  },
  detailEyebrow: {
    marginTop: 27,
    color: midnightArchive.memoryGold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.7,
  },
  detailTitle: {
    marginTop: 9,
    color: midnightArchive.textPrimary,
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 40,
    letterSpacing: 0,
  },
  detailSubtitle: {
    marginTop: 8,
    color: midnightArchive.textSecondary,
    fontSize: 15,
    lineHeight: 21,
  },
  metadataRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 17 },
  metadataPill: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: '#2A3954',
    borderRadius: 999,
    color: midnightArchive.textSecondary,
    fontSize: 10,
  },
  detailDescription: {
    marginTop: 20,
    color: midnightArchive.textPrimary,
    fontSize: 15,
    lineHeight: 23,
  },
  availabilityCard: {
    marginTop: 23,
    padding: 17,
    borderWidth: 1,
    borderColor: '#5A4B29',
    borderRadius: 15,
    backgroundColor: '#1B170D',
  },
  availabilityEyebrow: {
    color: midnightArchive.warning,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  availabilityTitle: {
    marginTop: 8,
    color: midnightArchive.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  availabilityText: {
    marginTop: 7,
    color: midnightArchive.textSecondary,
    fontSize: 12,
    lineHeight: 19,
  },
  detailActions: { gap: 10, marginTop: 20 },
  disabledButton: {
    minHeight: 51,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#414957',
    opacity: 0.72,
  },
  disabledButtonText: { color: '#D4D8E0', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    minHeight: 51,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#34435F',
    borderRadius: 13,
    backgroundColor: midnightArchive.surface,
  },
  secondaryButtonSelected: { borderColor: midnightArchive.aurora, backgroundColor: '#10273A' },
  secondaryButtonText: { color: midnightArchive.textPrimary, fontSize: 14, fontWeight: '800' },
  factList: {
    marginTop: 25,
    borderTopWidth: 1,
    borderTopColor: '#202C43',
  },
  factRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#202C43',
  },
  factLabel: { color: midnightArchive.textMuted, fontSize: 11, fontWeight: '700' },
  factValue: { flex: 1, color: midnightArchive.textSecondary, fontSize: 11, textAlign: 'right' },
  tabBar: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: '#1E2B42',
    backgroundColor: '#070C17',
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabIcon: { color: midnightArchive.textMuted, fontSize: 21, lineHeight: 23 },
  tabIconActive: { color: midnightArchive.aurora },
  tabLabel: { marginTop: 2, color: midnightArchive.textMuted, fontSize: 9, fontWeight: '700' },
  tabLabelActive: { color: midnightArchive.textPrimary },
  tabIndicator: {
    position: 'absolute',
    top: -1,
    width: 30,
    height: 2,
    borderRadius: 2,
    backgroundColor: midnightArchive.aurora,
  },
  playerRoot: { flex: 1, backgroundColor: '#000000' },
  playerHeader: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2430',
  },
  playerBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#151923',
  },
  playerBackText: { color: '#FFFFFF', fontSize: 21, fontWeight: '600' },
  playerHeaderCopy: { flex: 1, paddingLeft: 13, paddingRight: 8 },
  playerKicker: {
    color: midnightArchive.memoryGold,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  playerTitle: { marginTop: 3, color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000000' },
  playerSeekControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 14,
  },
  playerSeekButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#30394A',
    borderRadius: 26,
    backgroundColor: '#151923',
  },
  playerSeekIcon: { color: '#FFFFFF', fontSize: 27, lineHeight: 30 },
  playerSeekInterval: {
    position: 'absolute',
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  playerFooter: { padding: 21 },
  playerFooterTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  playerFooterText: { marginTop: 7, color: '#9BA5B8', fontSize: 13, lineHeight: 20 },
});
