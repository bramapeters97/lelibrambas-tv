import { useMemo } from 'react';
import { Artwork, EmptyState, Icon, StatusPill, VideoStatus } from '../components/Primitives';
import { formatDuration } from '../lib/library';
import type { CatalogueFilter, ImportJob, VideoRecord } from '../types';

interface CatalogueViewProps {
  videos: VideoRecord[];
  jobs: ImportJob[];
  filter: CatalogueFilter;
  query: string;
  onFilter: (filter: CatalogueFilter) => void;
  onQuery: (query: string) => void;
  onEdit: (video: VideoRecord) => void;
  onImport: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
}

const catalogueFilters: Array<{ id: CatalogueFilter; label: string }> = [
  { id: 'all', label: 'All titles' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'missing-metadata', label: 'Missing metadata' },
  { id: 'missing-artwork', label: 'Missing artwork' },
  { id: 'duplicates', label: 'Duplicates' },
];

function matchesQuery(video: VideoRecord, query: string): boolean {
  if (!query.trim()) return true;
  const haystack = [
    video.title,
    video.subtitle,
    video.description,
    video.originalFilename,
    video.place,
    video.country,
    video.collection,
    ...video.people,
    ...video.tags,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function matchesFilter(video: VideoRecord, filter: CatalogueFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'drafts') return video.publishState === 'draft';
  if (filter === 'missing-metadata')
    return !video.recordingDate || !video.place || video.people.length === 0;
  if (filter === 'missing-artwork') return video.artworkStatus.startsWith('missing');
  return true;
}

export function CatalogueView({
  videos,
  jobs,
  filter,
  query,
  onFilter,
  onQuery,
  onEdit,
  onImport,
  onExportJson,
  onExportCsv,
}: CatalogueViewProps) {
  const visibleVideos = useMemo(
    () => videos.filter((video) => matchesQuery(video, query) && matchesFilter(video, filter)),
    [filter, query, videos],
  );
  const duplicateJobs = jobs.filter((job) => job.duplicateOf);

  return (
    <div className="view-stack" data-testid="catalogue-view">
      <section className="section-heading section-heading--with-actions">
        <div>
          <p className="eyebrow">Private catalogue</p>
          <h2>Videos</h2>
          <p>Review every title, its discovery metadata, artwork state and publishing readiness.</p>
        </div>
        <div className="button-row">
          <button className="button button--quiet" type="button" onClick={onExportCsv}>
            <Icon name="download" /> CSV
          </button>
          <button className="button button--quiet" type="button" onClick={onExportJson}>
            <Icon name="download" /> JSON
          </button>
          <button className="button button--primary" type="button" onClick={onImport}>
            <Icon name="add" /> Import
          </button>
        </div>
      </section>

      <section className="catalogue-toolbar">
        <label className="search-field search-field--large">
          <Icon name="search" />
          <span className="sr-only">Search catalogue</span>
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search title, filename, person, place or year…"
          />
          {query && (
            <button type="button" onClick={() => onQuery('')} aria-label="Clear search">
              <Icon name="close" />
            </button>
          )}
        </label>
        <div className="catalogue-count">
          <strong>{filter === 'duplicates' ? duplicateJobs.length : visibleVideos.length}</strong>
          <span>results</span>
        </div>
      </section>

      <div className="filter-tabs" role="tablist" aria-label="Catalogue filters">
        {catalogueFilters.map((item) => {
          let count = videos.length;
          if (item.id === 'drafts')
            count = videos.filter((video) => video.publishState === 'draft').length;
          if (item.id === 'missing-metadata')
            count = videos.filter(
              (video) => !video.recordingDate || !video.place || video.people.length === 0,
            ).length;
          if (item.id === 'missing-artwork')
            count = videos.filter((video) => video.artworkStatus.startsWith('missing')).length;
          if (item.id === 'duplicates') count = duplicateJobs.length;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={filter === item.id ? 'is-active' : ''}
              key={item.id}
              onClick={() => onFilter(item.id)}
            >
              {item.label}
              <span>{count}</span>
            </button>
          );
        })}
      </div>

      {filter === 'duplicates' ? (
        <section className="duplicate-grid">
          {duplicateJobs.map((job) => {
            const original = videos.find((video) => video.id === job.duplicateOf);
            return (
              <article className="panel duplicate-card" key={job.id}>
                <header>
                  <StatusPill status="warning" label="Fingerprint match" />
                  <span>Review required</span>
                </header>
                <div className="duplicate-pair">
                  <div>
                    <span className="file-token">
                      <Icon name="file" />
                    </span>
                    <strong>{job.displayName}</strong>
                    <small>New source · {job.sourceReference}</small>
                  </div>
                  <span className="duplicate-pair__link">≈</span>
                  <div>
                    <span className="file-token file-token--catalogue">
                      <Icon name="catalogue" />
                    </span>
                    <strong>{original?.title ?? job.duplicateOf}</strong>
                    <small>Existing catalogue item</small>
                  </div>
                </div>
                <p>
                  The fast fingerprint and duration are similar. Neither file will be deleted
                  automatically.
                </p>
                <div className="button-row">
                  <button className="button button--quiet" type="button">
                    Keep both
                  </button>
                  <button className="button button--primary" type="button">
                    Compare metadata
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : visibleVideos.length === 0 ? (
        <EmptyState
          title="No matching titles"
          copy="Try a broader search or choose a different catalogue filter."
        />
      ) : (
        <section className="catalogue-table" role="table" aria-label="Video catalogue">
          <div className="catalogue-table__header" role="row">
            <span role="columnheader">Title</span>
            <span role="columnheader">Recorded</span>
            <span role="columnheader">People &amp; place</span>
            <span role="columnheader">Source</span>
            <span role="columnheader">State</span>
            <span role="columnheader" className="sr-only">
              Actions
            </span>
          </div>
          {visibleVideos.map((video) => (
            <div className="catalogue-row" role="row" key={video.id}>
              <div className="catalogue-row__title" role="cell">
                <Artwork video={video} compact />
                <span>
                  <strong>{video.title}</strong>
                  <small>{video.originalFilename}</small>
                </span>
              </div>
              <div role="cell">
                <strong>{video.recordingDate ?? 'Date needed'}</strong>
                <small>
                  {formatDuration(video.durationSeconds)} · {video.aspectRatio}
                </small>
              </div>
              <div role="cell">
                <strong>{video.people.join(', ') || 'People needed'}</strong>
                <small>
                  {video.place || 'Place needed'}
                  {video.country ? `, ${video.country}` : ''}
                </small>
              </div>
              <div role="cell">
                <strong>{video.sourceType.replace(/-/g, ' ')}</strong>
                <small>
                  {video.resolution} · {video.frameRate} fps
                </small>
              </div>
              <div className="catalogue-row__state" role="cell">
                <VideoStatus status={video.processingStatus} />
                {video.artworkStatus.startsWith('missing') && (
                  <StatusPill status="warning" label="Artwork" />
                )}
              </div>
              <div role="cell">
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => onEdit(video)}
                  aria-label={`Edit ${video.title}`}
                >
                  <Icon name="edit" />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export function ReviewView({
  videos,
  onEdit,
  onImport,
}: Pick<CatalogueViewProps, 'videos' | 'onEdit' | 'onImport'>) {
  const reviewVideos = videos.filter(
    (video) => video.processingStatus === 'awaiting-review' || video.publishState === 'draft',
  );

  return (
    <div className="view-stack" data-testid="review-view">
      <section className="section-heading section-heading--with-actions">
        <div>
          <p className="eyebrow">Human review</p>
          <h2>Files awaiting review</h2>
          <p>
            Confirm inferred metadata before any item enters conversion or appears in the viewer.
          </p>
        </div>
        <button className="button button--primary" type="button" onClick={onImport}>
          <Icon name="add" /> Import more
        </button>
      </section>
      <section className="review-summary">
        <div>
          <strong>{reviewVideos.length}</strong>
          <span>awaiting review</span>
        </div>
        <div>
          <strong>{reviewVideos.filter((video) => !video.recordingDate).length}</strong>
          <span>dates needed</span>
        </div>
        <div>
          <strong>
            {reviewVideos.filter((video) => video.artworkStatus.startsWith('missing')).length}
          </strong>
          <span>artwork needed</span>
        </div>
        <div>
          <strong>0</strong>
          <span>sources changed</span>
        </div>
      </section>
      <section className="review-card-grid">
        {reviewVideos.map((video) => (
          <article className="review-card" key={video.id}>
            <Artwork video={video} />
            <div className="review-card__body">
              <div className="review-card__heading">
                <div>
                  <strong>{video.title}</strong>
                  <span>{video.originalFilename}</span>
                </div>
                <VideoStatus status={video.processingStatus} />
              </div>
              <dl className="review-card__facts">
                <div>
                  <dt>Date</dt>
                  <dd className={!video.recordingDate ? 'needs-value' : ''}>
                    {video.recordingDate ?? 'Needs review'}
                  </dd>
                </div>
                <div>
                  <dt>Place</dt>
                  <dd className={!video.place ? 'needs-value' : ''}>
                    {video.place || 'Needs review'}
                  </dd>
                </div>
                <div>
                  <dt>People</dt>
                  <dd>{video.people.join(', ') || 'Needs review'}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{video.sourceType.replace(/-/g, ' ')}</dd>
                </div>
              </dl>
              <div className="button-row">
                <button
                  className="button button--primary button--wide"
                  type="button"
                  onClick={() => onEdit(video)}
                >
                  <Icon name="edit" /> Review metadata
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
