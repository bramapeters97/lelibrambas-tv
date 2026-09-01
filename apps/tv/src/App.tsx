import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type HlsInstance from 'hls.js';
import { installSpatialNavigation } from '@lelibrambas/navigation';
import {
  clampSeek,
  getStored,
  readProgress,
  SEEK_INTERVAL_SECONDS,
  setStored,
  shouldMarkComplete,
  writeProgress,
} from '@lelibrambas/shared';
import type { Collection, PlaybackProgress, Profile } from '@lelibrambas/types';
import {
  featuredCatalogue,
  loadCatalogue,
  profiles,
  type CatalogueVideoRecord,
  type LoadedCatalogue,
} from './catalogue';
import {
  ArtCard,
  CinemaIcon,
  CollectionsScreen,
  FullLibraryScreen,
  HubsScreen,
  NavigationRail,
  SearchScreen,
  SectionHeading,
  sectionIconForLabel,
  type BrowseScreenId,
} from './Discovery';
import { applyPosterFallback, resolvePlaybackSource, resolvePosterUrl } from './media';
import launchJingleUrl from '../assets/lelibrambas-plus-magical-app-launch-universal-192k.mp3';
import heroLogoUrl from '../../../lelibrambas_productions.png';

type Screen = 'ident' | 'profiles' | 'loading' | 'details' | 'player' | BrowseScreenId;

export const PROFILE_LOADING_DELAY_MS = 3000;
export const HERO_IDLE_DELAY_MS = 2000;
export const DETAILS_PREVIEW_DELAY_MS = 1000;
export const HOME_PREVIEW_START_SECONDS = 40;
export const DETAILS_PREVIEW_START_SECONDS = 120;
const MIN_PROGRESS_DURATION_SECONDS = 1;
const RELATED_VIDEO_ORDER_SEED = Math.random();

function relatedVideoOrder(currentId: string, candidateId: string): number {
  let hash = 2_166_136_261;
  for (const character of `${RELATED_VIDEO_ORDER_SEED}:${currentId}:${candidateId}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

type LegacyFullscreenVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>;
  unlock?: () => void;
};

function isMobileWebViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches;
}

async function lockMobileLandscape(): Promise<void> {
  try {
    const orientation = window.screen.orientation as LockableScreenOrientation | undefined;
    await orientation?.lock?.('landscape');
  } catch {
    // Unsupported or denied orientation locks should never interrupt playback.
  }
}

function prepareMobileLandscapePlayback(): void {
  if (!isMobileWebViewport() || document.fullscreenElement) return;
  const requestFullscreen = document.documentElement.requestFullscreen;
  if (!requestFullscreen) return;

  void requestFullscreen
    .call(document.documentElement)
    .then(lockMobileLandscape)
    .catch(() => undefined);
}

function releaseMobileLandscapePlayback(): void {
  if (!isMobileWebViewport()) return;
  try {
    const orientation = window.screen.orientation as LockableScreenOrientation | undefined;
    orientation?.unlock?.();
  } catch {
    // Some browsers unlock automatically while leaving fullscreen.
  }
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
}

async function requestMobileLandscapePlayback(
  playerScreen: HTMLElement | null,
  videoElement: HTMLVideoElement,
): Promise<void> {
  if (!isMobileWebViewport()) return;

  const legacyVideo = videoElement as LegacyFullscreenVideo;
  try {
    if (!document.fullscreenElement && playerScreen?.requestFullscreen) {
      await playerScreen.requestFullscreen();
    } else if (!document.fullscreenElement && legacyVideo.webkitEnterFullscreen) {
      legacyVideo.webkitEnterFullscreen();
    }
  } catch {
    try {
      legacyVideo.webkitEnterFullscreen?.();
    } catch {
      // Fullscreen and orientation support varies by mobile browser; playback must continue.
    }
  }

  await lockMobileLandscape();
}

export type PlaybackAvailability = {
  playable: boolean;
  eyebrow: string;
  title: string;
  description: string;
};

export function playbackAvailability(video: CatalogueVideoRecord): PlaybackAvailability {
  if (video.processingStatus === 'processing') {
    return {
      playable: false,
      eyebrow: 'VIEWING COPY IN PROGRESS',
      title: 'This memory is being prepared.',
      description: 'The source is safe. It will appear here when conversion and validation finish.',
    };
  }
  if (video.processingStatus === 'failed') {
    return {
      playable: false,
      eyebrow: 'VIEWING COPY NEEDS REVIEW',
      title: 'This memory needs a little attention.',
      description: 'The last conversion did not complete. Review the source in Cloudflare.',
    };
  }
  if (video.processingStatus === 'unavailable') {
    return {
      playable: false,
      eyebrow: 'TEMPORARILY UNAVAILABLE',
      title: 'This memory is resting off-screen.',
      description:
        'Its catalogue entry is preserved, but the private viewing copy is not available right now.',
    };
  }
  if (resolvePlaybackSource(video.streamVideoId).kind === 'unsupported') {
    return {
      playable: false,
      eyebrow: 'PLAYBACK SOURCE UNAVAILABLE',
      title: 'We could not find the viewing copy.',
      description: import.meta.env.DEV
        ? `Unrecognized playback URL for ${video.title} (catalogue ID ${video.catalogueId}).`
        : 'The archive record is intact. Check its media source in Cloudflare.',
    };
  }
  return {
    playable: true,
    eyebrow: 'READY TO PLAY',
    title: 'Ready to play',
    description: 'Private viewing copy available.',
  };
}

export function mediaSecondsForPresentation(
  seconds: number,
  presentationDuration: number,
  mediaDuration: number,
): number {
  if (!Number.isFinite(mediaDuration) || mediaDuration <= 0 || presentationDuration <= 0)
    return Math.max(0, seconds);
  return Math.max(0, Math.min(mediaDuration, (seconds / presentationDuration) * mediaDuration));
}

export function presentationSecondsForMedia(
  seconds: number,
  mediaDuration: number,
  presentationDuration: number,
): number {
  if (!Number.isFinite(mediaDuration) || mediaDuration <= 0 || presentationDuration <= 0)
    return Math.max(0, seconds);
  return Math.max(
    0,
    Math.min(presentationDuration, (seconds / mediaDuration) * presentationDuration),
  );
}

export function mediaSeekTarget(
  currentSeconds: number,
  deltaSeconds: number,
  durationSeconds: number | null,
): number {
  const current = Number.isFinite(currentSeconds) ? Math.max(0, currentSeconds) : 0;
  const duration = finitePositiveDuration(durationSeconds);
  return duration === null
    ? Math.max(0, current + deltaSeconds)
    : clampSeek(current, deltaSeconds, duration);
}

export function nextPlayableVideo(
  current: CatalogueVideoRecord,
  records: readonly CatalogueVideoRecord[],
): CatalogueVideoRecord | null {
  const playable = (candidate: CatalogueVideoRecord) =>
    candidate.id !== current.id &&
    playbackAvailability(candidate).playable &&
    candidate.visibility !== 'hidden';
  if (current.collectionId) {
    const episodes = records
      .filter((candidate) => candidate.collectionId === current.collectionId)
      .sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0));
    const currentIndex = episodes.findIndex((candidate) => candidate.id === current.id);
    const nextEpisode = episodes.slice(currentIndex + 1).find(playable);
    if (nextEpisode) return nextEpisode;
  }
  const currentIndex = records.findIndex((candidate) => candidate.id === current.id);
  return (
    [...records.slice(currentIndex + 1), ...records.slice(0, Math.max(0, currentIndex))].find(
      playable,
    ) ?? null
  );
}

export function knownDuration(video: CatalogueVideoRecord): number | null {
  return finitePositiveDuration(video.durationSeconds);
}

function finitePositiveDuration(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function progressFallbackDuration(video: CatalogueVideoRecord): number {
  return knownDuration(video) ?? Math.max(MIN_PROGRESS_DURATION_SECONDS, video.progressSeconds);
}

function progressFor(profile: Profile, video: CatalogueVideoRecord): PlaybackProgress {
  const duration = knownDuration(video);
  const stored = readProgress(profile.id, video.id, duration ?? progressFallbackDuration(video));
  const isStored = Date.parse(stored.updatedAt) > 0;
  if (isStored) return stored;
  const seconds = duration
    ? Math.min(duration, video.progressSeconds)
    : Math.max(0, video.progressSeconds);
  return {
    ...stored,
    seconds,
    durationSeconds: duration ?? progressFallbackDuration(video),
    completed: duration !== null && seconds >= duration * 0.94,
  };
}

export type RecentlyWatchedItem = {
  video: CatalogueVideoRecord;
  progress: PlaybackProgress;
};

export function recentlyWatchedFor(
  profile: Profile,
  catalogue: readonly CatalogueVideoRecord[],
): RecentlyWatchedItem[] {
  if (!getStored('remember-progress', true)) return [];
  return catalogue
    .map((video) => ({ video, progress: progressFor(profile, video) }))
    .filter(({ progress }) => progress.seconds > 0 && Date.parse(progress.updatedAt) > 0)
    .sort(
      (left, right) => Date.parse(right.progress.updatedAt) - Date.parse(left.progress.updatedAt),
    );
}

export function homeTrailerFor(catalogue: readonly CatalogueVideoRecord[]): CatalogueVideoRecord {
  const trailer =
    catalogue.find((item) => item.catalogueId === 36 && item.year === 2026) ??
    catalogue.find((item) => item.year === 2026 && /lelibrambas.*trailer/i.test(item.title));

  return trailer ?? catalogue[0]!;
}

function paletteStyle(video: CatalogueVideoRecord): React.CSSProperties {
  const [a, b, c] = video.artwork.palette;
  return { '--art-a': a, '--art-b': b, '--art-c': c } as React.CSSProperties;
}

function durationLabel(video: CatalogueVideoRecord): string | null {
  const duration = knownDuration(video);
  if (duration === null) return null;
  if (duration < 60) return `${Math.round(duration)} sec`;
  return `${Math.round(duration / 60)} min`;
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'wordmark compact' : 'wordmark'} aria-label="LELIBRAMBAS plus">
      LELIBRAMBAS<span>+</span>
    </div>
  );
}

function StudioIdent({ onDone }: { onDone: () => void }) {
  const capture = new URLSearchParams(location.search).get('capture') === '1';
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (capture) return;
    const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 5800;
    const timer = setTimeout(onDone, delay);
    return () => clearTimeout(timer);
  }, [capture, onDone]);

  useEffect(() => {
    if (capture) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.68;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [capture]);

  return (
    <main className="ident-screen" aria-label="LELIBRAMBAS+ private archive ident">
      <audio ref={audioRef} src={launchJingleUrl} preload="auto" autoPlay={!capture} />
      <div className="ident-lights" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
      <div className="ident-mark" aria-hidden="true">
        <CinemaIcon />
      </div>
      <div className="ident-copy">
        <h1>LELIBRAMBAS+</h1>
        <p>A private family archive</p>
      </div>
    </main>
  );
}

function ProfilePicker({ onSelect }: { onSelect: (profile: Profile) => void }) {
  return (
    <main className="profile-screen">
      <Wordmark />
      <div className="profile-heading">
        <p>Welcome to the family archive</p>
        <h1>Who’s watching?</h1>
      </div>
      <div className="profile-grid">
        {profiles.map((profile, index) => (
          <button
            key={profile.id}
            data-focusable
            data-focus-id={`profile-${profile.id}`}
            autoFocus={index === 0}
            className="profile-card"
            onClick={() => onSelect(profile)}
            style={{ '--profile-accent': profile.accent } as React.CSSProperties}
          >
            <span className="profile-avatar">
              <span>{profile.initials}</span>
              <i />
            </span>
            <strong>{profile.name}</strong>
            <small>{profile.pin ? 'PIN protected' : 'Ready to watch'}</small>
          </button>
        ))}
      </div>
      <footer>A private LELIBRAMBAS+ local media library</footer>
    </main>
  );
}

function ProfileLoading({
  profile,
  onDone,
  holdForCapture = false,
}: {
  profile: Profile;
  onDone: () => void;
  holdForCapture?: boolean;
}) {
  useEffect(() => {
    if (holdForCapture) return;
    const timer = window.setTimeout(onDone, PROFILE_LOADING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [holdForCapture, onDone]);

  return (
    <main
      className="profile-loading-screen"
      role="status"
      aria-live="polite"
      aria-label={`Opening ${profile.name}'s archive`}
    >
      <span className="profile-loading-spinner" aria-hidden="true">
        <CinemaIcon />
      </span>
    </main>
  );
}

function ActionButton({
  children,
  tone = 'primary',
  onClick,
  id,
  disabled = false,
  pressed,
}: {
  children: React.ReactNode;
  tone?: 'primary' | 'secondary' | 'quiet';
  onClick: () => void;
  id: string;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      {...(!disabled ? { 'data-focusable': true } : {})}
      data-focus-id={id}
      className={`action ${tone}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
    >
      {children}
    </button>
  );
}

function ProgressBar({ progress, duration }: { progress: number; duration: number | null }) {
  if (duration === null || !Number.isFinite(duration) || duration <= 0) return null;
  const percent = Math.min(100, (progress / duration) * 100);
  return (
    <span className="progress-track" aria-label={`${Math.round(percent)} percent watched`}>
      <i style={{ width: `${percent}%` }} />
    </span>
  );
}

function AmbientPreview({
  video,
  startSeconds,
  kind,
  className,
  onPlaying,
  onUnavailable,
  onEnded,
}: {
  video: CatalogueVideoRecord;
  startSeconds: number;
  kind: 'hero' | 'details';
  className: string;
  onPlaying: () => void;
  onUnavailable: () => void;
  onEnded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const source = useMemo(() => {
    const resolved = resolvePlaybackSource(video.streamVideoId);
    if (resolved.kind === 'iframe') {
      return {
        kind: 'hls' as const,
        url: resolved.directHlsUrl,
        originalUrl: resolved.originalUrl,
      };
    }
    return resolved.kind === 'hls' || resolved.kind === 'mp4'
      ? { kind: resolved.kind, url: resolved.url, originalUrl: resolved.originalUrl }
      : null;
  }, [video.streamVideoId]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !source) {
      onUnavailable();
      return;
    }
    const playbackElement = element;
    const playbackSource = source;

    let disposed = false;
    let attempted = false;
    let cued = false;
    let failed = false;
    let hls: HlsInstance | null = null;
    let cueTimeout: number | null = null;
    const clearCueTimeout = () => {
      if (cueTimeout !== null) window.clearTimeout(cueTimeout);
      cueTimeout = null;
    };
    const fail = () => {
      if (disposed || failed) return;
      failed = true;
      clearCueTimeout();
      playbackElement.pause();
      onUnavailable();
    };
    cueTimeout = window.setTimeout(fail, 12_000);
    const attemptPlayback = () => {
      if (attempted || disposed) return;
      if (!cued || playbackElement.currentTime < startSeconds - 0.5) {
        fail();
        return;
      }
      attempted = true;
      clearCueTimeout();
      playbackElement.muted = false;
      playbackElement.volume = 1;
      void playbackElement
        .play()
        .then(() => {
          if (!disposed) onPlaying();
        })
        .catch(fail);
    };
    const cuePlayback = () => {
      if (cued || failed || disposed) return;
      const mediaDuration = finitePositiveDuration(playbackElement.duration);
      if (mediaDuration === null) return;
      if (mediaDuration <= startSeconds + 0.25) {
        fail();
        return;
      }
      try {
        playbackElement.currentTime = startSeconds;
        cued = true;
        if (!playbackElement.seeking && playbackElement.currentTime >= startSeconds - 0.5) {
          attemptPlayback();
        }
      } catch {
        fail();
      }
    };
    const playAfterCue = () => {
      if (cued) attemptPlayback();
    };
    const reportPlaying = () => {
      if (!disposed && playbackElement.currentTime >= startSeconds - 0.5) onPlaying();
    };

    playbackElement.addEventListener('loadedmetadata', cuePlayback);
    playbackElement.addEventListener('durationchange', cuePlayback);
    playbackElement.addEventListener('seeked', playAfterCue);
    playbackElement.addEventListener('playing', reportPlaying);
    playbackElement.addEventListener('error', fail, { once: true });

    async function attachSource() {
      if (
        playbackSource.kind === 'mp4' ||
        playbackElement.canPlayType('application/vnd.apple.mpegurl')
      ) {
        playbackElement.src = playbackSource.url;
        playbackElement.load();
        return;
      }

      const { default: Hls } = await import('hls.js');
      if (disposed) return;
      if (!Hls.isSupported()) {
        fail();
        return;
      }
      hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 15 });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) fail();
      });
      hls.loadSource(playbackSource.url);
      hls.attachMedia(playbackElement);
    }

    void attachSource().catch(fail);
    return () => {
      disposed = true;
      clearCueTimeout();
      hls?.destroy();
      playbackElement.removeEventListener('loadedmetadata', cuePlayback);
      playbackElement.removeEventListener('durationchange', cuePlayback);
      playbackElement.removeEventListener('seeked', playAfterCue);
      playbackElement.removeEventListener('playing', reportPlaying);
      playbackElement.removeEventListener('error', fail);
      playbackElement.pause();
      playbackElement.removeAttribute('src');
      playbackElement.load();
    };
  }, [onPlaying, onUnavailable, source, startSeconds]);

  if (!source) return null;
  return (
    <video
      ref={videoRef}
      className={className}
      data-hero-media={kind === 'hero' ? 'trailer' : undefined}
      data-detail-media={kind === 'details' ? 'preview' : undefined}
      data-preview-start-seconds={startSeconds}
      data-stream-video-id={source.originalUrl}
      controls={false}
      playsInline
      preload="auto"
      tabIndex={-1}
      aria-hidden="true"
      onEnded={onEnded}
    />
  );
}

function useAmbientPreviewState(
  playable: boolean,
  idleDelayMs = HERO_IDLE_DELAY_MS,
  scrollThreshold = 48,
) {
  const captureMode = new URLSearchParams(location.search).get('capture') === '1';
  const [requested, setRequested] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const stop = useCallback(() => {
    setRequested(false);
    setPlaying(false);
  }, []);
  const markPlaying = useCallback(() => setPlaying(true), []);
  const reject = useCallback(() => {
    setBlocked(true);
    stop();
  }, [stop]);

  useEffect(() => {
    if (captureMode || blocked || !playable) return;
    let timer: number | null = null;
    const hasScrolledBeyondThreshold = () =>
      window.scrollY > scrollThreshold ||
      (document.querySelector<HTMLElement>('.details-screen')?.scrollTop ?? 0) > scrollThreshold;
    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const schedule = () => {
      clearTimer();
      if (requested || document.visibilityState !== 'visible' || hasScrolledBeyondThreshold())
        return;
      timer = window.setTimeout(() => setRequested(true), idleDelayMs);
    };
    const intentionalActivity = () => {
      if (requested) stop();
      else schedule();
    };
    const pointerActivity = () => {
      if (!requested) schedule();
    };
    const handleScroll = () => {
      if (hasScrolledBeyondThreshold()) {
        clearTimer();
        stop();
      } else if (!requested) schedule();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearTimer();
        stop();
      } else {
        schedule();
      }
    };

    schedule();
    window.addEventListener('pointerdown', intentionalActivity);
    window.addEventListener('pointermove', pointerActivity);
    window.addEventListener('keydown', intentionalActivity);
    window.addEventListener('touchstart', intentionalActivity, { passive: true });
    window.addEventListener('wheel', intentionalActivity, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearTimer();
      window.removeEventListener('pointerdown', intentionalActivity);
      window.removeEventListener('pointermove', pointerActivity);
      window.removeEventListener('keydown', intentionalActivity);
      window.removeEventListener('touchstart', intentionalActivity);
      window.removeEventListener('wheel', intentionalActivity);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, { capture: true });
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [blocked, captureMode, idleDelayMs, playable, requested, scrollThreshold, stop]);

  return {
    requested,
    playing,
    markPlaying,
    reject,
    state: playing ? 'playing' : requested ? 'loading' : 'poster',
  } as const;
}

function Home({
  catalogue,
  collections,
  profile,
  onDetails,
  onPlay,
  onNavigate,
  onOpenCollection,
  onReplayIntro,
  onProfile,
}: {
  catalogue: readonly CatalogueVideoRecord[];
  collections: readonly Collection[];
  profile: Profile;
  onDetails: (video: CatalogueVideoRecord) => void;
  onPlay: (video: CatalogueVideoRecord) => void;
  onNavigate: (screen: BrowseScreenId) => void;
  onOpenCollection: (collectionId: string) => void;
  onReplayIntro: () => void;
  onProfile: () => void;
}) {
  const hero = homeTrailerFor(catalogue);
  const heroAvailability = playbackAvailability(hero);
  const saved = progressFor(profile, hero);
  const resumeSeconds = saved.completed ? 0 : saved.seconds;
  const ambientPreview = useAmbientPreviewState(heroAvailability.playable);
  const trending = featuredCatalogue(catalogue);
  const recentlyWatched = useMemo(
    () => recentlyWatchedFor(profile, catalogue),
    [catalogue, profile],
  );

  return (
    <main className="tv-shell">
      <NavigationRail
        active="home"
        profile={profile}
        onNavigate={onNavigate}
        onReplayIntro={onReplayIntro}
        onProfile={onProfile}
      />
      <section className="home-content">
        <div className="hero" style={paletteStyle(hero)}>
          <div
            className={`hero-art${ambientPreview.playing ? ' is-playing' : ''}`}
            data-hero-state={ambientPreview.state}
            aria-hidden="true"
          >
            <img
              className="hero-poster"
              data-hero-media="poster"
              src={heroLogoUrl}
              alt=""
              onError={(event) => applyPosterFallback(event.currentTarget)}
            />
            {ambientPreview.requested && (
              <AmbientPreview
                video={hero}
                startSeconds={HOME_PREVIEW_START_SECONDS}
                kind="hero"
                className="hero-trailer"
                onPlaying={ambientPreview.markPlaying}
                onUnavailable={ambientPreview.reject}
                onEnded={ambientPreview.reject}
              />
            )}
          </div>
          <div className="hero-scrim" />
          <div className="hero-copy">
            <p className="studio-line">{hero.categories[0]}</p>
            <h1 className="hero-title">
              LELIBRAMBAS<span className="hero-title-plus">+</span> Trailer
            </h1>
            <div className="metadata">
              <span>{hero.year ?? 'Year unknown'}</span>
              <span>{hero.categories[0]}</span>
              {durationLabel(hero) && <span>{durationLabel(hero)}</span>}
              <span>{hero.location}</span>
            </div>
            <p>{hero.description}</p>
            {resumeSeconds > 0 && (
              <ProgressBar progress={resumeSeconds} duration={saved.durationSeconds} />
            )}
            <div className="hero-actions">
              <ActionButton
                id="hero-play"
                disabled={!heroAvailability.playable}
                onClick={() => onPlay(hero)}
              >
                {heroAvailability.playable ? 'Play Trailer' : 'Trailer unavailable'}
              </ActionButton>
              <ActionButton id="hero-info" tone="secondary" onClick={() => onDetails(hero)}>
                More information
              </ActionButton>
            </div>
          </div>
          <div className="hero-pagination">
            <i className="active" />
            <i />
            <i />
          </div>
        </div>
        <section className="home-hubs-strip" data-home-rail="collections">
          <div className="rail-heading">
            <SectionHeading icon="collections">Collections</SectionHeading>
            <span>{collections.length} folder categories</span>
          </div>
          <div className="home-hubs-row">
            {collections.map((collection, index) => (
              <button
                key={collection.id}
                data-focusable
                data-focus-id={`home-hub-${collection.id}`}
                onClick={() => onOpenCollection(collection.id)}
              >
                <i>{String(index + 1).padStart(2, '0')}</i>
                <span>
                  <small>LELIBRAMBAS+</small>
                  <strong>{collection.title}</strong>
                </span>
              </button>
            ))}
          </div>
        </section>
        {recentlyWatched.length > 0 && (
          <section className="rail-section home-multi-rail" data-home-rail="recently-watched">
            <div className="rail-heading">
              <SectionHeading icon="movies">Recently watched</SectionHeading>
              <span>{recentlyWatched.length} titles</span>
            </div>
            <div className="card-rail">
              {recentlyWatched.map(({ video: item, progress }, index) => (
                <ArtCard
                  key={item.catalogueId}
                  video={item}
                  index={index}
                  onSelect={onDetails}
                  onPlay={onPlay}
                  mobilePrimaryPlay
                  progress={{
                    seconds: progress.seconds,
                    durationSeconds: progress.durationSeconds,
                  }}
                />
              ))}
            </div>
          </section>
        )}
        <section className="rail-section home-multi-rail" data-home-rail="currently-trending">
          <div className="rail-heading">
            <SectionHeading icon="trending">Currently Trending</SectionHeading>
            <span>{trending.length} titles</span>
          </div>
          <div className="card-rail">
            {trending.map((item, index) => (
              <ArtCard
                key={item.catalogueId}
                video={item}
                index={index}
                onSelect={onDetails}
                onPlay={onPlay}
                mobilePrimaryPlay
              />
            ))}
          </div>
        </section>
        {collections.map((collection) => {
          const videos = collection.videoIds
            .map((id) => catalogue.find((item) => item.id === id))
            .filter((item): item is CatalogueVideoRecord => Boolean(item));
          return (
            <section
              key={collection.id}
              className="rail-section home-multi-rail"
              data-home-rail={collection.id}
            >
              <div className="rail-heading">
                <SectionHeading icon={sectionIconForLabel(collection.title)}>
                  {collection.title}
                </SectionHeading>
                <span>{videos.length} titles</span>
              </div>
              <div className="card-rail">
                {videos.map((item, index) => (
                  <ArtCard
                    key={item.catalogueId}
                    video={item}
                    index={index}
                    onSelect={onDetails}
                    onPlay={onPlay}
                    mobilePrimaryPlay
                  />
                ))}
              </div>
            </section>
          );
        })}
        <section className="rail-section home-multi-rail" data-home-rail="all-movies">
          <div className="rail-heading">
            <SectionHeading icon="movies">All movies</SectionHeading>
            <span>{catalogue.length} titles</span>
          </div>
          <div className="poster-grid all-movies-grid" data-all-movies-grid>
            {catalogue.map((item, index) => (
              <ArtCard
                key={item.catalogueId}
                video={item}
                index={index}
                onSelect={onDetails}
                onPlay={onPlay}
                mobilePrimaryPlay
              />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function Details({
  catalogue,
  video,
  profile,
  onBack,
  onPlay,
  onSelectRelated,
}: {
  catalogue: readonly CatalogueVideoRecord[];
  video: CatalogueVideoRecord;
  profile: Profile;
  onBack: () => void;
  onPlay: (video: CatalogueVideoRecord) => void;
  onSelectRelated: (video: CatalogueVideoRecord) => void;
}) {
  const [saved, setSaved] = useState(() => progressFor(profile, video));
  const resumeSeconds = saved.completed ? 0 : saved.seconds;
  const duration = knownDuration(video);
  const availability = playbackAvailability(video);
  const ambientPreview = useAmbientPreviewState(availability.playable, DETAILS_PREVIEW_DELAY_MS);
  const relatedVideos = useMemo(
    () =>
      catalogue
        .filter(
          (candidate) =>
            candidate.id !== video.id &&
            candidate.available &&
            candidate.categories.some((category) => video.categories.includes(category)),
        )
        .map((candidate) => ({
          candidate,
          order: relatedVideoOrder(video.id, candidate.id),
        }))
        .sort((left, right) => left.order - right.order)
        .slice(0, 4)
        .map(({ candidate }) => candidate),
    [catalogue, video],
  );
  useEffect(() => setSaved(progressFor(profile, video)), [profile, video]);
  const savePosition = (seconds: number, completed: boolean) => {
    const progress = {
      profileId: profile.id,
      videoId: video.id,
      seconds,
      durationSeconds: duration ?? Math.max(saved.durationSeconds, seconds, 1),
      completed,
      updatedAt: new Date().toISOString(),
    };
    writeProgress(progress);
    setSaved(progress);
  };
  return (
    <main className="details-screen" style={paletteStyle(video)}>
      <div
        className={`details-art${ambientPreview.playing ? ' is-playing' : ''}`}
        data-detail-preview-state={ambientPreview.state}
        aria-hidden="true"
      >
        <img
          src={resolvePosterUrl(video.posterUrl)}
          alt=""
          onError={(event) => applyPosterFallback(event.currentTarget)}
        />
        {ambientPreview.requested && (
          <AmbientPreview
            video={video}
            startSeconds={DETAILS_PREVIEW_START_SECONDS}
            kind="details"
            className="details-preview"
            onPlaying={ambientPreview.markPlaying}
            onUnavailable={ambientPreview.reject}
            onEnded={ambientPreview.reject}
          />
        )}
        <span>{video.location}</span>
      </div>
      <div className="details-scrim" />
      <button
        data-focusable
        data-focus-id="details-back"
        className="round-back"
        onClick={onBack}
        aria-label="Back"
      >
        ←
      </button>
      <section className="details-copy">
        <p className="studio-line">LELIBRAMBAS+ catalogue</p>
        <h1 className="details-title">{video.title}</h1>
        <p className="subtitle">{video.subtitle}</p>
        <div className="metadata">
          <span>{video.year ?? 'Year unknown'}</span>
          {durationLabel(video) && <span>{durationLabel(video)}</span>}
          <span>{video.location}</span>
          {video.aspectRatio !== 'unknown' && <span className="format">{video.aspectRatio}</span>}
        </div>
        <p className="synopsis">{video.description}</p>
        {!availability.playable && (
          <div className={`availability-banner status-${video.processingStatus}`} role="status">
            <strong>{availability.eyebrow}</strong>
            <span>{availability.description}</span>
          </div>
        )}
        <div className="hero-actions">
          <ActionButton
            id="detail-play"
            disabled={!availability.playable}
            onClick={() => onPlay(video)}
          >
            {availability.playable ? (resumeSeconds > 0 ? 'Resume' : 'Play') : availability.title}
          </ActionButton>
          <ActionButton
            id="detail-restart"
            disabled={!availability.playable}
            tone="secondary"
            onClick={() => {
              savePosition(0, false);
              onPlay(video);
            }}
          >
            Restart
          </ActionButton>
          <ActionButton
            id="detail-watched"
            tone="quiet"
            pressed={saved.completed}
            onClick={() => savePosition(duration ?? Math.max(saved.seconds, 1), true)}
          >
            {saved.completed ? 'Watched' : 'Mark watched'}
          </ActionButton>
        </div>
        {resumeSeconds > 0 && (
          <div className="resume-row">
            <ProgressBar progress={resumeSeconds} duration={duration ?? saved.durationSeconds} />
            <span>
              Resume at {Math.floor(resumeSeconds / 60)}:
              {String(Math.floor(resumeSeconds % 60)).padStart(2, '0')}
            </span>
          </div>
        )}
        <dl>
          <div>
            <dt>Recorded</dt>
            <dd>
              {video.recordingDate ?? 'Date unknown'}
              {video.dateApproximate ? ' (approx.)' : ''}
            </dd>
          </div>
          <div>
            <dt>Featuring</dt>
            <dd>{video.people.join(', ') || 'Not tagged yet'}</dd>
          </div>
          <div>
            <dt>From</dt>
            <dd>{[video.location, video.country].filter(Boolean).join(', ') || 'Place unknown'}</dd>
          </div>
          {video.restorationNotes && (
            <div>
              <dt>Archive note</dt>
              <dd>{video.restorationNotes}</dd>
            </div>
          )}
        </dl>
        <div className="detail-discovery">
          <span>Related collection - {video.collectionId ?? 'Standalone film'}</span>
          <span>More from {video.year ?? 'this era'}</span>
          <span>{video.tags.slice(0, 3).join(' - ') || 'No tags yet'}</span>
        </div>
        {relatedVideos.length > 0 && (
          <div className="mobile-related-videos" aria-label="Related videos">
            {relatedVideos.map((related) => (
              <button
                key={related.id}
                type="button"
                onClick={() => onSelectRelated(related)}
                aria-label={`Open ${related.title}`}
              >
                <img
                  src={resolvePosterUrl(related.posterUrl)}
                  alt=""
                  loading="lazy"
                  onError={(event) => applyPosterFallback(event.currentTarget)}
                />
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Player({
  catalogue,
  video,
  profile,
  onBack,
  onPlayNext,
}: {
  catalogue: readonly CatalogueVideoRecord[];
  video: CatalogueVideoRecord;
  profile: Profile;
  onBack: () => void;
  onPlayNext: (video: CatalogueVideoRecord) => void;
}) {
  const playerScreenRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const persistenceTimer = useRef<number | null>(null);
  const dirty = useRef(false);
  const catalogueDurationSeconds = knownDuration(video);
  const saved = progressFor(profile, video);
  const initialSeconds = saved.completed ? 0 : saved.seconds;
  const currentRef = useRef(initialSeconds);
  const availability = playbackAvailability(video);
  const playbackSource = useMemo(
    () =>
      resolvePlaybackSource(video.streamVideoId, {
        autoplay: true,
        preferDirectHls: true,
      }),
    [video.streamVideoId],
  );
  const nextVideo = useMemo(() => nextPlayableVideo(video, catalogue), [catalogue, video]);
  const forcedPlayerState = new URLSearchParams(location.search).get('playerState');
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(initialSeconds);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState(forcedPlayerState === 'error');
  const [ended, setEnded] = useState(forcedPlayerState === 'up-next');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [mediaDurationSeconds, setMediaDurationSeconds] = useState<number | null>(null);
  const persistedDurationSeconds =
    Date.parse(saved.updatedAt) > 0 ? finitePositiveDuration(saved.durationSeconds) : null;
  const progressDurationSeconds =
    catalogueDurationSeconds ??
    mediaDurationSeconds ??
    persistedDurationSeconds ??
    MIN_PROGRESS_DURATION_SECONDS;
  const displayedDurationSeconds = catalogueDurationSeconds ?? mediaDurationSeconds;

  useEffect(() => {
    const element = videoRef.current;
    const source = playbackSource.url;
    if (
      !element ||
      !source ||
      !['hls', 'mp4'].includes(playbackSource.kind) ||
      !availability.playable ||
      error
    )
      return;

    let disposed = false;
    let hls: HlsInstance | null = null;
    let networkRecoveryAttempted = false;
    let mediaRecoveryAttempted = false;
    const failPlayback = () => {
      if (disposed) return;
      setPlaying(false);
      setError(true);
    };

    async function attachSource(playbackElement: HTMLVideoElement, sourceUrl: string) {
      if (playbackSource.kind === 'mp4') {
        playbackElement.src = sourceUrl;
        return;
      }
      if (playbackElement.canPlayType('application/vnd.apple.mpegurl')) {
        playbackElement.src = sourceUrl;
        return;
      }

      const { default: Hls } = await import('hls.js');
      if (disposed) return;
      if (!Hls.isSupported()) {
        failPlayback();
        return;
      }

      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !networkRecoveryAttempted) {
          networkRecoveryAttempted = true;
          hls?.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecoveryAttempted) {
          mediaRecoveryAttempted = true;
          hls?.recoverMediaError();
          return;
        }
        failPlayback();
      });
      hls.loadSource(sourceUrl);
      hls.attachMedia(playbackElement);
    }

    void attachSource(element, source).catch(failPlayback);

    return () => {
      disposed = true;
      hls?.destroy();
      element.pause();
      element.removeAttribute('src');
      element.load();
    };
  }, [availability.playable, error, playbackSource]);

  const persistAt = useCallback(
    (seconds: number, completed = shouldMarkComplete(seconds, progressDurationSeconds)) => {
      if (!getStored('remember-progress', true)) return;
      writeProgress({
        profileId: profile.id,
        videoId: video.id,
        seconds: clampSeek(0, seconds, progressDurationSeconds),
        durationSeconds: progressDurationSeconds,
        completed,
        updatedAt: new Date().toISOString(),
      });
    },
    [profile.id, progressDurationSeconds, video.id],
  );

  const flushProgress = useCallback(
    (completed = false) => {
      if (persistenceTimer.current !== null) {
        window.clearTimeout(persistenceTimer.current);
        persistenceTimer.current = null;
      }
      if (!dirty.current && !completed) return;
      const seconds = completed ? progressDurationSeconds : currentRef.current;
      persistAt(seconds, completed || shouldMarkComplete(seconds, progressDurationSeconds));
      dirty.current = false;
    },
    [persistAt, progressDurationSeconds],
  );

  const scheduleProgress = useCallback(() => {
    if (persistenceTimer.current !== null) window.clearTimeout(persistenceTimer.current);
    persistenceTimer.current = window.setTimeout(() => flushProgress(), 900);
  }, [flushProgress]);

  const setPresentationTime = useCallback(
    (seconds: number, duration = progressDurationSeconds) => {
      const safeSeconds = clampSeek(0, seconds, duration);
      currentRef.current = safeSeconds;
      setCurrent(safeSeconds);
    },
    [progressDurationSeconds],
  );

  const seek = useCallback(
    (seconds: number) => {
      const element = videoRef.current;
      if (!element || !availability.playable) return;
      const target = clampSeek(0, seconds, progressDurationSeconds);
      element.currentTime = mediaSecondsForPresentation(
        target,
        progressDurationSeconds,
        element.duration,
      );
      setPresentationTime(target);
      dirty.current = true;
      scheduleProgress();
    },
    [availability.playable, progressDurationSeconds, scheduleProgress, setPresentationTime],
  );

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const element = videoRef.current;
      if (!element || !availability.playable) return;
      const mediaDuration = finitePositiveDuration(element.duration);
      const mediaCurrent = Number.isFinite(element.currentTime) ? element.currentTime : 0;
      const mediaTarget = mediaSeekTarget(mediaCurrent, deltaSeconds, mediaDuration);
      element.currentTime = mediaTarget;
      const presentationDuration =
        catalogueDurationSeconds ?? mediaDuration ?? progressDurationSeconds;
      const presentationTarget =
        mediaDuration === null
          ? clampSeek(0, mediaTarget, presentationDuration)
          : presentationSecondsForMedia(mediaTarget, mediaDuration, presentationDuration);
      setPresentationTime(presentationTarget, presentationDuration);
      dirty.current = true;
      scheduleProgress();
    },
    [
      availability.playable,
      catalogueDurationSeconds,
      progressDurationSeconds,
      scheduleProgress,
      setPresentationTime,
    ],
  );

  const toggle = useCallback(async () => {
    const element = videoRef.current;
    if (!element || !availability.playable || ended) return;
    try {
      if (element.paused) await element.play();
      else element.pause();
    } catch {
      setPlaying(false);
      setError(true);
    }
  }, [availability.playable, ended]);

  const leave = useCallback(() => {
    flushProgress();
    onBack();
  }, [flushProgress, onBack]);

  const toggleMuted = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    const nextMuted = !element.muted;
    element.muted = nextMuted;
    setMuted(nextMuted);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const screen = playerScreenRef.current;
    if (!screen) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (screen.requestFullscreen) {
        await screen.requestFullscreen();
      } else {
        const legacyVideo = videoRef.current as
          | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
          | null;
        legacyVideo?.webkitEnterFullscreen?.();
      }
    } catch {
      const legacyVideo = videoRef.current as
        | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
        | null;
      legacyVideo?.webkitEnterFullscreen?.();
    }
  }, []);

  useEffect(
    () => () => {
      flushProgress();
      releaseMobileLandscapePlayback();
    },
    [flushProgress],
  );

  useEffect(() => {
    const updateFullscreenState = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);

  useEffect(() => {
    const saveBeforeLeaving = () => flushProgress();
    const saveWhenHidden = () => {
      if (document.visibilityState === 'hidden') flushProgress();
    };
    window.addEventListener('pagehide', saveBeforeLeaving);
    document.addEventListener('visibilitychange', saveWhenHidden);
    return () => {
      window.removeEventListener('pagehide', saveBeforeLeaving);
      document.removeEventListener('visibilitychange', saveWhenHidden);
    };
  }, [flushProgress]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement;
      const isTextInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isTextInput) return;
      const key = event.key.toLowerCase();
      const isNativeButtonSpace = event.code === 'Space' && target.tagName === 'BUTTON';
      if (key === 'p' || (event.code === 'Space' && !isNativeButtonSpace)) {
        event.preventDefault();
        void toggle();
      } else if (key === 'm' && availability.playable) {
        event.preventDefault();
        setMuted((value) => !value);
      } else if (key === 'r' && availability.playable) {
        event.preventDefault();
        setEnded(false);
        seek(0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [availability.playable, seek, toggle]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get('capture') === '1') return;
    let timer = window.setTimeout(() => setControlsVisible(false), 4200);
    const reveal = () => {
      setControlsVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setControlsVisible(false), 4200);
    };
    window.addEventListener('mousemove', reveal);
    window.addEventListener('keydown', reveal);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousemove', reveal);
      window.removeEventListener('keydown', reveal);
    };
  }, []);

  const format = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const progressPercent = Math.min(100, (current / progressDurationSeconds) * 100);
  const playerState = error
    ? {
        eyebrow: 'PLAYBACK INTERRUPTED',
        title: 'We couldn’t play this memory.',
        description: import.meta.env.DEV
          ? `Playback failed for ${video.title} (catalogue ID ${video.catalogueId}).`
          : 'The original is safe. Retry the viewing copy, or return to its details.',
      }
    : playbackSource.kind === 'unsupported' && import.meta.env.DEV
      ? {
          ...availability,
          description: `Unrecognized playback URL for ${video.title} (catalogue ID ${video.catalogueId}).`,
        }
      : availability;

  return (
    <main
      ref={playerScreenRef}
      className={`player-screen ${video.aspectRatio === '4:3' ? 'archive-43' : ''}`}
      style={paletteStyle(video)}
    >
      {!error &&
        availability.playable &&
        (playbackSource.kind === 'hls' || playbackSource.kind === 'mp4') && (
          <video
            ref={videoRef}
            data-catalogue-id={video.catalogueId}
            data-stream-video-id={playbackSource.originalUrl}
            data-playback-url={playbackSource.url}
            autoPlay
            muted={muted}
            playsInline={!isMobileWebViewport()}
            onLoadedMetadata={(event) => {
              const loadedDuration = finitePositiveDuration(event.currentTarget.duration);
              if (loadedDuration !== null) setMediaDurationSeconds(loadedDuration);
              const presentationDuration =
                catalogueDurationSeconds ?? loadedDuration ?? progressDurationSeconds;
              if (initialSeconds > 0) {
                event.currentTarget.currentTime = mediaSecondsForPresentation(
                  initialSeconds,
                  presentationDuration,
                  event.currentTarget.duration,
                );
              }
            }}
            onPlay={(event) => {
              setPlaying(true);
              void requestMobileLandscapePlayback(playerScreenRef.current, event.currentTarget);
            }}
            onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
            onPause={() => {
              setPlaying(false);
              flushProgress();
            }}
            onTimeUpdate={(event) => {
              const loadedDuration = finitePositiveDuration(event.currentTarget.duration);
              if (loadedDuration !== null && loadedDuration !== mediaDurationSeconds) {
                setMediaDurationSeconds(loadedDuration);
              }
              const presentationDuration =
                catalogueDurationSeconds ?? loadedDuration ?? progressDurationSeconds;
              const seconds = presentationSecondsForMedia(
                event.currentTarget.currentTime,
                event.currentTarget.duration,
                presentationDuration,
              );
              setPresentationTime(seconds, presentationDuration);
              dirty.current = true;
              scheduleProgress();
            }}
            onEnded={() => {
              setPlaying(false);
              setEnded(true);
              setPresentationTime(progressDurationSeconds);
              dirty.current = true;
              flushProgress(true);
            }}
            onError={() => {
              setPlaying(false);
              setError(true);
              flushProgress();
            }}
          />
        )}
      {!error && availability.playable && playbackSource.kind === 'iframe' && (
        <div className="stream-iframe-shell">
          <iframe
            className="stream-iframe"
            src={playbackSource.url}
            title={`${video.title} player`}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="no-referrer"
            data-catalogue-id={video.catalogueId}
            data-stream-video-id={playbackSource.originalUrl}
          />
          <button
            className="stream-iframe-back"
            data-focusable
            data-focus-id="player-back"
            onClick={leave}
            aria-label="Back to details"
          >
            &larr;
          </button>
        </div>
      )}
      <div className="player-ambient" aria-hidden="true" />
      <div className="player-vignette" />
      {(error || !availability.playable) && (
        <section className={`playback-error status-${video.processingStatus}`} role="alert">
          <span>{playerState.eyebrow}</span>
          <h1>{playerState.title}</h1>
          <p>{playerState.description}</p>
          <div className="player-state-actions">
            {error && (
              <ActionButton id="retry" onClick={() => setError(false)}>
                Retry playback
              </ActionButton>
            )}
            <ActionButton
              id="player-state-back"
              tone={error ? 'secondary' : 'primary'}
              onClick={leave}
            >
              Back to details
            </ActionButton>
          </div>
        </section>
      )}
      {ended && !error && availability.playable && (
        <section className="up-next-panel" aria-live="polite">
          <p>{nextVideo ? 'UP NEXT' : 'PRESENTATION COMPLETE'}</p>
          {nextVideo ? (
            <>
              <div className="up-next-art" style={paletteStyle(nextVideo)}>
                <img
                  src={resolvePosterUrl(nextVideo.posterUrl)}
                  alt=""
                  onError={(event) => applyPosterFallback(event.currentTarget)}
                />
                <span>{nextVideo.location ?? 'The family archive'}</span>
              </div>
              <h1>{nextVideo.title}</h1>
              <div className="metadata">
                <span>{nextVideo.year ?? 'Date unknown'}</span>
                {durationLabel(nextVideo) && <span>{durationLabel(nextVideo)}</span>}
                {nextVideo.aspectRatio !== 'unknown' && <span>{nextVideo.aspectRatio}</span>}
              </div>
              <div className="hero-actions">
                <ActionButton
                  id="play-next"
                  onClick={() => {
                    flushProgress(true);
                    onPlayNext(nextVideo);
                  }}
                >
                  ▶ Play next
                </ActionButton>
                <ActionButton id="up-next-back" tone="secondary" onClick={leave}>
                  Back to details
                </ActionButton>
              </div>
            </>
          ) : (
            <>
              <h1>That’s all for this chapter.</h1>
              <p>The memory has been marked as watched.</p>
              <ActionButton id="up-next-back" onClick={leave}>
                Back to details
              </ActionButton>
            </>
          )}
        </section>
      )}
      {!error &&
        availability.playable &&
        !ended &&
        (playbackSource.kind === 'hls' || playbackSource.kind === 'mp4') && (
          <div className={`player-overlay ${controlsVisible ? 'visible' : 'hidden'}`}>
            <div className="player-top">
              <button
                data-focusable
                data-focus-id="player-back"
                onClick={leave}
                aria-label="Back to details"
              >
                &larr;
              </button>
              <div>
                <p>{video.title}</p>
                <span>{video.collectionId ? 'Episode presentation' : 'Family archive'}</span>
              </div>
              <span className="quality">AUTO · {video.resolution}</span>
            </div>
            <div className="player-bottom">
              <div className="timeline">
                <i style={{ width: `${progressPercent}%` }} />
                <b style={{ left: `${progressPercent}%` }} />
                <input
                  data-focusable
                  data-focus-id="timeline"
                  type="range"
                  min={0}
                  max={progressDurationSeconds}
                  step={0.1}
                  value={current}
                  onChange={(event) => seek(Number(event.currentTarget.value))}
                  onKeyDown={(event) => {
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                      event.stopPropagation();
                    }
                  }}
                  aria-label="Playback position"
                  aria-valuetext={`${format(current)} of ${
                    displayedDurationSeconds === null
                      ? 'an unknown duration'
                      : format(displayedDurationSeconds)
                  }`}
                />
              </div>
              <div className="player-times">
                <span>{format(current)}</span>
                <span>
                  {displayedDurationSeconds === null
                    ? 'Duration unavailable'
                    : `−${format(Math.max(0, displayedDurationSeconds - current))}`}
                </span>
              </div>
              <div className="player-controls">
                <button
                  data-focusable
                  data-focus-id="mute"
                  onClick={toggleMuted}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  aria-pressed={muted}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M4 9h4l5-4v14l-5-4H4z" />
                    {muted ? (
                      <>
                        <path d="m17 9 4 6" />
                        <path d="m21 9-4 6" />
                      </>
                    ) : (
                      <>
                        <path d="M16 9.5a4 4 0 0 1 0 5" />
                        <path d="M18.5 7a7.5 7.5 0 0 1 0 10" />
                      </>
                    )}
                  </svg>
                </button>
                <button
                  data-focusable
                  data-focus-id="rewind"
                  onClick={() => seekBy(-SEEK_INTERVAL_SECONDS)}
                  aria-label="Skip back 10 seconds"
                >
                  ↶<small>10</small>
                </button>
                <button
                  data-focusable
                  data-focus-id="play-pause"
                  autoFocus
                  className="play-toggle"
                  onClick={() => void toggle()}
                  aria-label={playing ? 'Pause' : 'Play'}
                >
                  {playing ? 'Ⅱ' : '▶'}
                </button>
                <button
                  data-focusable
                  data-focus-id="forward"
                  onClick={() => seekBy(SEEK_INTERVAL_SECONDS)}
                  aria-label="Skip forward 10 seconds"
                >
                  ↷<small>10</small>
                </button>
                <button
                  data-focusable
                  data-focus-id="fullscreen"
                  onClick={() => void toggleFullscreen()}
                  aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  aria-pressed={fullscreen}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M8 3H3v5" />
                    <path d="M16 3h5v5" />
                    <path d="M8 21H3v-5" />
                    <path d="M16 21h5v-5" />
                  </svg>
                </button>
                <span>
                  {video.aspectRatio === '4:3' ? 'Original 4:3 · Pillarboxed' : 'Original aspect'} ·
                  Subtitles off · {muted ? 'Audio muted' : 'Audio original'}
                </span>
              </div>
            </div>
          </div>
        )}
    </main>
  );
}

function ViewerApp({ catalogue, collections }: LoadedCatalogue) {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const forced = params.get('screen') as Screen | null;
  const captureMode = params.get('capture') === '1';
  const initial: Screen = forced ?? 'ident';
  const [screen, setScreen] = useState<Screen>(initial);
  const [profile, setProfile] = useState<Profile>(
    () => profiles.find((item) => item.id === getStored('profile-id', 'family')) ?? profiles[2]!,
  );
  const [video, setVideo] = useState<CatalogueVideoRecord>(() => {
    const requested = params.get('video');
    return (
      catalogue.find((item) => item.id === requested || item.slug === requested) ?? catalogue[0]!
    );
  });
  const [selectedCollectionId, setSelectedCollectionId] = useState(collections[0]!.id);
  const screenRef = useRef<Screen>(initial);
  const history = useRef<Array<{ screen: Screen; focusId: string | null }>>([]);
  const pendingFocusId = useRef<string | null>(null);

  const transitionToScreen = useCallback((next: Screen) => {
    const update = () => flushSync(() => setScreen(next));
    const transitionDocument = document as TransitionDocument;
    if (
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !transitionDocument.startViewTransition
    ) {
      update();
      return;
    }
    void transitionDocument.startViewTransition(update).finished.catch(() => undefined);
  }, []);

  const replaceScreen = useCallback(
    (next: Screen) => {
      screenRef.current = next;
      pendingFocusId.current = null;
      transitionToScreen(next);
    },
    [transitionToScreen],
  );

  const go = useCallback(
    (next: Screen) => {
      const currentScreen = screenRef.current;
      if (next === currentScreen) return;
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      history.current.push({ screen: currentScreen, focusId: active?.dataset.focusId ?? null });
      screenRef.current = next;
      pendingFocusId.current = null;
      transitionToScreen(next);
    },
    [transitionToScreen],
  );

  const back = useCallback(() => {
    const previous = history.current.pop();
    const next = previous?.screen ?? 'home';
    if (next === screenRef.current && !previous) return;
    screenRef.current = next;
    pendingFocusId.current = previous?.focusId ?? null;
    transitionToScreen(next);
  }, [transitionToScreen]);

  const openProfiles = useCallback(() => {
    history.current = [];
    screenRef.current = 'profiles';
    pendingFocusId.current = null;
    transitionToScreen('profiles');
  }, [transitionToScreen]);

  const replayIntro = useCallback(() => {
    history.current = [];
    screenRef.current = 'ident';
    pendingFocusId.current = null;
    transitionToScreen('ident');
  }, [transitionToScreen]);

  useEffect(() => installSpatialNavigation(document.body, back), [back]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const focusables = [
        ...document.querySelectorAll<HTMLElement>('[data-focusable]:not([disabled])'),
      ];
      const restored = pendingFocusId.current
        ? focusables.find((element) => element.dataset.focusId === pendingFocusId.current)
        : undefined;
      pendingFocusId.current = null;
      const preferred =
        restored ?? document.querySelector<HTMLElement>('[autofocus]') ?? focusables[0];
      preferred?.focus({ preventScroll: true });
      if (restored) restored.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [screen, video.id]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTextInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (
        !event.repeat &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        event.key.toLowerCase() === 's' &&
        screen !== 'player' &&
        screen !== 'search' &&
        !isTextInput
      ) {
        event.preventDefault();
        go('search');
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [go, screen]);
  const transitionKey =
    screen === 'details' || screen === 'player' ? `${screen}:${video.id}` : screen;
  const useFallbackTransition =
    !matchMedia('(prefers-reduced-motion: reduce)').matches &&
    !(document as TransitionDocument).startViewTransition;
  const renderScreen = (content: React.ReactNode) => (
    <div
      className={`screen-transition${useFallbackTransition ? ' screen-transition-fallback' : ''}`}
      data-screen={screen}
      key={transitionKey}
    >
      {content}
    </div>
  );
  if (screen === 'ident')
    return renderScreen(
      <StudioIdent
        onDone={() => {
          replaceScreen('profiles');
        }}
      />,
    );
  if (screen === 'profiles')
    return renderScreen(
      <ProfilePicker
        onSelect={(next) => {
          setProfile(next);
          setStored('profile-id', next.id);
          if (captureMode && forced !== 'loading') replaceScreen('home');
          else replaceScreen('loading');
        }}
      />,
    );
  if (screen === 'loading')
    return renderScreen(
      <ProfileLoading
        profile={profile}
        holdForCapture={captureMode && forced === 'loading'}
        onDone={() => replaceScreen('home')}
      />,
    );
  if (screen === 'details')
    return renderScreen(
      <Details
        catalogue={catalogue}
        video={video}
        profile={profile}
        onBack={back}
        onPlay={(next) => {
          prepareMobileLandscapePlayback();
          setVideo(next);
          go('player');
        }}
        onSelectRelated={setVideo}
      />,
    );
  if (screen === 'player')
    return renderScreen(
      <Player
        catalogue={catalogue}
        video={video}
        profile={profile}
        onBack={back}
        onPlayNext={setVideo}
      />,
    );
  const onNavigate = (next: BrowseScreenId) => go(next);
  const onPlay = (next: CatalogueVideoRecord) => {
    prepareMobileLandscapePlayback();
    setVideo(next);
    go('player');
  };
  const onDetails = (next: CatalogueVideoRecord) => {
    setVideo(next);
    go('details');
  };
  if (screen === 'search')
    return renderScreen(
      <SearchScreen
        catalogue={catalogue}
        profile={profile}
        onNavigate={onNavigate}
        onDetails={onDetails}
        onPlay={onPlay}
        onReplayIntro={replayIntro}
        onProfile={openProfiles}
      />,
    );
  if (screen === 'hubs')
    return renderScreen(
      <HubsScreen
        catalogue={catalogue}
        collections={collections}
        profile={profile}
        onNavigate={onNavigate}
        onDetails={onDetails}
        onPlay={onPlay}
        onReplayIntro={replayIntro}
        onProfile={openProfiles}
      />,
    );
  if (screen === 'collections')
    return renderScreen(
      <CollectionsScreen
        catalogue={catalogue}
        collections={collections}
        initialCollectionId={selectedCollectionId}
        profile={profile}
        onNavigate={onNavigate}
        onDetails={onDetails}
        onPlay={onPlay}
        onReplayIntro={replayIntro}
        onProfile={openProfiles}
      />,
    );
  if (screen === 'library')
    return renderScreen(
      <FullLibraryScreen
        catalogue={catalogue}
        profile={profile}
        onNavigate={onNavigate}
        onDetails={onDetails}
        onPlay={onPlay}
        onReplayIntro={replayIntro}
        onProfile={openProfiles}
      />,
    );
  return renderScreen(
    <Home
      catalogue={catalogue}
      collections={collections}
      profile={profile}
      onNavigate={onNavigate}
      onOpenCollection={(collectionId) => {
        setSelectedCollectionId(collectionId);
        go('collections');
      }}
      onDetails={onDetails}
      onReplayIntro={replayIntro}
      onProfile={openProfiles}
      onPlay={onPlay}
    />,
  );
}

function CatalogueState({ error }: { error?: string }) {
  return (
    <main className="catalogue-state" role={error ? 'alert' : 'status'}>
      <Wordmark />
      <p>{error ? 'CATALOGUE UNAVAILABLE' : 'OPENING THE ARCHIVE'}</p>
      <h1>{error ? 'The media library could not be loaded.' : 'Preparing your libraryâ€¦'}</h1>
      <span>
        {error
          ? `${error} Check the API or local fallback catalogue and reload the viewer.`
          : 'Loading the latest movie catalogue.'}
      </span>
    </main>
  );
}

export default function App() {
  const [loaded, setLoaded] = useState<LoadedCatalogue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadCatalogue()
      .then((catalogue) => {
        if (active) setLoaded(catalogue);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, []);

  if (loadError) return <CatalogueState error={loadError} />;
  if (!loaded) return <CatalogueState />;
  return <ViewerApp {...loaded} />;
}
