import { useMemo, useState } from 'react';
import { getStored, setStored } from '@lelibrambas/shared';
import type { Profile, VideoRecord } from '@lelibrambas/types';
import { archivePlaceholderCategories, catalogue, collections } from './catalogue';

export type BrowseScreenId = 'home' | 'search' | 'hubs' | 'collections';

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

const processingLabels: Record<VideoRecord['processingStatus'], string> = {
  ready: 'Ready',
  processing: 'Preparing viewing copy',
  failed: 'Needs review',
  unavailable: 'Catalogue only',
};

type PrimaryNavScreenId = 'home' | 'search' | 'collections';
type NavIconId = PrimaryNavScreenId;

const navItems: Array<{ id: PrimaryNavScreenId; icon: NavIconId; label: string }> = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'search', icon: 'search', label: 'Search' },
  { id: 'collections', icon: 'collections', label: 'Collections' },
];

function CinemaIcon() {
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

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="4" y="4.4" width="6.1" height="6.1" rx="1.3" />
      <rect x="13.9" y="4.4" width="6.1" height="6.1" rx="1.3" />
      <rect x="4" y="13.5" width="6.1" height="6.1" rx="1.3" />
      <rect x="13.9" y="13.5" width="6.1" height="6.1" rx="1.3" />
    </svg>
  );
}

function durationLabel(video: VideoRecord): string {
  if (video.sourceType === 'synthetic' && video.processingStatus === 'unavailable') {
    return 'Catalogue only';
  }
  if (video.durationSeconds < 60) return `${Math.round(video.durationSeconds)} sec`;
  return `${Math.round(video.durationSeconds / 60)} min`;
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

function ArtCard({
  video,
  onSelect,
  index = 0,
}: {
  video: VideoRecord;
  onSelect: (video: VideoRecord) => void;
  index?: number;
}) {
  const [a, b, c] = video.artwork.palette;
  const style = { '--art-a': a, '--art-b': b, '--art-c': c } as React.CSSProperties;
  return (
    <button
      data-focusable
      data-focus-id={`browse-${video.id}`}
      className="browse-card"
      style={style}
      onClick={() => onSelect(video)}
    >
      <span className="browse-art">
        <i />
        <b>{String(index + 1).padStart(2, '0')}</b>
        {video.processingStatus !== 'ready' && (
          <em className={`status-${video.processingStatus}`}>
            {processingLabels[video.processingStatus]}
          </em>
        )}
      </span>
      <span>
        <strong>{video.title}</strong>
        <small>
          {video.year ?? 'Year unknown'} - {video.location ?? 'Archive shelf'} -{' '}
          {durationLabel(video)}
        </small>
      </span>
    </button>
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
        <footer className="browse-footer">
          LeliBramBas+ - Private family archive prototype - Synthetic demo media
        </footer>
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

const hubData = collections.map((collection, index) => ({
  ...collection,
  code: String(index + 1).padStart(2, '0'),
  line: `${collection.videoIds.length} synthetic directory records.`,
  palette: hubPalettes[index % hubPalettes.length] ?? hubPalettes[0],
}));

export function HubsScreen({
  profile,
  onNavigate,
  onDetails,
  onReplayIntro,
  onProfile,
}: {
  profile: Profile;
  onNavigate: (screen: BrowseScreenId) => void;
  onDetails: (video: VideoRecord) => void;
  onReplayIntro: () => void;
  onProfile: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const hub = hubData[selected] ?? hubData[0]!;
  const matches = hub.videoIds
    .map((id) => catalogue.find((video) => video.id === id))
    .filter((video): video is VideoRecord => Boolean(video));
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
            <small>LeliBramBas+</small>
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
            <ArtCard key={video.id} video={video} index={index} onSelect={onDetails} />
          ))}
        </div>
      </section>
    </BrowseChrome>
  );
}

const keyboard = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

export function SearchScreen({
  profile,
  onNavigate,
  onDetails,
  onReplayIntro,
  onProfile,
}: {
  profile: Profile;
  onNavigate: (screen: BrowseScreenId) => void;
  onDetails: (video: VideoRecord) => void;
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
    [normalized],
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
        <span className="voice-placeholder" aria-label="Voice search architecture placeholder">
          Voice search - future adapter
        </span>
      }
    >
      <div className="search-layout">
        <section className="search-panel">
          <label htmlFor="archive-search">Which folder should we open?</label>
          <div className="search-input">
            <span>S</span>
            <input
              id="archive-search"
              data-focusable
              data-focus-id="search-input"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try JEUGDFILMS, Vakantiefilm or 01"
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
          <div className="recent-searches">
            <span>Recent</span>
            {['JEUGDFILMS', 'Vakantiefilm', '01'].map((item) => (
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
        </section>
        <section className="search-results">
          <div className="result-title">
            <div>
              <p>{normalized ? 'Matches' : 'Suggested for you'}</p>
              <h2>{normalized ? `"${query}"` : 'Start with a familiar shelf'}</h2>
            </div>
            <span>{results.length} results</span>
          </div>
          {results.length ? (
            <div className="search-grid">
              {results.slice(0, 12).map((video, index) => (
                <ArtCard key={video.id} video={video} index={index} onSelect={onDetails} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <b>No placeholder found.</b>
              <p>Try a top-level folder, subfolder, year or title.</p>
            </div>
          )}
        </section>
      </div>
    </BrowseChrome>
  );
}

export function CollectionsScreen({
  profile,
  onNavigate,
  onDetails,
  onReplayIntro,
  onProfile,
}: {
  profile: Profile;
  onNavigate: (screen: BrowseScreenId) => void;
  onDetails: (video: VideoRecord) => void;
  onReplayIntro: () => void;
  onProfile: () => void;
}) {
  const [selected, setSelected] = useState(collections[0]!.id);
  const collection = collections.find((item) => item.id === selected) ?? collections[0]!;
  const categoryTree = archivePlaceholderCategories.find((item) => item.name === collection.title);
  const videos = collection.videoIds
    .map((id) => catalogue.find((video) => video.id === id))
    .filter(Boolean) as VideoRecord[];
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
      <section className="collection-grid">
        {collections.map((item, index) => (
          <button
            key={item.id}
            data-focusable
            data-focus-id={`collection-${item.id}`}
            className={selected === item.id ? 'active' : ''}
            onClick={() => setSelected(item.id)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <small>{item.kind}</small>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            <em>{item.videoIds.length} catalogue records</em>
          </button>
        ))}
      </section>
      <section className="result-block">
        <div className="result-title">
          <div>
            <p>{collection.kind} collection</p>
            <h2>{collection.title}</h2>
          </div>
          <span>Directory order</span>
        </div>
        {categoryTree?.groups?.length ? (
          <div className="collection-group-strip" aria-label={`${collection.title} subfolders`}>
            {categoryTree.groups.map((group, groupIndex) => (
              <div className="collection-group-card" key={group.name}>
                <small>{String(groupIndex + 1).padStart(2, '0')} subfolder</small>
                <strong>{group.name}</strong>
                <span>{group.movies.length} records</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="episode-list">
          {videos.map((video, index) => (
            <button
              key={video.id}
              data-focusable
              data-focus-id={`episode-${video.id}`}
              onClick={() => onDetails(video)}
            >
              <b>{String(index + 1).padStart(2, '0')}</b>
              <i
                style={
                  {
                    '--art-a': video.artwork.palette[0],
                    '--art-b': video.artwork.palette[1],
                    '--art-c': video.artwork.palette[2],
                  } as React.CSSProperties
                }
              />
              <span>
                <strong>{video.title}</strong>
                <small>Catalogue only - {video.location}</small>
              </span>
              <em>&gt;</em>
            </button>
          ))}
        </div>
      </section>
    </BrowseChrome>
  );
}
