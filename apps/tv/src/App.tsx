import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { Profile, VideoRecord } from '@lelibrambas/types';
import { catalogue, collections, homeRails, profiles } from './catalogue';
import {
  CollectionsScreen,
  HubsScreen,
  NavigationRail,
  SearchScreen,
  type BrowseScreenId,
} from './Discovery';
import launchJingleUrl from '../assets/lelibrambas-plus-magical-app-launch-universal-192k.mp3';

type Screen = 'ident' | 'profiles' | 'details' | 'player' | BrowseScreenId;

export type PlaybackAvailability = {
  playable: boolean;
  eyebrow: string;
  title: string;
  description: string;
};

export function playbackAvailability(video: VideoRecord): PlaybackAvailability {
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
  if (!video.playbackUrl) {
    return {
      playable: false,
      eyebrow: 'PLAYBACK SOURCE UNAVAILABLE',
      title: 'We could not find the viewing copy.',
      description:
        'The archive record is intact. Check the local media source in the Library Manager.',
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
  current: VideoRecord,
  records: readonly VideoRecord[] = catalogue,
): VideoRecord | null {
  const playable = (candidate: VideoRecord) =>
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

function progressFor(profile: Profile, video: VideoRecord) {
  const stored = readProgress(profile.id, video.id, video.durationSeconds);
  const isStored = Date.parse(stored.updatedAt) > 0;
  if (isStored) return stored;
  const seconds = Math.min(video.durationSeconds, video.progressSeconds);
  return { ...stored, seconds, completed: seconds >= video.durationSeconds * 0.94 };
}

function paletteStyle(video: VideoRecord): React.CSSProperties {
  const [a, b, c] = video.artwork.palette;
  return { '--art-a': a, '--art-b': b, '--art-c': c } as React.CSSProperties;
}

function durationLabel(video: VideoRecord): string {
  if (video.sourceType === 'synthetic' && video.processingStatus === 'unavailable') {
    return 'Length unknown';
  }
  if (video.durationSeconds < 60) return `${Math.round(video.durationSeconds)} sec`;
  return `${Math.round(video.durationSeconds / 60)} min`;
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'wordmark compact' : 'wordmark'} aria-label="LeliBramBas plus">
      LeliBramBas<span>+</span>
    </div>
  );
}

const openingHeaderVideo = catalogue.find((item) => item.featured) ?? catalogue[0]!;

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
    <main className="ident-screen" aria-label="LeliBramBas private archive ident">
      <audio ref={audioRef} src={launchJingleUrl} preload="auto" autoPlay={!capture} />
      <div className="ident-lights" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
      <div className="ident-mark" aria-hidden="true">
        <b>L</b>
        <b>B</b>
      </div>
      <div className="ident-copy">
        <h1>LeliBramBas+</h1>
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
      <footer>A private LeliBramBas+ prototype with synthetic demo media</footer>
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

function ProgressBar({ progress, duration }: { progress: number; duration: number }) {
  const percent = Math.min(100, (progress / duration) * 100);
  return (
    <span className="progress-track" aria-label={`${Math.round(percent)} percent watched`}>
      <i style={{ width: `${percent}%` }} />
    </span>
  );
}

function Home({
  profile,
  onDetails,
  onPlay,
  onNavigate,
  onReplayIntro,
  onProfile,
}: {
  profile: Profile;
  onDetails: (video: VideoRecord) => void;
  onPlay: (video: VideoRecord) => void;
  onNavigate: (screen: BrowseScreenId) => void;
  onReplayIntro: () => void;
  onProfile: () => void;
}) {
  const hero = openingHeaderVideo;
  const heroAvailability = playbackAvailability(hero);
  const saved = progressFor(profile, hero);
  const resumeSeconds = saved.completed ? 0 : saved.seconds;
  const rails = homeRails
    .filter((rail) => rail.visible)
    .map((rail) =>
      rail.id === 'continue-watching'
        ? {
            ...rail,
            videoIds: catalogue
              .filter((item) => {
                const progress = progressFor(profile, item);
                return (
                  playbackAvailability(item).playable && progress.seconds > 0 && !progress.completed
                );
              })
              .sort(
                (a, b) =>
                  Date.parse(progressFor(profile, b).updatedAt) -
                  Date.parse(progressFor(profile, a).updatedAt),
              )
              .map((item) => item.id),
          }
        : rail,
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
          <div className="hero-art" aria-hidden="true" />
          <div className="hero-scrim" />
          <div className="hero-copy">
            <p className="studio-line">Synthetic directory placeholder</p>
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
                Play -{' '}
                {heroAvailability.playable
                  ? resumeSeconds > 0
                    ? 'Resume'
                    : 'Play'
                  : 'Unavailable'}
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
                data-focus-id={`home-hub-${index}`}
                onClick={() => onNavigate('hubs')}
              >
                <i>{String(index + 1).padStart(2, '0')}</i>
                <span>
                  <small>LeliBramBas+</small>
                  <strong>{collection.title}</strong>
                </span>
              </button>
            ))}
          </div>
        </section>
        {rails.map((rail) => (
          <section className="rail-section home-multi-rail" key={rail.id}>
            <div className="rail-heading">
              <h2>{rail.title}</h2>
              <span>{rail.videoIds.length} records</span>
            </div>
            <div className="card-rail">
              {rail.videoIds
                .slice(0, 12)
                .map((id) => catalogue.find((item) => item.id === id))
                .filter((item): item is VideoRecord => Boolean(item))
                .map((video, index) => {
                  const progress = progressFor(profile, video);
                  return (
                    <button
                      key={video.id}
                      data-focusable
                      data-focus-id={`card-${rail.id}-${video.id}`}
                      className="video-card"
                      onClick={() => onDetails(video)}
                      style={paletteStyle(video)}
                    >
                      <span className="card-art">
                        <i className="card-glow" />
                        <small>{video.location?.toUpperCase()}</small>
                        <b>{String(index + 1).padStart(2, '0')}</b>
                        {video.processingStatus !== 'ready' && (
                          <em className={`card-status status-${video.processingStatus}`}>
                            {video.processingStatus === 'processing'
                              ? 'Preparing'
                              : video.processingStatus === 'failed'
                                ? 'Needs review'
                                : 'Catalogue only'}
                          </em>
                        )}
                      </span>
                      <span className="card-copy">
                        <strong>{video.title}</strong>
                        <small>
                          {video.year ?? 'Year unknown'} - {durationLabel(video)}
                        </small>
                        {progress.seconds > 0 && !progress.completed && (
                          <ProgressBar
                            progress={progress.seconds}
                            duration={video.durationSeconds}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
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
  video: VideoRecord;
  profile: Profile;
  onBack: () => void;
  onPlay: (video: VideoRecord) => void;
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
        <p className="studio-line">LeliBramBas+ catalogue placeholder</p>
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
            Play -{' '}
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
  video,
  profile,
  onBack,
  onPlayNext,
}: {
  video: VideoRecord;
  profile: Profile;
  onBack: () => void;
  onPlayNext: (video: VideoRecord) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const persistenceTimer = useRef<number | null>(null);
  const dirty = useRef(false);
  const saved = progressFor(profile, video);
  const initialSeconds = saved.completed ? 0 : saved.seconds;
  const currentRef = useRef(initialSeconds);
  const availability = playbackAvailability(video);
  const nextVideo = useMemo(() => nextPlayableVideo(video), [video]);
  const forcedPlayerState = new URLSearchParams(location.search).get('playerState');
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(initialSeconds);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState(forcedPlayerState === 'error');
  const [ended, setEnded] = useState(forcedPlayerState === 'up-next');
  const [controlsVisible, setControlsVisible] = useState(true);

  useEffect(() => {
    const element = videoRef.current;
    const source = video.playbackUrl;
    if (!element || !source || !availability.playable || error) return;

    let disposed = false;
    let hls: HlsInstance | null = null;
    let networkRecoveryAttempted = false;
    let mediaRecoveryAttempted = false;
    const failPlayback = () => {
      if (disposed) return;
      setPlaying(false);
      setError(true);
    };

    async function attachSource(playbackElement: HTMLVideoElement, playbackSource: string) {
      if (video.playbackProvider !== 'cloudflare-stream') {
        playbackElement.src = playbackSource;
        return;
      }
      if (playbackElement.canPlayType('application/vnd.apple.mpegurl')) {
        playbackElement.src = playbackSource;
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
      hls.loadSource(playbackSource);
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
  }, [availability.playable, error, video.playbackProvider, video.playbackUrl]);

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
        description:
          'The original is safe. Retry the local viewing copy, or return to its details.',
      }
    : availability;

  return (
    <main
      className={`player-screen ${video.aspectRatio === '4:3' ? 'archive-43' : ''}`}
      style={paletteStyle(video)}
    >
      {!error && availability.playable && (
        <video
          ref={videoRef}
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
                <i />
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
      {!error && availability.playable && !ended && (
        <div className={`player-overlay ${controlsVisible ? 'visible' : 'hidden'}`}>
          <div className="player-top">
            <button
              data-focusable
              data-focus-id="player-back"
              onClick={leave}
              aria-label="Back to details"
            >
              ←
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

export default function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const forced = params.get('screen') as Screen | null;
  const initial: Screen = forced ?? 'ident';
  const [screen, setScreen] = useState<Screen>(initial);
  const [profile, setProfile] = useState<Profile>(
    () => profiles.find((item) => item.id === getStored('profile-id', 'family')) ?? profiles[2]!,
  );
  const [video, setVideo] = useState<VideoRecord>(() => {
    const requested = params.get('video');
    return (
      catalogue.find((item) => item.id === requested || item.slug === requested) ?? catalogue[0]!
    );
  });
  const screenRef = useRef<Screen>(initial);
  const history = useRef<Array<{ screen: Screen; focusId: string | null }>>([]);
  const pendingFocusId = useRef<string | null>(null);

  const replaceScreen = useCallback((next: Screen) => {
    screenRef.current = next;
    pendingFocusId.current = null;
    setScreen(next);
  }, []);

  const go = useCallback((next: Screen) => {
    const currentScreen = screenRef.current;
    if (next === currentScreen) return;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    history.current.push({ screen: currentScreen, focusId: active?.dataset.focusId ?? null });
    screenRef.current = next;
    pendingFocusId.current = null;
    setScreen(next);
  }, []);

  const back = useCallback(() => {
    const previous = history.current.pop();
    const next = previous?.screen ?? 'home';
    if (next === screenRef.current && !previous) return;
    screenRef.current = next;
    pendingFocusId.current = previous?.focusId ?? null;
    setScreen(next);
  }, []);

  const openProfiles = useCallback(() => {
    history.current = [];
    screenRef.current = 'profiles';
    pendingFocusId.current = null;
    setScreen('profiles');
  }, []);

  const replayIntro = useCallback(() => {
    history.current = [];
    screenRef.current = 'ident';
    pendingFocusId.current = null;
    setScreen('ident');
  }, []);

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
  if (screen === 'ident')
    return (
      <StudioIdent
        onDone={() => {
          replaceScreen('profiles');
        }}
      />
    );
  if (screen === 'profiles')
    return (
      <ProfilePicker
        onSelect={(next) => {
          setProfile(next);
          setStored('profile-id', next.id);
          replaceScreen('home');
        }}
      />
    );
  if (screen === 'details')
    return (
      <Details
        video={video}
        profile={profile}
        onBack={back}
        onPlay={(next) => {
          setVideo(next);
          go('player');
        }}
      />
    );
  if (screen === 'player')
    return (
      <Player key={video.id} video={video} profile={profile} onBack={back} onPlayNext={setVideo} />
    );
  const onNavigate = (next: BrowseScreenId) => go(next);
  const onDetails = (next: VideoRecord) => {
    setVideo(next);
    go('details');
  };
  if (screen === 'search')
    return (
      <SearchScreen
        profile={profile}
        onNavigate={onNavigate}
        onDetails={onDetails}
        onReplayIntro={replayIntro}
        onProfile={openProfiles}
      />
    );
  if (screen === 'hubs')
    return (
      <HubsScreen
        profile={profile}
        onNavigate={onNavigate}
        onDetails={onDetails}
        onReplayIntro={replayIntro}
        onProfile={openProfiles}
      />
    );
  if (screen === 'collections')
    return (
      <CollectionsScreen
        profile={profile}
        onNavigate={onNavigate}
        onDetails={onDetails}
        onReplayIntro={replayIntro}
        onProfile={openProfiles}
      />
    );
  return (
    <Home
      profile={profile}
      onNavigate={onNavigate}
      onDetails={onDetails}
      onReplayIntro={replayIntro}
      onProfile={openProfiles}
      onPlay={(next) => {
        setVideo(next);
        go('player');
      }}
    />
  );
}
