import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from './components/Primitives';
import { ImportModal, MetadataEditor } from './components/EditorModals';
import { useLibraryStore } from './hooks/useLibraryStore';
import {
  calculateMetrics,
  downloadText,
  parseSnapshotJson,
  videosFromCsv,
  videosToCsv,
} from './lib/library';
import { CatalogueView, ReviewView } from './views/CatalogueView';
import { DashboardView } from './views/DashboardView';
import { CollectionsView, RailsView } from './views/LibraryViews';
import { QueueView } from './views/QueueView';
import { DevicesView, SettingsView } from './views/SystemViews';
import { VideoTsView } from './views/VideoTsView';
import type { AppView, CatalogueFilter, QueueFilter, VideoRecord } from './types';
import './styles.css';

interface NavItem {
  id: AppView;
  label: string;
  icon: IconName;
  badge?: number;
}

const validViews: AppView[] = [
  'dashboard',
  'review',
  'queue',
  'video-ts',
  'catalogue',
  'collections',
  'rails',
  'devices',
  'settings',
];

const viewMeta: Record<AppView, { title: string; eyebrow: string }> = {
  dashboard: { title: 'Library overview', eyebrow: 'The Family Archive' },
  review: { title: 'Awaiting review', eyebrow: 'Ingestion' },
  queue: { title: 'Conversion queue', eyebrow: 'Ingestion' },
  'video-ts': { title: 'VIDEO_TS review', eyebrow: 'Legacy video' },
  catalogue: { title: 'Catalogue', eyebrow: 'Library' },
  collections: { title: 'Collections', eyebrow: 'Library' },
  rails: { title: 'Homepage rails', eyebrow: 'Presentation' },
  devices: { title: 'Devices', eyebrow: 'Private access' },
  settings: { title: 'Settings', eyebrow: 'Library Manager' },
};

function viewFromHash(): AppView {
  if (typeof window === 'undefined') return 'dashboard';
  const candidate = window.location.hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  return validViews.includes(candidate as AppView) ? (candidate as AppView) : 'dashboard';
}

export default function App() {
  const [snapshot, actions] = useLibraryStore();
  const [view, setView] = useState<AppView>(viewFromHash);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [catalogueFilter, setCatalogueFilter] = useState<CatalogueFilter>('all');
  const [catalogueQuery, setCatalogueQuery] = useState('');
  const [globalQuery, setGlobalQuery] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const globalSearchRef = useRef<HTMLInputElement>(null);
  const metrics = useMemo(() => calculateMetrics(snapshot), [snapshot]);
  const selectedVideo = snapshot.videos.find((video) => video.id === selectedVideoId) ?? null;

  const reviewCount = snapshot.videos.filter(
    (video) => video.processingStatus === 'awaiting-review' || video.publishState === 'draft',
  ).length;
  const failedCount = snapshot.jobs.filter((job) => job.status === 'failed').length;
  const dvdReviewCount = snapshot.jobs.filter(
    (job) => job.sourceKind === 'video-ts' && job.status === 'review',
  ).length;

  const overviewNav: NavItem[] = [{ id: 'dashboard', label: 'Overview', icon: 'dashboard' }];
  const workflowNav: NavItem[] = [
    { id: 'review', label: 'Awaiting review', icon: 'review', badge: reviewCount },
    { id: 'queue', label: 'Conversion queue', icon: 'queue', badge: failedCount },
    { id: 'video-ts', label: 'VIDEO_TS review', icon: 'disc', badge: dvdReviewCount },
  ];
  const libraryNav: NavItem[] = [
    { id: 'catalogue', label: 'Catalogue', icon: 'catalogue' },
    { id: 'collections', label: 'Collections', icon: 'collections' },
    { id: 'rails', label: 'Homepage rails', icon: 'rails' },
  ];
  const systemNav: NavItem[] = [
    {
      id: 'devices',
      label: 'Devices',
      icon: 'devices',
      badge: snapshot.devices.filter((device) => device.state === 'pending').length,
    },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3_000);
  }, []);

  const navigate = useCallback((nextView: AppView) => {
    setView(nextView);
    setMobileNavOpen(false);
    if (typeof window !== 'undefined' && viewFromHash() !== nextView)
      window.location.hash = `/${nextView}`;
    window.setTimeout(() => document.querySelector<HTMLElement>('#main-content h2')?.focus(), 0);
  }, []);

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHashChange);
    if (!window.location.hash) window.history.replaceState(null, '', '#/dashboard');
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]');
      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        globalSearchRef.current?.focus();
      }
      if (event.key.toLowerCase() === 'i' && !isTyping && !importOpen && !selectedVideo) {
        event.preventDefault();
        setImportOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [importOpen, selectedVideo]);

  useEffect(() => {
    document.title = `${viewMeta[view].title} · LeliBramBas+ Library Manager`;
  }, [view]);

  const handleGlobalSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCatalogueQuery(globalQuery);
    setCatalogueFilter('all');
    navigate('catalogue');
  };

  const exportJson = () => {
    downloadText(
      'lelibrambas-catalogue.json',
      JSON.stringify(snapshot, null, 2),
      'application/json',
    );
    notify('Complete catalogue exported locally.');
  };

  const exportCsv = () => {
    downloadText('lelibrambas-videos.csv', videosToCsv(snapshot.videos), 'text/csv;charset=utf-8');
    notify('Video catalogue exported as CSV.');
  };

  const importJson = (text: string) => {
    try {
      actions.replaceSnapshot(parseSnapshotJson(text));
      notify('Validated JSON catalogue imported.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'JSON import failed.');
    }
  };

  const importCsv = (text: string) => {
    try {
      const imported = videosFromCsv(text);
      const combined = new Map(snapshot.videos.map((video) => [video.id, video]));
      imported.forEach((video) => combined.set(video.id, video));
      actions.replaceVideos([...combined.values()]);
      notify(`${imported.length} CSV records imported.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'CSV import failed.');
    }
  };

  const navGroup = (label: string, items: NavItem[]) => (
    <div className="sidebar__group" key={label}>
      <span className="sidebar__group-label">{label}</span>
      <nav aria-label={label}>
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            className={view === item.id ? 'is-active' : ''}
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => navigate(item.id)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
            {Boolean(item.badge) && <b>{item.badge}</b>}
          </button>
        ))}
      </nav>
    </div>
  );

  let content: React.ReactNode;
  switch (view) {
    case 'dashboard':
      content = (
        <DashboardView
          snapshot={snapshot}
          metrics={metrics}
          onNavigate={navigate}
          onQueueFilter={setQueueFilter}
          onCatalogueFilter={setCatalogueFilter}
          onEdit={(video) => setSelectedVideoId(video.id)}
          onImport={() => setImportOpen(true)}
        />
      );
      break;
    case 'review':
      content = (
        <ReviewView
          videos={snapshot.videos}
          onEdit={(video) => setSelectedVideoId(video.id)}
          onImport={() => setImportOpen(true)}
        />
      );
      break;
    case 'queue':
      content = (
        <QueueView
          jobs={snapshot.jobs}
          filter={queueFilter}
          onFilter={setQueueFilter}
          onRetry={(jobId) => {
            actions.retryJob(jobId);
            notify('Job returned to the local queue.');
          }}
          onUpload={(jobId) => {
            actions.createUploadJob(jobId);
            notify('Demo upload job created without a network request.');
          }}
          onUpdate={actions.updateJob}
          onImport={() => setImportOpen(true)}
        />
      );
      break;
    case 'video-ts':
      content = (
        <VideoTsView
          jobs={snapshot.jobs}
          onToggleCandidate={actions.toggleDvdCandidate}
          onQueue={(jobId) => {
            actions.startSelectedDvdConversion(jobId);
            notify('Selected DVD titles added to the local queue.');
          }}
          onUpdate={actions.updateJob}
          onImport={() => setImportOpen(true)}
        />
      );
      break;
    case 'catalogue':
      content = (
        <CatalogueView
          videos={snapshot.videos}
          jobs={snapshot.jobs}
          filter={catalogueFilter}
          query={catalogueQuery}
          onFilter={setCatalogueFilter}
          onQuery={setCatalogueQuery}
          onEdit={(video) => setSelectedVideoId(video.id)}
          onImport={() => setImportOpen(true)}
          onExportJson={exportJson}
          onExportCsv={exportCsv}
        />
      );
      break;
    case 'collections':
      content = <CollectionsView videos={snapshot.videos} />;
      break;
    case 'rails':
      content = (
        <RailsView
          rails={snapshot.rails}
          videos={snapshot.videos}
          onUpdate={actions.updateRail}
          onMove={actions.moveRail}
        />
      );
      break;
    case 'devices':
      content = (
        <DevicesView
          devices={snapshot.devices}
          onUpdate={(deviceId, patch) => {
            actions.updateDevice(deviceId, patch);
            notify('Device access updated locally.');
          }}
        />
      );
      break;
    case 'settings':
      content = (
        <SettingsView
          snapshot={snapshot}
          onUpdate={actions.updateSettings}
          onExportJson={exportJson}
          onImport={() => setImportOpen(true)}
          onReset={() => {
            actions.resetDemo();
            notify('Deterministic demo state restored.');
          }}
        />
      );
      break;
  }

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <button
        className={`mobile-scrim ${mobileNavOpen ? 'is-visible' : ''}`}
        type="button"
        aria-label="Close navigation"
        onClick={() => setMobileNavOpen(false)}
      />
      <aside className={`sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
        <div className="brand-lockup">
          <span className="brand-monogram" aria-hidden="true">
            <i>LB</i>
            <b>+</b>
          </span>
          <span>
            <strong>
              LeliBramBas<span>+</span>
            </strong>
            <small>Library Manager</small>
          </span>
        </div>
        <div className="local-badge">
          <span />
          <strong>Local library</strong>
          <small>Private demo</small>
        </div>
        <div className="sidebar__scroll">
          {navGroup('Overview', overviewNav)}
          {navGroup('Workflow', workflowNav)}
          {navGroup('Library', libraryNav)}
          {navGroup('Access & system', systemNav)}
        </div>
        <div className="sidebar__footer">
          <div className="sidebar__storage">
            <span>
              <i style={{ width: '38%' }} />
            </span>
            <div>
              <strong>Local viewing copies</strong>
              <small>8.4 GB of 22 GB</small>
            </div>
          </div>
          <button type="button" onClick={() => navigate('settings')}>
            <span className="avatar avatar--owner">DO</span>
            <span>
              <strong>Demo Owner</strong>
              <small>Fictional profile</small>
            </span>
            <Icon name="more" />
          </button>
        </div>
      </aside>

      <div className="app-column">
        <header className="topbar">
          <div className="topbar__title">
            <button
              className="mobile-menu-button icon-button"
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <Icon name="menu" />
            </button>
            <div>
              <span>{viewMeta[view].eyebrow}</span>
              <h1>{viewMeta[view].title}</h1>
            </div>
          </div>
          <form className="topbar__search" role="search" onSubmit={handleGlobalSearch}>
            <Icon name="search" />
            <label className="sr-only" htmlFor="global-search">
              Search library
            </label>
            <input
              ref={globalSearchRef}
              id="global-search"
              value={globalQuery}
              onChange={(event) => setGlobalQuery(event.target.value)}
              placeholder="Search the archive"
            />
            <kbd>/</kbd>
          </form>
          <div className="topbar__actions">
            <span className="sync-state">
              <i /> Saved locally
            </span>
            <button
              className="icon-button notification-button"
              type="button"
              aria-label="2 archive notifications"
            >
              <span aria-hidden="true">♢</span>
              <b>2</b>
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={() => setImportOpen(true)}
            >
              <Icon name="add" /> <span>Import</span>
            </button>
          </div>
        </header>

        <main id="main-content" className="main-content" tabIndex={-1}>
          {content}
        </main>
        <footer className="app-footer">
          <span>
            <i /> Local-first prototype
          </span>
          <span>No source files modified · No private media uploaded</span>
          <span>LeliBrambas Studios™</span>
        </footer>
      </div>

      {importOpen && (
        <ImportModal
          onAddSources={(names, kind) => {
            actions.addMockSources(names, kind);
            notify(`${names.length} source${names.length === 1 ? '' : 's'} added for review.`);
          }}
          onImportJson={importJson}
          onImportCsv={importCsv}
          onClose={() => setImportOpen(false)}
        />
      )}
      {selectedVideo && (
        <MetadataEditor
          video={selectedVideo}
          onSave={(patch: Partial<VideoRecord>) => {
            actions.updateVideo(selectedVideo.id, patch);
            notify('Video metadata saved locally.');
          }}
          onClose={() => setSelectedVideoId(null)}
        />
      )}
      <div className={`toast ${toast ? 'is-visible' : ''}`} role="status" aria-live="polite">
        <Icon name="check" />
        <span>{toast}</span>
      </div>
    </div>
  );
}
