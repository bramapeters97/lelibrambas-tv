import { useEffect, useMemo, useRef, useState } from 'react';
import { getStored, setStored } from '@lelibrambas/shared';
import type { Collection, Profile } from '@lelibrambas/types';
import type { CatalogueVideoRecord } from './catalogue';
import { applyPosterFallback, resolvePosterUrl } from './media';

export type BrowseScreenId = 'home' | 'search' | 'hubs' | 'collections' | 'library';

const watchlistKey = (profileId: string) => `watchlist:${profileId}`;
const removedWatchlistKey = (profileId: string) => `watchlist-removed:${profileId}`;

export function mergeWatchlistIds(
  seedIds: readonly string[],
  addedIds: readonly string[],
  removedIds: readonly string[] = [],
): string[] {
  const removed = new Set(removedIds);
  return [...new Set([...seedIds, ...addedIds])].filter((id) => !removed.has(id));
}

export function watchlistStorageFor(
  profile: Profile,
  ids: readonly string[],
): { added: string[]; removed: string[] } {
  const selected = new Set(ids);
  const seeded = new Set(profile.watchlist);
  return {
    added: [...selected].filter((id) => !seeded.has(id)),
    removed: profile.watchlist.filter((id) => !selected.has(id)),
  };
}

export function readProfileWatchlist(profile: Profile): string[] {
  return mergeWatchlistIds(
    profile.watchlist,
    getStored<string[]>(watchlistKey(profile.id), []),
    getStored<string[]>(removedWatchlistKey(profile.id), []),
  );
}

export function toggleProfileWatchlist(
  profile: Profile,
  videoId: string,
): { ids: string[]; saved: boolean } {
  const current = readProfileWatchlist(profile);
  const saved = !current.includes(videoId);
  const ids = saved ? [...current, videoId] : current.filter((id) => id !== videoId);
  const storage = watchlistStorageFor(profile, ids);
  setStored(watchlistKey(profile.id), storage.added);
  setStored(removedWatchlistKey(profile.id), storage.removed);
  return { ids, saved };
}

const processingLabels: Record<CatalogueVideoRecord['processingStatus'], string> = {
  ready: 'Ready',
  processing: 'Preparing viewing copy',
  failed: 'Needs review',
  unavailable: 'Catalogue only',
};

type PrimaryNavScreenId = 'home' | 'search' | 'collections' | 'library';
type NavIconId = PrimaryNavScreenId;

const navItems: Array<{ id: PrimaryNavScreenId; icon: NavIconId; label: string }> = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'search', icon: 'search', label: 'Search' },
  { id: 'collections', icon: 'collections', label: 'Collections' },
  { id: 'library', icon: 'library', label: 'Full Library' },
];

export type SectionIconName =
  | 'collections'
  | 'trending'
  | 'jeugdfilms'
  | 'vakantiefilms'
  | 'events'
  | 'others'
  | 'movies';

export function sectionIconForLabel(label: string): SectionIconName {
  switch (label.trim().toUpperCase()) {
    case 'JEUGDFILMS':
      return 'jeugdfilms';
    case 'VAKANTIEFILMS':
      return 'vakantiefilms';
    case 'EVENTS':
      return 'events';
    case 'OTHERS':
      return 'others';
    case 'COLLECTIONS':
      return 'collections';
    case 'CURRENTLY TRENDING':
      return 'trending';
    default:
      return 'movies';
  }
}

export function SectionIcon({ name }: { name: SectionIconName }) {
  if (name === 'collections') {
    return (
      <svg
        className="section-title__icon"
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3.5" y="5" width="7" height="6" rx="1.2" />
        <rect x="13.5" y="5" width="7" height="6" rx="1.2" />
        <rect x="3.5" y="14" width="7" height="5" rx="1.2" />
        <rect x="13.5" y="14" width="7" height="5" rx="1.2" />
      </svg>
    );
  }

  if (name === 'trending') {
    return (
      <svg
        className="section-title__icon"
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m4 17 5-5 3.5 3.5L20 8" />
        <path d="M14.5 8H20v5.5" />
      </svg>
    );
  }

  if (name === 'jeugdfilms') {
    return (
      <svg
        className="section-title__icon"
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m12 3 2.2 5.1 5.5.5-4.2 3.7 1.3 5.4L12 15l-4.8 2.7 1.3-5.4-4.2-3.7 5.5-.5Z" />
      </svg>
    );
  }

  if (name === 'vakantiefilms') {
    return (
      <svg
        className="section-title__icon"
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8.5" r="3.2" />
        <path d="M12 2v2M5.5 4.5 7 6m10-1.5L15.5 6M3 12h18M5 17c2-2 4.3-2 7 0s5 2 7 0" />
      </svg>
    );
  }

  if (name === 'events') {
    return (
      <svg
        className="section-title__icon"
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="5.5" width="16" height="14" rx="2" />
        <path d="M8 3.5v4M16 3.5v4M4 10h16M9 14h2M14 14h2" />
      </svg>
    );
  }

  if (name === 'others') {
    return (
      <svg
        className="section-title__icon"
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="6" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="18" cy="12" r="1.5" />
      </svg>
    );
  }

  return (
    <svg
      className="section-title__icon"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M3.5 9h3.5M17 9h3.5M3.5 15h3.5M17 15h3.5" />
      <path d="m10.5 10 4 2-4 2Z" />
    </svg>
  );
}

export function SectionHeading({
  icon,
  children,
  className = '',
}: {
  icon: SectionIconName;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`section-title${className ? ` ${className}` : ''}`}>
      <SectionIcon name={icon} />
      <span>{children}</span>
    </h2>
  );
}

export function CinemaIcon() {
  return (
    <svg className="nav-wordmark__icon" aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 8.5h16v9.8c0 1-.8 1.7-1.8 1.7H5.8c-1 0-1.8-.7-1.8-1.7Z" />
      <path d="m4.7 8.5 2-4.5h13.1L18 8.5" />
      <path d="m9.4 4-2 4.5M14.8 4l-2 4.5" />
      <path d="m10.2 12 4.7 2.5-4.7 2.5Z" />
    </svg>
  );
}

function NavIcon({ name }: { name: NavIconId }) {
  if (name === 'home') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M3.5 10.7 12 3.5l8.5 7.2" />
        <path d="M5.7 9.3v10.8h12.6V9.3" />
        <path d="M9.3 20.1v-6.2h5.4v6.2" />
      </svg>
    );
  }

  if (name === 'search') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="10.8" cy="10.8" r="6.3" />
        <path d="m15.4 15.4 5.1 5.1" />
      </svg>
    );
  }

  if (name === 'library') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 5.2h16v13.6H4Z" />
        <path d="M8 5.2v13.6M16 5.2v13.6M4 9h4M16 9h4M4 15h4M16 15h4" />
        <path d="m10.4 10 4.2 2-4.2 2Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="4" y="4.4" width="6.1" height="6.1" rx="1.3" />
      <rect x="13.9" y="4.4" width="6.1" height="6.1" rx="1.3" />
      <rect x="4" y="13.5" width="6.1" height="6.1" rx="1.3" />
      <rect x="13.9" y="13.5" width="6.1" height="6.1" rx="1.3" />
    </svg>
  );
}

function durationLabel(video: CatalogueVideoRecord): string | null {
  const duration = video.durationSeconds;
  if (duration === null || !Number.isFinite(duration) || duration <= 0) {
    return null;
  }
  if (duration < 60) return `${Math.round(duration)} sec`;
  return `${Math.round(duration / 60)} min`;
}

export function NavigationRail({
  active,
  profile,
  onNavigate,
  onReplayIntro,
  onProfile,
}: {
  active: BrowseScreenId;
  profile: Profile;
  onNavigate: (screen: BrowseScreenId) => void;
  onReplayIntro: () => void;
  onProfile: () => void;
}) {
  return (
    <aside className="mini-nav full-nav" aria-label="Main navigation">
      <button
        data-focusable
        data-focus-id="nav-ident"
        className="nav-wordmark"
        aria-label="Replay entrance with logo and tune"
        onClick={onReplayIntro}
      >
        <CinemaIcon />
        <span className="nav-wordmark__label">Intro</span>
      </button>
      {navItems.map((item) => (
        <button
          key={item.id}
          data-focusable
          data-focus-id={`nav-${item.id}`}
          className={`nav-button ${active === item.id ? 'selected' : ''}`}
          aria-label={item.label}
          onClick={() => onNavigate(item.id)}
        >
          <NavIcon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
      <button
        data-focusable
        data-focus-id="nav-profile"
        className="nav-profile"
        aria-label={`Switch profile, currently ${profile.name}`}
        onClick={onProfile}
        style={{ '--profile-accent': profile.accent } as React.CSSProperties}
      >
        {profile.initials}
      </button>
    </aside>
  );
}

function useMobileWebViewport(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(max-width: 800px)');
    const update = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isMobile;
}

export function ArtCard({
  video,
  onSelect,
  onPlay,
  mobilePrimaryPlay = false,
  progress,
  index = 0,
}: {
  video: CatalogueVideoRecord;
  onSelect: (video: CatalogueVideoRecord) => void;
  onPlay?: (video: CatalogueVideoRecord) => void;
  mobilePrimaryPlay?: boolean;
  progress?: { seconds: number; durationSeconds?: number | null };
  index?: number;
}) {
  const isMobileViewport = useMobileWebViewport();
  const [a, b, c] = video.artwork.palette;
  const style = { '--art-a': a, '--art-b': b, '--art-c': c } as React.CSSProperties;
  const usesMobilePlay = isMobileViewport && mobilePrimaryPlay && Boolean(onPlay);
  const progressDuration = progress?.durationSeconds ?? video.durationSeconds;
  const progressPercent =
    progress &&
    progressDuration !== null &&
    Number.isFinite(progress.seconds) &&
    Number.isFinite(progressDuration) &&
    progressDuration > 0
      ? Math.min(100, Math.max(0, (progress.seconds / progressDuration) * 100))
      : null;
  const metadata = [
    video.year?.toString() ?? 'Year unknown',
    video.location ?? 'Archive shelf',
    durationLabel(video),
  ].filter((value): value is string => Boolean(value));
  const primaryAction = () => {
    if (usesMobilePlay) {
      onPlay?.(video);
      return;
    }
    onSelect(video);
  };

  return (
    <div
      className="art-card-shell"
      data-catalogue-id={video.catalogueId}
      data-mobile-primary-play={usesMobilePlay ? 'true' : 'false'}
      style={style}
    >
      <button
        type="button"
        data-focusable
        data-focus-id={`browse-${video.id}`}
        data-card-action="primary"
        className="browse-card"
        onClick={primaryAction}
      >
        <span className="browse-art">
          <img
            src={resolvePosterUrl(video.posterUrl)}
            alt=""
            loading="lazy"
            onError={(event) => applyPosterFallback(event.currentTarget)}
          />
          <b>{String(index + 1).padStart(2, '0')}</b>
          {video.processingStatus !== 'ready' && (
            <em className={`status-${video.processingStatus}`}>
              {processingLabels[video.processingStatus]}
            </em>
          )}
        </span>
        <span className="browse-card__copy">
          <strong>{video.title}</strong>
          <small>{metadata.join(' - ')}</small>
          {progressPercent !== null && (
            <span
              className="progress-track browse-card-progress"
              aria-label={`${Math.round(progressPercent)} percent watched`}
              data-progress-percent={Math.round(progressPercent)}
            >
              <i style={{ width: `${progressPercent}%` }} />
            </span>
          )}
        </span>
      </button>
      {usesMobilePlay && (
        <button
          type="button"
          data-focusable
          data-focus-id={`browse-info-${video.id}`}
          data-card-action="details"
          className="mobile-card-info"
          onClick={() => onSelect(video)}
          aria-label={`More information about ${video.title}`}
        >
          <span aria-hidden="true">i</span>
        </button>
      )}
    </div>
  );
}

function BrowseChrome({
  active,
  title,
  kicker,
  profile,
  onNavigate,
  children,
  action,
  onReplayIntro,
  onProfile,
}: {
  active: BrowseScreenId;
  title: string;
  kicker: string;
  profile: Profile;
  onNavigate: (screen: BrowseScreenId) => void;
  children: React.ReactNode;
  action?: React.ReactNode;
  onReplayIntro: () => void;
  onProfile: () => void;
}) {
  return (
    <main className="browse-shell">
      <NavigationRail
        active={active}
        profile={profile}
        onNavigate={onNavigate}
        onReplayIntro={onReplayIntro}
        onProfile={onProfile}
      />
      <section className="browse-content">
        <header className="browse-header">
          <div>
            <p>{kicker}</p>
            <h1>{title}</h1>
          </div>
          {action}
        </header>
        {children}
        <footer className="browse-footer">LELIBRAMBAS+ - Private family archive</footer>
      </section>
    </main>
  );
}

const hubPalettes = [
  ['#241A22', '#6E4A3E', '#E9C778'],
  ['#10213D', '#25718A', '#D7B16A'],
  ['#311927', '#9B4E55', '#F0C58B'],
  ['#132B2B', '#417C6A', '#D5BE7C'],
] as const;

export function HubsScreen({
  catalogue,
  collections,
  profile,
  onNavigate,
  onDetails,
  onPlay,
  onReplayIntro,
  onProfile,
}: {
  catalogue: readonly CatalogueVideoRecord[];
  collections: readonly Collection[];
  profile: Profile;
  onNavigate: (screen: BrowseScreenId) => void;
  onDetails: (video: CatalogueVideoRecord) => void;
  onPlay?: (video: CatalogueVideoRecord) => void;
  onReplayIntro: () => void;
  onProfile: () => void;
}) {
  const hubData = useMemo(
    () =>
      collections.map((collection, index) => ({
        ...collection,
        code: String(index + 1).padStart(2, '0'),
        line: `${collection.videoIds.length} catalogue records.`,
        palette: hubPalettes[index % hubPalettes.length] ?? hubPalettes[0],
      })),
    [collections],
  );
  const [selected, setSelected] = useState(0);
  const hub = hubData[selected] ?? hubData[0]!;
  const matches = hub.videoIds
    .map((id) => catalogue.find((video) => video.id === id))
    .filter((video): video is CatalogueVideoRecord => Boolean(video));
  return (
    <BrowseChrome
      active="collections"
      title="Collections"
      kicker="Four private folder categories"
      profile={profile}
      onNavigate={onNavigate}
      onReplayIntro={onReplayIntro}
      onProfile={onProfile}
    >
      <section className="hub-grid">
        {hubData.map((item, index) => (
          <button
            key={item.title}
            data-focusable
            data-focus-id={`hub-${index}`}
            className={`hub-tile ${selected === index ? 'active' : ''}`}
            onClick={() => setSelected(index)}
            style={
              {
                '--hub-a': item.palette[0],
                '--hub-b': item.palette[1],
                '--hub-c': item.palette[2],
              } as React.CSSProperties
            }
          >
            <span className="hub-monogram">{item.code}</span>
            <i />
            <small>LELIBRAMBAS+</small>
            <strong>{item.title}</strong>
            <em>{item.line}</em>
          </button>
        ))}
      </section>
      <section className="result-block">
        <div className="result-title">
          <div>
            <p>Now entering</p>
            <h2>{hub.title}</h2>
          </div>
          <span>{matches.length} catalogue records</span>
        </div>
        <div className="browse-rail">
          {matches.map((video, index) => (
            <ArtCard
              key={video.catalogueId}
              video={video}
              index={index}
              onSelect={onDetails}
              onPlay={onPlay}
              mobilePrimaryPlay={Boolean(onPlay)}
            />
          ))}
        </div>
      </section>
    </BrowseChrome>
  );
}

const keyboard = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

export function SearchScreen({
  catalogue,
  profile,
  onNavigate,
  onDetails,
  onPlay,
  onReplayIntro,
  onProfile,
}: {
  catalogue: readonly CatalogueVideoRecord[];
  profile: Profile;
  onNavigate: (screen: BrowseScreenId) => void;
  onDetails: (video: CatalogueVideoRecord) => void;
  onPlay?: (video: CatalogueVideoRecord) => void;
  onReplayIntro: () => void;
  onProfile: () => void;
}) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      normalized
        ? catalogue.filter((video) =>
            [
              video.title,
              video.description,
              video.location,
              video.country,
              video.year?.toString(),
              video.collectionId,
              ...video.people,
              ...video.tags,
            ].some((value) => value?.toLowerCase().includes(normalized)),
          )
        : catalogue.slice(0, 8),
    [catalogue, normalized],
  );
  const suggestions = useMemo(
    () => [...new Set(catalogue.map((video) => video.categories[0]!))].slice(0, 3),
    [catalogue],
  );
  const add = (letter: string) => setQuery((value) => value + letter);
  return (
    <BrowseChrome
      active="search"
      title="Search the archive"
      kicker="Titles, folder groups, years and collections"
      profile={profile}
      onNavigate={onNavigate}
      onReplayIntro={onReplayIntro}
      onProfile={onProfile}
      action={
        <span
          className="voice-placeholder search-mobile-extras"
          aria-label="Voice search architecture placeholder"
        >
          Voice search - future adapter
        </span>
      }
    >
      <div className="search-layout" data-search-layout>
        <section className="search-panel" data-search-panel>
          <label className="search-prompt-label" htmlFor="archive-search">
            Which folder should we open?
          </label>
          <div className="search-input" data-search-input>
            <span>S</span>
            <input
              id="archive-search"
              data-focusable
              data-focus-id="search-input"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try a title, year or category"
            />
            <button
              data-focusable
              data-focus-id="search-clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              x
            </button>
          </div>
          <div className="search-mobile-extras" data-search-extras>
            <div className="recent-searches">
              <span>Recent</span>
              {suggestions.map((item) => (
                <button
                  key={item}
                  data-focusable
                  data-focus-id={`recent-${item}`}
                  onClick={() => setQuery(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="screen-keyboard" aria-label="On-screen keyboard">
              {keyboard.map((letter) => (
                <button
                  key={letter}
                  data-focusable
                  data-focus-id={`key-${letter}`}
                  onClick={() => add(letter)}
                >
                  {letter}
                </button>
              ))}
              <button
                data-focusable
                data-focus-id="key-space"
                className="wide"
                onClick={() => add(' ')}
              >
                Space
              </button>
              <button
                data-focusable
                data-focus-id="key-delete"
                className="wide"
                onClick={() => setQuery((value) => value.slice(0, -1))}
              >
                Delete
              </button>
            </div>
          </div>
        </section>
        <section
          className="search-results"
          data-search-results
          data-result-count={results.length}
          aria-live="polite"
        >
          <div className="result-title">
            <div>
              <p>{normalized ? 'Matches' : 'Suggested for you'}</p>
              <h2>{normalized ? `"${query}"` : 'Start with a familiar shelf'}</h2>
            </div>
            <span>{results.length} results</span>
          </div>
          {results.length ? (
            <div className="search-grid" data-search-grid>
              {results.map((video, index) => (
                <ArtCard
                  key={video.catalogueId}
                  video={video}
                  index={index}
                  onSelect={onDetails}
                  onPlay={onPlay}
                  mobilePrimaryPlay={Boolean(onPlay)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <b>No movie found.</b>
              <p>Try a category, year or another title.</p>
            </div>
          )}
        </section>
      </div>
    </BrowseChrome>
  );
}

export function CollectionsScreen({
  catalogue,
  collections,
  initialCollectionId,
  profile,
  onNavigate,
  onDetails,
  onPlay,
  onReplayIntro,
  onProfile,
}: {
  catalogue: readonly CatalogueVideoRecord[];
  collections: readonly Collection[];
  initialCollectionId?: string;
  profile: Profile;
  onNavigate: (screen: BrowseScreenId) => void;
  onDetails: (video: CatalogueVideoRecord) => void;
  onPlay?: (video: CatalogueVideoRecord) => void;
  onReplayIntro: () => void;
  onProfile: () => void;
}) {
  const initialId =
    collections.find((item) => item.id === initialCollectionId)?.id ?? collections[0]!.id;
  const [selected, setSelected] = useState(initialId);
  const [displayed, setDisplayed] = useState(initialId);
  const [transitionState, setTransitionState] = useState<'idle' | 'leaving' | 'entering'>('idle');
  const displayedRef = useRef(displayed);
  const requestedRef = useRef(displayed);
  const leaveTimerRef = useRef<number | null>(null);
  const enterTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current);
      if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);
    },
    [],
  );

  const clearTransitionTimers = () => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    if (enterTimerRef.current !== null) {
      window.clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }
  };
  const selectCollection = (collectionId: string) => {
    if (collectionId === selected && transitionState !== 'idle') return;
    clearTransitionTimers();
    requestedRef.current = collectionId;
    setSelected(collectionId);

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (collectionId === displayedRef.current || reduceMotion || typeof window === 'undefined') {
      displayedRef.current = collectionId;
      setDisplayed(collectionId);
      setTransitionState('idle');
      return;
    }

    setTransitionState('leaving');
    leaveTimerRef.current = window.setTimeout(() => {
      const nextId = requestedRef.current;
      displayedRef.current = nextId;
      setDisplayed(nextId);
      setTransitionState('entering');
      leaveTimerRef.current = null;
      enterTimerRef.current = window.setTimeout(() => {
        setTransitionState('idle');
        enterTimerRef.current = null;
      }, 650);
    }, 350);
  };

  const collection = collections.find((item) => item.id === displayed) ?? collections[0]!;
  const videos = collection.videoIds
    .map((id) => catalogue.find((video) => video.id === id))
    .filter(Boolean) as CatalogueVideoRecord[];
  return (
    <BrowseChrome
      active="collections"
      title="Collections"
      kicker="Private directory overview"
      profile={profile}
      onNavigate={onNavigate}
      onReplayIntro={onReplayIntro}
      onProfile={onProfile}
    >
      <section
        className="collection-grid"
        data-collection-selector
        data-collection-order={collections.map((item) => item.id).join(',')}
      >
        {collections.map((item) => {
          const isSelected = selected === item.id;
          const directoryIndex = collections.findIndex((candidate) => candidate.id === item.id);
          return (
            <button
              key={item.id}
              data-focusable
              data-focus-id={`collection-${item.id}`}
              data-collection-id={item.id}
              data-directory-index={directoryIndex}
              className={isSelected ? 'active' : ''}
              aria-current={isSelected ? 'true' : undefined}
              aria-controls="collection-results"
              onClick={() => selectCollection(item.id)}
            >
              <span>{String(directoryIndex + 1).padStart(2, '0')}</span>
              <small>{item.kind}</small>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <em>{item.videoIds.length} catalogue records</em>
            </button>
          );
        })}
      </section>
      <section
        id="collection-results"
        className={`result-block collection-results${
          transitionState === 'leaving'
            ? ' is-leaving'
            : transitionState === 'entering'
              ? ' is-entering'
              : ''
        }`}
        data-transition-state={transitionState}
        data-transition-duration-ms="1000"
        data-collection-id={collection.id}
        aria-live="polite"
        aria-busy={transitionState === 'leaving'}
      >
        <div className="result-title">
          <div>
            <p>{collection.kind} collection</p>
            <SectionHeading icon={sectionIconForLabel(collection.title)}>
              {collection.title}
            </SectionHeading>
          </div>
          <span>Directory order</span>
        </div>
        <div className="collection-video-grid" data-collection-video-grid>
          {videos.map((video, index) => (
            <ArtCard
              key={video.catalogueId}
              video={video}
              index={index}
              onSelect={onDetails}
              onPlay={onPlay}
              mobilePrimaryPlay={Boolean(onPlay)}
            />
          ))}
        </div>
      </section>
    </BrowseChrome>
  );
}

export function FullLibraryScreen({
  catalogue,
  profile,
  onNavigate,
  onDetails,
  onPlay,
  onReplayIntro,
  onProfile,
}: {
  catalogue: readonly CatalogueVideoRecord[];
  profile: Profile;
  onNavigate: (screen: BrowseScreenId) => void;
  onDetails: (video: CatalogueVideoRecord) => void;
  onPlay?: (video: CatalogueVideoRecord) => void;
  onReplayIntro: () => void;
  onProfile: () => void;
}) {
  return (
    <BrowseChrome
      active="library"
      title="Full Library"
      kicker="Every film in the private archive"
      profile={profile}
      onNavigate={onNavigate}
      onReplayIntro={onReplayIntro}
      onProfile={onProfile}
    >
      <section className="result-block full-library" data-library-count={catalogue.length}>
        <div className="result-title">
          <div>
            <p>Complete catalogue</p>
            <SectionHeading icon="movies">All movies</SectionHeading>
          </div>
          <span>{catalogue.length} titles</span>
        </div>
        <div className="poster-grid library-grid" data-library-grid>
          {catalogue.map((video, index) => (
            <ArtCard
              key={video.catalogueId}
              video={video}
              index={index}
              onSelect={onDetails}
              onPlay={onPlay}
              mobilePrimaryPlay={Boolean(onPlay)}
            />
          ))}
        </div>
      </section>
    </BrowseChrome>
  );
}
