import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type HlsInstance from 'hls.js';
import { installSpatialNavigation } from '@lelibrambas/navigation';
import {
  clampSeek,
  getStored,
  readProgress,
  setStored,
  shouldMarkComplete,
  writeProgress,
} from '@lelibrambas/shared';
import type { Collection, PlaybackProgress, Profile } from '@lelibrambas/types';
import {
  loadCatalogue,
  profiles,
  type CatalogueVideoRecord,
  type LoadedCatalogue,
} from './catalogue';
import {
  ArtCard,
  CinemaIcon,
  CollectionsScreen,
  HubsScreen,
  NavigationRail,
  SearchScreen,
  type BrowseScreenId,
} from './Discovery';
import { applyPosterFallback, resolvePlaybackSource, resolvePosterUrl } from './media';
import launchJingleUrl from '../assets/lelibrambas-plus-magical-app-launch-universal-192k.mp3';

type Screen = 'ident' | 'profiles' | 'loading' | 'details' | 'player' | BrowseScreenId;

export const PROFILE_LOADING_DELAY_MS = 3000;
export const HERO_IDLE_DELAY_MS = 5000;

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

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
      description:
        'The last conversion did not complete. It can be retried from the Library Manager.',
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
        : 'The archive record is intact. Check the local media source in the Library Manager.',
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
  return typeof video.durationSeconds === 'number' &&
    Number.isFinite(video.durationSeconds) &&
    video.durationSeconds > 0
    ? video.durationSeconds
    : null;
}

function progressFallbackDuration(video: CatalogueVideoRecord): number {
  return knownDuration(video) ?? Math.max(1, video.progressSeconds);
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
    .filter(
      ({ progress }) => progress.seconds > 0 && Number.isFinite(Date.parse(progress.updatedAt)),
    )
    .sort(
      (left, right) =>
        Date.parse(right.progress.updatedAt) - Date.parse(left.progress.updatedAt),
    );
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
    <main className="profile-loading-screen" role="status" aria-live="polite">
      <Wordmark />
      <span className="profile-loading-spinner" aria-hidden="true">
        <CinemaIcon />
      </span>
      <p>Opening {profile.name}&apos;s archive&hellip;</p>
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

function HeroTrailer({
  video,
  onPlaying,
  onUnavailable,
  onEnded,
}: {
  video: CatalogueVideoRecord;
  onPlaying: () => void;
  onUnavailable: () => void;
  onEnded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const source = useMemo(() => {
    const resolved = resolvePlaybackSource(video.streamVideoId, { autoplay: true });
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

    let disposed = false;
    let attempted = false;
    let hls: HlsInstance | null = null;
    const fail = () => {
      if (!disposed) onUnavailable();
    };
    const attemptPlayback = () => {
      if (attempted || disposed) return;
      attempted = true;
      element.muted = false;
      element.volume = 1;
      void element
        .play()
        .then(() => {
          if (!disposed) onPlaying();
        })
        .catch(fail);
    };
    const reportPlaying = () => {
      if (!disposed) onPlaying();
    };

    element.addEventListener('canplay', attemptPlayback, { once: true });
    element.addEventListener('playing', reportPlaying);
    element.addEventListener('error', fail, { once: true });

    async function attachSource() {
      if (source.kind === 'mp4' || element.canPlayType('application/vnd.apple.mpegurl')) {
        element.src = source.url;
        element.load();
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
      hls.loadSource(source.url);
      hls.attachMedia(element);
    }

    void attachSource().catch(fail);
    return () => {
      disposed = true;
      hls?.destroy();
      element.removeEventListener('canplay', attemptPlayback);
      element.removeEventListener('playing', reportPlaying);
      element.removeEventListener('error', fail);
      element.pause();
      element.removeAttribute('src');
      element.load();
    };
  }, [onPlaying, onUnavailable, source]);

  if (!source) return null;
  return (
    <video
      ref={videoRef}
      className="hero-trailer"
      data-hero-media="trailer"
      data-stream-video-id={source.originalUrl}
      autoPlay
      controls={false}
      playsInline
      preload="auto"
      tabIndex={-1}
      aria-hidden="true"
      onEnded={onEnded}
    />
  );
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
  const hero = catalogue.find((item) => item.title === 'Lelibrambas+ Trailer') ?? catalogue[0]!;
  const heroAvailability = playbackAvailability(hero);
  const saved = progressFor(profile, hero);
  const resumeSeconds = saved.completed ? 0 : saved.seconds;
  const captureMode = new URLSearchParams(location.search).get('capture') === '1';
  const [trailerRequested, setTrailerRequested] = useState(false);
  const [trailerPlaying, setTrailerPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const trendingIds = [22, 23, 7, 40];
  const trending = trendingIds
    .map((id) => catalogue.find((item) => item.catalogueId === id))
    .filter((item): item is CatalogueVideoRecord => Boolean(item));
  const recentlyWatched = useMemo(
    () => recentlyWatchedFor(profile, catalogue),
    [catalogue, profile],
  );

  const stopTrailer = useCallback(() => {
    setTrailerRequested(false);
    setTrailerPlaying(false);
  }, []);
  const rejectTrailer = useCallback(() => {
    setAutoplayBlocked(true);
    stopTrailer();
  }, [stopTrailer]);

  useEffect(() => {
    if (captureMode || autoplayBlocked || !heroAvailability.playable) return;
    let timer: number | null = null;
    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const schedule = () => {
      clearTimer();
      if (
        trailerRequested ||
        document.visibilityState !== 'visible' ||
        window.scrollY > 48
      )
        return;
      timer = window.setTimeout(() => setTrailerRequested(true), HERO_IDLE_DELAY_MS);
    };
    const noteActivity = () => {
      if (!trailerRequested) schedule();
    };
    const handleScroll = () => {
      if (window.scrollY > 48) {
        clearTimer();
        stopTrailer();
      } else if (!trailerRequested) schedule();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearTimer();
        stopTrailer();
      } else {
        schedule();
      }
    };

    schedule();
    window.addEventListener('pointerdown', noteActivity);
    window.addEventListener('keydown', noteActivity);
    window.addEventListener('touchstart', noteActivity, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearTimer();
      window.removeEventListener('pointerdown', noteActivity);
      window.removeEventListener('keydown', noteActivity);
      window.removeEventListener('touchstart', noteActivity);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [
    autoplayBlocked,
    captureMode,
    heroAvailability.playable,
    stopTrailer,
    trailerRequested,
  ]);

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
          <div className="hero-art" aria-hidden="true" />
          <div className="hero-scrim" />
          <div className="hero-copy">
            <p className="studio-line">{hero.categories[0]}</p>
            <h1>{hero.title}</h1>
            <div className="metadata">
              <span>{hero.year ?? 'Year unknown'}</span>
              <span>{hero.categories[0]}</span>
              <span>{durationLabel(hero)}</span>
              <span>{hero.location}</span>
              <span className="format">Format unknown</span>
            </div>
            <p>{hero.description}</p>
            {resumeSeconds > 0 && (
              <ProgressBar progress={resumeSeconds} duration={hero.durationSeconds} />
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
        <section className="home-hubs-strip">
          <div className="rail-heading">
            <h2>Collections</h2>
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
        <section className="rail-section home-multi-rail" data-home-rail="currently-trending">
          <div className="rail-heading">
            <h2>Currently Trending</h2>
            <span>{trending.length} titles</span>
          </div>
          <div className="card-rail">
            {trending.map((item, index) => (
              <ArtCard key={item.catalogueId} video={item} index={index} onSelect={onDetails} />
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
                <h2>{collection.title}</h2>
                <span>{videos.length} titles</span>
              </div>
              <div className="card-rail">
                {videos.map((item, index) => (
                  <ArtCard
                    key={item.catalogueId}
                    video={item}
                    index={index}
                    onSelect={onDetails}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </section>
    </main>
  );
}

function Details({
  video,
  profile,
  onBack,
  onPlay,
}: {
  video: CatalogueVideoRecord;
  profile: Profile;
  onBack: () => void;
  onPlay: (video: CatalogueVideoRecord) => void;
}) {
  const [saved, setSaved] = useState(() => progressFor(profile, video));
  const resumeSeconds = saved.completed ? 0 : saved.seconds;
  const availability = playbackAvailability(video);
  useEffect(() => setSaved(progressFor(profile, video)), [profile, video]);
  const savePosition = (seconds: number, completed: boolean) => {
    const progress = {
      profileId: profile.id,
      videoId: video.id,
      seconds,
      durationSeconds: video.durationSeconds,
      completed,
      updatedAt: new Date().toISOString(),
    };
    writeProgress(progress);
    setSaved(progress);
  };
  return (
    <main className="details-screen" style={paletteStyle(video)}>
      <div className="details-art" aria-hidden="true">
        <img
          src={resolvePosterUrl(video.posterUrl)}
          alt=""
          onError={(event) => applyPosterFallback(event.currentTarget)}
        />
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
        <h1>{video.title}</h1>
        <p className="subtitle">{video.subtitle}</p>
        <div className="metadata">
          <span>{video.year ?? 'Year unknown'}</span>
          <span>{durationLabel(video)}</span>
          <span>{video.location}</span>
          <span className="format">{video.aspectRatio}</span>
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
            onClick={() => savePosition(video.durationSeconds, true)}
          >
            {saved.completed ? 'Watched' : 'Mark watched'}
          </ActionButton>
        </div>
        {resumeSeconds > 0 && (
          <div className="resume-row">
            <ProgressBar progress={resumeSeconds} duration={video.durationSeconds} />
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const persistenceTimer = useRef<number | null>(null);
  const dirty = useRef(false);
  const saved = progressFor(profile, video);
  const initialSeconds = saved.completed ? 0 : saved.seconds;
  const currentRef = useRef(initialSeconds);
  const availability = playbackAvailability(video);
  const playbackSource = useMemo(
    () => resolvePlaybackSource(video.streamVideoId, { autoplay: true }),
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
    (seconds: number, completed = shouldMarkComplete(seconds, video.durationSeconds)) => {
      if (!getStored('remember-progress', true)) return;
      writeProgress({
        profileId: profile.id,
        videoId: video.id,
        seconds: clampSeek(0, seconds, video.durationSeconds),
        durationSeconds: video.durationSeconds,
        completed,
        updatedAt: new Date().toISOString(),
      });
    },
    [profile.id, video.durationSeconds, video.id],
  );

  const flushProgress = useCallback(
    (completed = false) => {
      if (persistenceTimer.current !== null) {
        window.clearTimeout(persistenceTimer.current);
        persistenceTimer.current = null;
      }
      if (!dirty.current && !completed) return;
      const seconds = completed ? video.durationSeconds : currentRef.current;
      persistAt(seconds, completed || shouldMarkComplete(seconds, video.durationSeconds));
      dirty.current = false;
    },
    [persistAt, video.durationSeconds],
  );

  const scheduleProgress = useCallback(() => {
    if (persistenceTimer.current !== null) window.clearTimeout(persistenceTimer.current);
    persistenceTimer.current = window.setTimeout(() => flushProgress(), 900);
  }, [flushProgress]);

  const setPresentationTime = useCallback(
    (seconds: number) => {
      const safeSeconds = clampSeek(0, seconds, video.durationSeconds);
      currentRef.current = safeSeconds;
      setCurrent(safeSeconds);
    },
    [video.durationSeconds],
  );

  const seek = useCallback(
    (seconds: number) => {
      const element = videoRef.current;
      if (!element || !availability.playable) return;
      const target = clampSeek(0, seconds, video.durationSeconds);
      element.currentTime = mediaSecondsForPresentation(
        target,
        video.durationSeconds,
        element.duration,
      );
      setPresentationTime(target);
      dirty.current = true;
      scheduleProgress();
    },
    [availability.playable, scheduleProgress, setPresentationTime, video.durationSeconds],
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

  useEffect(() => () => flushProgress(), [flushProgress]);

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
  const progressPercent = Math.min(100, (current / video.durationSeconds) * 100);
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
            playsInline
            onLoadedMetadata={(event) => {
              if (initialSeconds > 0)
                event.currentTarget.currentTime = mediaSecondsForPresentation(
                  initialSeconds,
                  video.durationSeconds,
                  event.currentTarget.duration,
                );
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => {
              setPlaying(false);
              flushProgress();
            }}
            onTimeUpdate={(event) => {
              const seconds = presentationSecondsForMedia(
                event.currentTarget.currentTime,
                event.currentTarget.duration,
                video.durationSeconds,
              );
              setPresentationTime(seconds);
              dirty.current = true;
              scheduleProgress();
            }}
            onEnded={() => {
              setPlaying(false);
              setEnded(true);
              setPresentationTime(video.durationSeconds);
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
                <span>{durationLabel(nextVideo)}</span>
                <span>{nextVideo.aspectRatio}</span>
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
              </div>
              <div className="player-times">
                <span>{format(current)}</span>
                <span>−{format(Math.max(0, video.durationSeconds - current))}</span>
              </div>
              <div className="player-controls">
                <button
                  data-focusable
                  data-focus-id="rewind"
                  onClick={() => seek(currentRef.current - 10)}
                  aria-label="Rewind ten seconds"
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
                  onClick={() => seek(currentRef.current + 10)}
                  aria-label="Forward ten seconds"
                >
                  ↷<small>10</small>
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
        video={video}
        profile={profile}
        onBack={back}
        onPlay={(next) => {
          setVideo(next);
          go('player');
        }}
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
      onPlay={(next) => {
        setVideo(next);
        go('player');
      }}
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
          ? `${error} Regenerate the catalogue and restart the local viewer.`
          : 'Loading the generated local catalogue and artwork.'}
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
