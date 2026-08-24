import { Artwork, Icon, ProgressBar, StatusPill, VideoStatus } from '../components/Primitives';
import { formatBytes, formatCompactDuration, type LibraryMetrics } from '../lib/library';
import type { AppView, CatalogueFilter, LibrarySnapshot, QueueFilter, VideoRecord } from '../types';

interface DashboardViewProps {
  snapshot: LibrarySnapshot;
  metrics: LibraryMetrics;
  onNavigate: (view: AppView) => void;
  onQueueFilter: (filter: QueueFilter) => void;
  onCatalogueFilter: (filter: CatalogueFilter) => void;
  onEdit: (video: VideoRecord) => void;
  onImport: () => void;
}

export function DashboardView({
  snapshot,
  metrics,
  onNavigate,
  onQueueFilter,
  onCatalogueFilter,
  onEdit,
  onImport,
}: DashboardViewProps) {
  const reviewVideos = snapshot.videos
    .filter(
      (video) => video.publishState === 'draft' || video.processingStatus === 'awaiting-review',
    )
    .slice(0, 4);
  const processingJob = snapshot.jobs.find((job) => job.status === 'processing');
  const reviewJobs = snapshot.jobs.filter((job) => job.status === 'review').length;
  const readyJobs = snapshot.jobs.filter((job) => job.status === 'ready').length;
  const published = snapshot.videos.filter((video) => video.publishState === 'published').length;

  const openQueue = (filter: QueueFilter) => {
    onQueueFilter(filter);
    onNavigate('queue');
  };

  const openCatalogue = (filter: CatalogueFilter) => {
    onCatalogueFilter(filter);
    onNavigate('catalogue');
  };

  return (
    <div className="view-stack dashboard-view" data-testid="dashboard-view">
      <section className="dashboard-welcome">
        <div className="dashboard-welcome__copy">
          <p className="eyebrow">Monday, 17 August · Local archive</p>
          <h2>Good morning, Bram.</h2>
          <p>
            Your private archive prototype is healthy. A few synthetic records need a human decision
            before the next family screening.
          </p>
          <div className="button-row">
            <button className="button button--primary" type="button" onClick={onImport}>
              <Icon name="add" /> Import videos
            </button>
            <button
              className="button button--quiet"
              type="button"
              onClick={() => onNavigate('review')}
            >
              Review new files <Icon name="chevron" />
            </button>
          </div>
        </div>
        <div className="archive-health" aria-label="Archive readiness 87 percent">
          <div className="archive-health__ring">
            <span>87%</span>
          </div>
          <div>
            <strong>Archive readiness</strong>
            <span>28 of 32 titles ready</span>
          </div>
        </div>
      </section>

      <section className="hero-metrics" aria-label="Library summary">
        <article className="hero-metric">
          <span className="hero-metric__icon">
            <Icon name="catalogue" />
          </span>
          <div>
            <strong>{metrics.totalVideos}</strong>
            <span>Total videos</span>
          </div>
          <small>+{metrics.recentlyAdded} this week</small>
        </article>
        <article className="hero-metric">
          <span className="hero-metric__icon hero-metric__icon--gold">◷</span>
          <div>
            <strong>{formatCompactDuration(metrics.totalDurationSeconds)}</strong>
            <span>Total duration</span>
          </div>
          <small>{metrics.unwatched} still unwatched</small>
        </article>
        <article className="hero-metric">
          <span className="hero-metric__icon hero-metric__icon--violet">◫</span>
          <div>
            <strong>{formatBytes(metrics.totalSourceBytes)}</strong>
            <span>Source archive</span>
          </div>
          <small>{formatBytes(metrics.convertedBytes)} converted</small>
        </article>
        <article className="hero-metric">
          <span className="hero-metric__icon hero-metric__icon--green">
            <Icon name="check" />
          </span>
          <div>
            <strong>{published}</strong>
            <span>Published titles</span>
          </div>
          <small>Private by default</small>
        </article>
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-grid__main view-stack">
          <section className="panel pipeline-panel">
            <header className="panel__header">
              <div>
                <p className="eyebrow">Ingestion pipeline</p>
                <h3>From source to living room</h3>
              </div>
              <button className="text-button" type="button" onClick={() => openQueue('all')}>
                View queue <Icon name="chevron" />
              </button>
            </header>
            <div className="pipeline" role="list" aria-label="Import pipeline status">
              <button type="button" role="listitem" onClick={() => onNavigate('review')}>
                <span>01</span>
                <strong>{reviewJobs} to review</strong>
                <small>Metadata &amp; duplicates</small>
              </button>
              <span className="pipeline__connector" aria-hidden="true" />
              <button type="button" role="listitem" onClick={() => openQueue('processing')}>
                <span>02</span>
                <strong>{metrics.processing} processing</strong>
                <small>Local conversions</small>
              </button>
              <span className="pipeline__connector" aria-hidden="true" />
              <button type="button" role="listitem" onClick={() => openQueue('ready')}>
                <span>03</span>
                <strong>{readyJobs} ready</strong>
                <small>Upload jobs</small>
              </button>
              <span className="pipeline__connector" aria-hidden="true" />
              <button type="button" role="listitem" onClick={() => openQueue('uploaded')}>
                <span>04</span>
                <strong>
                  {snapshot.jobs.filter((job) => job.status === 'uploaded').length} delivered
                </strong>
                <small>Viewer catalogue</small>
              </button>
            </div>
          </section>

          <section className="panel">
            <header className="panel__header">
              <div>
                <p className="eyebrow">Needs attention</p>
                <h3>Metadata review</h3>
              </div>
              <button className="text-button" type="button" onClick={() => onNavigate('review')}>
                Review all{' '}
                {reviewVideos.length > 0
                  ? snapshot.videos.filter((video) => video.processingStatus === 'awaiting-review')
                      .length
                  : 0}{' '}
                <Icon name="chevron" />
              </button>
            </header>
            <div className="review-list">
              {reviewVideos.map((video) => (
                <article className="review-row" key={video.id}>
                  <Artwork video={video} compact />
                  <div className="review-row__title">
                    <strong>{video.title}</strong>
                    <span>
                      {video.originalFilename} · {video.year ?? 'Date missing'}
                    </span>
                  </div>
                  <div className="review-row__issues">
                    {!video.recordingDate && <StatusPill status="warning" label="Date needed" />}
                    {video.artworkStatus.startsWith('missing') && (
                      <StatusPill status="warning" label="Artwork" />
                    )}
                    {video.recordingDate && !video.artworkStatus.startsWith('missing') && (
                      <VideoStatus status={video.processingStatus} />
                    )}
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => onEdit(video)}
                    aria-label={`Edit ${video.title}`}
                  >
                    <Icon name="edit" />
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="dashboard-grid__aside view-stack" aria-label="Archive activity">
          <section className="panel now-processing">
            <header className="panel__header panel__header--compact">
              <div>
                <p className="eyebrow">Now processing</p>
                <h3>{processingJob?.displayName ?? 'Queue is clear'}</h3>
              </div>
              {processingJob && <StatusPill status="processing" label="Active" />}
            </header>
            {processingJob ? (
              <>
                <div className="disc-visual" aria-hidden="true">
                  <span />
                  <i />
                </div>
                <ProgressBar
                  value={processingJob.progress}
                  label={`${processingJob.displayName} conversion progress`}
                />
                <dl className="inline-facts">
                  <div>
                    <dt>Profile</dt>
                    <dd>DVD PAL</dd>
                  </div>
                  <div>
                    <dt>Remaining</dt>
                    <dd>{processingJob.etaMinutes} min</dd>
                  </div>
                  <div>
                    <dt>Output</dt>
                    <dd>{formatBytes(processingJob.outputSizeBytes)}</dd>
                  </div>
                </dl>
                <button
                  className="button button--quiet button--wide"
                  type="button"
                  onClick={() => openQueue('processing')}
                >
                  Open conversion queue
                </button>
              </>
            ) : (
              <p className="muted">No local conversion is running.</p>
            )}
          </section>

          <section className="panel attention-card">
            <header className="panel__header panel__header--compact">
              <div>
                <p className="eyebrow">Archive check</p>
                <h3>What needs a look</h3>
              </div>
            </header>
            <button type="button" onClick={() => openCatalogue('missing-metadata')}>
              <span className="attention-card__mark">
                {metrics.missingDates + metrics.missingLocations}
              </span>
              <span>
                <strong>Missing metadata</strong>
                <small>Dates or places</small>
              </span>
              <Icon name="chevron" />
            </button>
            <button type="button" onClick={() => openCatalogue('missing-artwork')}>
              <span className="attention-card__mark">{metrics.missingArtwork}</span>
              <span>
                <strong>Missing artwork</strong>
                <small>Poster or backdrop</small>
              </span>
              <Icon name="chevron" />
            </button>
            <button type="button" onClick={() => openCatalogue('duplicates')}>
              <span className="attention-card__mark">
                {snapshot.jobs.filter((job) => job.duplicateOf).length}
              </span>
              <span>
                <strong>Possible duplicate</strong>
                <small>Fingerprint match</small>
              </span>
              <Icon name="chevron" />
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
