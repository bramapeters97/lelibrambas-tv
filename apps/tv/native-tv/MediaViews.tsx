import { useEffect, useMemo, useState } from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TVFocusGuideView,
  View,
} from 'react-native';
import {
  catalogue,
  catalogueCategories,
  collections,
  type CatalogueVideoRecord,
} from '@lelibrambas/catalog';
import type { Collection, PlaybackProgress, Profile } from '@lelibrambas/types';
import { clearNativePlaybackProgress, readNativePlaybackProgress } from './progressStorage';
import {
  NATIVE_COLLECTIONS_LABEL,
  allMoviesForHome,
  emptyPlaybackProgress,
  formatPlaybackTimestamp,
  restartPlaybackProgress,
  resumableSeconds,
} from './state';
import type { NativeBrowseSection } from './NavigationRail';

// Metro resolves static image requires to native asset identifiers rather than URL strings.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const studioArtwork = require('../assets/lelibrambas-studios.png');
const HOME_BASE = '#03050B';

type SectionIconName =
  | 'collections'
  | 'trending'
  | 'jeugdfilms'
  | 'vakantiefilms'
  | 'events'
  | 'others'
  | 'movies';

function sectionTitle(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'JEUGDFILMS') return 'Jeugdfilms';
  if (normalized === 'VAKANTIEFILMS') return 'Vakantiefilms';
  if (normalized === 'EVENTS') return 'Events';
  if (normalized === 'OTHERS') return 'Others';
  return value;
}

function sectionIcon(value: string): SectionIconName {
  switch (value.trim().toUpperCase()) {
    case 'COLLECTIONS':
      return 'collections';
    case 'CURRENTLY TRENDING':
      return 'trending';
    case 'JEUGDFILMS':
      return 'jeugdfilms';
    case 'VAKANTIEFILMS':
      return 'vakantiefilms';
    case 'EVENTS':
      return 'events';
    case 'OTHERS':
      return 'others';
    default:
      return 'movies';
  }
}

function FilmIcon() {
  return (
    <View style={styles.filmIcon}>
      <View style={styles.filmPerforationLeft} />
      <View style={styles.filmPerforationRight} />
      <Text style={styles.filmPlay}>▶</Text>
    </View>
  );
}

function SectionHeading({
  title,
  icon = sectionIcon(title),
}: {
  title: string;
  icon?: SectionIconName;
}) {
  const symbols: Partial<Record<SectionIconName, string>> = {
    collections: '▦',
    trending: '↗',
    jeugdfilms: '☆',
    vakantiefilms: '☼',
    events: '□',
    others: '•••',
  };
  return (
    <View style={styles.sectionHeading}>
      {icon === 'movies' ? <FilmIcon /> : <Text style={styles.sectionIcon}>{symbols[icon]}</Text>}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export function MovieCard({
  video,
  index,
  onPress,
}: {
  video: CatalogueVideoRecord;
  index: number;
  onPress: () => void;
}) {
  const [first, second, accent] = video.artwork.palette;
  return (
    <Pressable
      accessibilityHint="Opens movie details"
      accessibilityLabel={video.title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ focused }) => [styles.movieCard, focused && styles.focusedCard]}
    >
      <View style={[styles.movieArtwork, { backgroundColor: first }]}>
        <View style={[styles.movieArtworkField, { backgroundColor: second }]} />
        <View style={[styles.movieArtworkGlow, { backgroundColor: accent }]} />
        <Text style={[styles.movieCategory, { color: accent }]}>
          {sectionTitle(video.categories[0] ?? '')}
        </Text>
        <Text style={styles.movieNumber}>{String(index + 1).padStart(2, '0')}</Text>
      </View>
      <Text numberOfLines={1} style={styles.movieTitle}>
        {video.title}
      </Text>
      <Text style={styles.movieMeta}>
        {video.year ?? 'Year unknown'} · {sectionTitle(video.categories[0] ?? 'Archive')}
      </Text>
    </Pressable>
  );
}

function MediaShelf({
  title,
  movies,
  onDetails,
}: {
  title: string;
  movies: readonly CatalogueVideoRecord[];
  onDetails: (video: CatalogueVideoRecord) => void;
}) {
  if (!movies.length) return null;
  return (
    <View style={styles.shelf}>
      <SectionHeading title={title} />
      <ScrollView
        horizontal
        contentContainerStyle={styles.shelfScroll}
        showsHorizontalScrollIndicator={false}
      >
        <TVFocusGuideView style={styles.shelfRow} trapFocusRight>
          {movies.map((video, index) => (
            <MovieCard
              index={index}
              key={`${title}-${video.id}`}
              onPress={() => onDetails(video)}
              video={video}
            />
          ))}
        </TVFocusGuideView>
      </ScrollView>
    </View>
  );
}

function CollectionCard({ collection, onPress }: { collection: Collection; onPress: () => void }) {
  const colors: Record<string, string> = {
    jeugdfilms: '#256A83',
    vakantiefilms: '#6255B5',
    events: '#A67C32',
    others: '#834B65',
  };
  return (
    <Pressable
      accessibilityLabel={`${sectionTitle(collection.title)} collection`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ focused }) => [
        styles.collectionCard,
        { backgroundColor: colors[collection.id] ?? '#1A2A45' },
        focused && styles.focusedCard,
      ]}
    >
      <Text style={styles.collectionIcon}>▦</Text>
      <Text style={styles.collectionTitle}>{sectionTitle(collection.title)}</Text>
      <Text style={styles.collectionMeta}>{collection.videoIds.length} movies</Text>
    </Pressable>
  );
}

function CollectionsShelf({ onOpen }: { onOpen: () => void }) {
  return (
    <View style={styles.shelf}>
      <SectionHeading icon="collections" title={NATIVE_COLLECTIONS_LABEL} />
      <ScrollView
        horizontal
        contentContainerStyle={styles.shelfScroll}
        showsHorizontalScrollIndicator={false}
      >
        <TVFocusGuideView style={styles.shelfRow} trapFocusRight>
          {collections.map((collection) => (
            <CollectionCard collection={collection} key={collection.id} onPress={onOpen} />
          ))}
        </TVFocusGuideView>
      </ScrollView>
    </View>
  );
}

function HeroShade() {
  return (
    <View pointerEvents="none" style={styles.heroShade}>
      <View style={[styles.heroBand, styles.heroBandOne]} />
      <View style={[styles.heroBand, styles.heroBandTwo]} />
      <View style={[styles.heroBand, styles.heroBandThree]} />
      <View style={[styles.heroBand, styles.heroBandFour]} />
      <View style={[styles.heroBand, styles.heroBandFive]} />
    </View>
  );
}

export function HomeScreen({
  onCollections,
  onDetails,
  onPlay,
}: {
  onCollections: () => void;
  onDetails: (video: CatalogueVideoRecord) => void;
  onPlay: (video: CatalogueVideoRecord, startSeconds: number) => void;
}) {
  const allMovies = useMemo(() => allMoviesForHome(catalogue), []);
  const featured = allMovies[0]!;
  const trending = allMovies.slice(0, 10);
  return (
    <ScrollView
      contentContainerStyle={styles.homeContent}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <ImageBackground
        imageStyle={styles.heroImage}
        resizeMode="cover"
        source={studioArtwork}
        style={styles.hero}
      >
        <HeroShade />
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>A LELIBRAMBAS STUDIOS™ PRESENTATION</Text>
          <Text numberOfLines={2} style={styles.heroTitle}>
            {featured.title}
          </Text>
          <Text style={styles.heroMetadata}>
            {featured.year ?? 'YEAR UNKNOWN'} · {sectionTitle(featured.categories[0] ?? 'Archive')}
          </Text>
          <Text numberOfLines={3} style={styles.heroDescription}>
            {featured.description}
          </Text>
          <TVFocusGuideView autoFocus style={styles.heroActions} trapFocusRight>
            <Pressable
              accessibilityLabel={`Play ${featured.title}`}
              accessibilityRole="button"
              hasTVPreferredFocus
              onPress={() => onPlay(featured, 0)}
              style={({ focused }) => [styles.primaryButton, focused && styles.focusedButton]}
            >
              <Text style={styles.primaryButtonText}>▶ Play</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`More information about ${featured.title}`}
              accessibilityRole="button"
              onPress={() => onDetails(featured)}
              style={({ focused }) => [styles.secondaryButton, focused && styles.focusedButton]}
            >
              <Text style={styles.secondaryButtonText}>More information</Text>
            </Pressable>
          </TVFocusGuideView>
        </View>
      </ImageBackground>

      <CollectionsShelf onOpen={onCollections} />
      <MediaShelf movies={trending} onDetails={onDetails} title="Currently Trending" />
      {catalogueCategories.map((category) => (
        <MediaShelf
          key={category.name}
          movies={allMovies.filter((video) => video.categories.includes(category.name))}
          onDetails={onDetails}
          title={sectionTitle(category.name)}
        />
      ))}
      <MediaShelf movies={allMovies} onDetails={onDetails} title="All movies" />
    </ScrollView>
  );
}

export function BrowseSectionScreen({
  section,
  onDetails,
}: {
  section: Exclude<NativeBrowseSection, 'home'>;
  onDetails: (video: CatalogueVideoRecord) => void;
}) {
  const allMovies = useMemo(() => allMoviesForHome(catalogue), []);
  const title =
    section === 'collections'
      ? NATIVE_COLLECTIONS_LABEL
      : section === 'search'
        ? 'Search'
        : 'Full Library';
  const subtitle =
    section === 'collections'
      ? 'Browse the archive by collection'
      : section === 'search'
        ? 'Search results from the bundled catalogue'
        : 'Every film in the private archive';

  return (
    <ScrollView
      contentContainerStyle={styles.browseContent}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <Text style={styles.browseEyebrow}>{subtitle.toUpperCase()}</Text>
      <Text style={styles.browseTitle}>{title}</Text>
      {section === 'collections' ? (
        <>
          {catalogueCategories.map((category) => (
            <MediaShelf
              key={category.name}
              movies={allMovies.filter((video) => video.categories.includes(category.name))}
              onDetails={onDetails}
              title={sectionTitle(category.name)}
            />
          ))}
        </>
      ) : (
        <MediaShelf movies={allMovies} onDetails={onDetails} title="All movies" />
      )}
    </ScrollView>
  );
}

export function MovieDetailScreen({
  profile,
  refreshKey,
  video,
  onBack,
  onPlay,
}: {
  profile: Profile;
  refreshKey: number;
  video: CatalogueVideoRecord;
  onBack: () => void;
  onPlay: (startSeconds: number) => void;
}) {
  const [progress, setProgress] = useState<PlaybackProgress | null>(null);

  useEffect(() => {
    let active = true;
    void readNativePlaybackProgress(profile.id, video.id, video.durationSeconds ?? 1).then(
      (nextProgress) => {
        if (active) setProgress(nextProgress);
      },
    );
    return () => {
      active = false;
    };
  }, [profile.id, refreshKey, video.durationSeconds, video.id]);

  const resumeSeconds = resumableSeconds(progress);
  const duration = progress?.durationSeconds ?? video.durationSeconds;
  const progressPercent =
    resumeSeconds > 0 && duration && duration > 0
      ? Math.min(100, Math.max(0, (resumeSeconds / duration) * 100))
      : 0;
  const progressWidth = `${progressPercent}%` as `${number}%`;
  const [first, second, accent] = video.artwork.palette;

  const restart = async () => {
    const reset = restartPlaybackProgress(
      progress ?? emptyPlaybackProgress(profile.id, video.id, video.durationSeconds ?? 1),
    );
    setProgress(reset);
    await clearNativePlaybackProgress(profile.id, video.id);
    onPlay(0);
  };

  return (
    <View style={styles.detailRoot}>
      <View style={[styles.detailArtwork, { backgroundColor: first }]}>
        <View style={[styles.detailArtworkField, { backgroundColor: second }]} />
        <View style={[styles.detailArtworkGlow, { backgroundColor: accent }]} />
      </View>
      <View style={styles.detailScrim} />
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        onPress={onBack}
        style={({ focused }) => [styles.backButton, focused && styles.focusedButton]}
      >
        <Text style={styles.backButtonText}>‹ Back</Text>
      </Pressable>

      <View style={styles.detailCopy}>
        <Text style={styles.detailEyebrow}>A LELIBRAMBAS STUDIOS™ PRESENTATION</Text>
        <Text numberOfLines={2} style={styles.detailTitle}>
          {video.title}
        </Text>
        <Text style={styles.detailMetadata}>
          {sectionTitle(video.categories[0] ?? 'Archive')} · {video.year ?? 'Year unknown'}
        </Text>
        <Text numberOfLines={4} style={styles.detailDescription}>
          {video.description}
        </Text>

        {resumeSeconds > 0 ? (
          <View style={styles.resumeBlock}>
            <View
              accessibilityLabel={`${Math.round(progressPercent)} percent watched`}
              style={styles.progressTrack}
            >
              <View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
            <Text style={styles.resumeText}>
              Resume at {formatPlaybackTimestamp(resumeSeconds)}
            </Text>
          </View>
        ) : null}

        <TVFocusGuideView autoFocus style={styles.detailActions} trapFocusRight>
          <Pressable
            accessibilityLabel={resumeSeconds > 0 ? 'Resume movie' : 'Play movie'}
            accessibilityRole="button"
            hasTVPreferredFocus
            onPress={() => onPlay(resumeSeconds)}
            style={({ focused }) => [styles.primaryButton, focused && styles.focusedButton]}
          >
            <Text style={styles.primaryButtonText}>
              {resumeSeconds > 0 ? '▶ Resume' : '▶ Play'}
            </Text>
          </Pressable>
          {resumeSeconds > 0 ? (
            <Pressable
              accessibilityLabel="Restart movie from the beginning"
              accessibilityRole="button"
              onPress={() => void restart()}
              style={({ focused }) => [styles.secondaryButton, focused && styles.focusedButton]}
            >
              <Text style={styles.secondaryButtonText}>⭯ Restart</Text>
            </Pressable>
          ) : null}
        </TVFocusGuideView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: HOME_BASE },
  homeContent: { paddingBottom: 80, backgroundColor: HOME_BASE },
  hero: { height: 650, overflow: 'hidden', backgroundColor: '#071426' },
  heroImage: { opacity: 0.36 },
  heroShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
  },
  heroBand: { width: '100%', height: 42 },
  heroBandOne: { backgroundColor: 'rgba(7, 18, 36, 0.66)' },
  heroBandTwo: { backgroundColor: 'rgba(6, 15, 30, 0.78)' },
  heroBandThree: { backgroundColor: 'rgba(5, 11, 23, 0.88)' },
  heroBandFour: { backgroundColor: 'rgba(4, 8, 17, 0.95)' },
  heroBandFive: { backgroundColor: HOME_BASE },
  heroCopy: { width: 820, marginTop: 115, marginLeft: 78 },
  heroEyebrow: { color: '#E9C778', fontSize: 17, fontWeight: '700', letterSpacing: 4 },
  heroTitle: {
    marginTop: 18,
    color: '#F7F9FE',
    fontSize: 70,
    lineHeight: 75,
    fontWeight: '800',
  },
  heroMetadata: { marginTop: 18, color: '#DCE4F2', fontSize: 20, fontWeight: '700' },
  heroDescription: { marginTop: 16, color: '#C2CBDC', fontSize: 24, lineHeight: 34 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 28 },
  primaryButton: {
    minWidth: 180,
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    borderWidth: 4,
    borderColor: 'transparent',
    borderRadius: 12,
    backgroundColor: '#F7F9FE',
  },
  primaryButtonText: { color: '#070D1B', fontSize: 23, fontWeight: '800' },
  secondaryButton: {
    minWidth: 210,
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    backgroundColor: 'rgba(20, 31, 50, 0.9)',
  },
  secondaryButtonText: { color: '#F7F9FE', fontSize: 22, fontWeight: '700' },
  focusedButton: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.045 }],
    shadowColor: '#70D8FF',
    shadowOpacity: 0.38,
    shadowRadius: 12,
  },
  shelf: { marginTop: 34 },
  shelfScroll: { paddingHorizontal: 74, paddingVertical: 18 },
  shelfRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 20, overflow: 'visible' },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginLeft: 74,
    marginBottom: 2,
  },
  sectionTitle: { color: '#F7F9FE', fontSize: 31, fontWeight: '800' },
  sectionIcon: {
    width: 40,
    color: '#E9C778',
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
    fontWeight: '700',
  },
  filmIcon: {
    width: 40,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E9C778',
    borderRadius: 5,
  },
  filmPerforationLeft: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 5,
    width: 3,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#E9C778',
  },
  filmPerforationRight: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    right: 5,
    width: 3,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#E9C778',
  },
  filmPlay: { color: '#E9C778', fontSize: 12 },
  movieCard: {
    width: 286,
    paddingBottom: 12,
    borderWidth: 4,
    borderColor: 'transparent',
    borderRadius: 16,
    backgroundColor: '#0E1728',
    overflow: 'hidden',
  },
  focusedCard: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.045 }],
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.32,
    shadowRadius: 12,
  },
  movieArtwork: { height: 161, overflow: 'hidden' },
  movieArtworkField: {
    position: 'absolute',
    width: 240,
    height: 240,
    top: -110,
    right: -55,
    borderRadius: 120,
    opacity: 0.72,
  },
  movieArtworkGlow: {
    position: 'absolute',
    width: 90,
    height: 90,
    right: 30,
    bottom: -36,
    borderRadius: 45,
    opacity: 0.34,
  },
  movieCategory: { position: 'absolute', left: 18, top: 18, fontSize: 14, fontWeight: '800' },
  movieNumber: {
    position: 'absolute',
    right: 15,
    bottom: 10,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 31,
    fontWeight: '300',
  },
  movieTitle: {
    marginTop: 12,
    marginHorizontal: 14,
    color: '#F7F9FE',
    fontSize: 20,
    fontWeight: '700',
  },
  movieMeta: { marginTop: 5, marginHorizontal: 14, color: '#AAB7CE', fontSize: 14 },
  collectionCard: {
    width: 300,
    height: 170,
    justifyContent: 'flex-end',
    padding: 20,
    borderWidth: 4,
    borderColor: 'transparent',
    borderRadius: 16,
  },
  collectionIcon: { position: 'absolute', top: 18, left: 20, color: '#FFFFFF', fontSize: 36 },
  collectionTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  collectionMeta: { marginTop: 5, color: 'rgba(255,255,255,0.78)', fontSize: 15 },
  browseContent: {
    minHeight: '100%',
    paddingTop: 72,
    paddingBottom: 80,
    backgroundColor: HOME_BASE,
  },
  browseEyebrow: {
    marginLeft: 76,
    color: '#E9C778',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 4,
  },
  browseTitle: {
    marginTop: 12,
    marginLeft: 74,
    marginBottom: 22,
    color: '#F7F9FE',
    fontSize: 58,
    fontWeight: '800',
  },
  detailRoot: { flex: 1, overflow: 'hidden', backgroundColor: HOME_BASE },
  detailArtwork: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '58%' },
  detailArtworkField: {
    position: 'absolute',
    width: 900,
    height: 900,
    top: -280,
    right: -190,
    borderRadius: 450,
    opacity: 0.7,
  },
  detailArtworkGlow: {
    position: 'absolute',
    width: 480,
    height: 480,
    right: 40,
    bottom: -80,
    borderRadius: 240,
    opacity: 0.25,
  },
  detailScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(3, 5, 11, 0.54)',
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 64,
    zIndex: 4,
    minWidth: 128,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    borderRadius: 10,
    backgroundColor: 'rgba(17,28,51,0.92)',
  },
  backButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  detailCopy: { width: '58%', marginTop: 118, marginLeft: 76 },
  detailEyebrow: { color: '#E9C778', fontSize: 15, fontWeight: '700', letterSpacing: 3.5 },
  detailTitle: { marginTop: 15, color: '#FFFFFF', fontSize: 61, lineHeight: 66, fontWeight: '800' },
  detailMetadata: { marginTop: 14, color: '#E0E6F0', fontSize: 20, fontWeight: '700' },
  detailDescription: {
    marginTop: 16,
    maxWidth: 780,
    color: '#C2CBDC',
    fontSize: 22,
    lineHeight: 31,
  },
  resumeBlock: { width: 560, marginTop: 22 },
  progressTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#70D8FF' },
  resumeText: { marginTop: 9, color: '#D8E0EC', fontSize: 18, fontWeight: '600' },
  detailActions: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 24 },
});
