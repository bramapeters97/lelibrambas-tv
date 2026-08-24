import { EmptyState, Icon, ProgressBar, StatusPill } from '../components/Primitives';
import { formatBytes } from '../lib/library';
import type { ImportJob, QueueFilter } from '../types';

const filters: Array<{ id: QueueFilter; label: string }> = [
  { id: 'all', label: 'All jobs' },
  { id: 'review', label: 'Awaiting review' },
  { id: 'queued', label: 'Queued' },
  { id: 'processing', label: 'Processing' },
  { id: 'failed', label: 'Failed' },
  { id: 'ready', label: 'Ready to upload' },
  { id: 'uploaded', label: 'Uploaded' },
];

interface QueueViewProps {
  jobs: ImportJob[];
  filter: QueueFilter;
  onFilter: (filter: QueueFilter) => void;
  onRetry: (jobId: string) => void;
  onUpload: (jobId: string) => void;
  onUpdate: (jobId: string, patch: Partial<ImportJob>) => void;
  onImport: () => void;
}

function jobStatusLabel(status: ImportJob['status']): string {
  const labels: Record<ImportJob['status'], string> = {
    review: 'Awaiting review',
    queued: 'Queued',
    processing: 'Processing',
    failed: 'Failed',
    ready: 'Ready to upload',
    uploaded: 'Uploaded',
  };
  return labels[status];
}

export function QueueView({
  jobs,
  filter,
  onFilter,
  onRetry,
  onUpload,
  onUpdate,
  onImport,
}: QueueViewProps) {
  const visibleJobs = filter === 'all' ? jobs : jobs.filter((job) => job.status === filter);
  const totalSourceBytes = visibleJobs.reduce((total, job) => total + job.sourceSizeBytes, 0);

  return (
    <div className="view-stack" data-testid="queue-view">
      <section className="section-heading section-heading--with-actions">
        <div>
          <p className="eyebrow">Local processing</p>
          <h2>Conversion queue</h2>
          <p>Review, convert and prepare private upload jobs without changing source files.</p>
        </div>
        <button className="button button--primary" type="button" onClick={onImport}>
          <Icon name="add" /> Add source
        </button>
      </section>

      <section className="queue-summary" aria-label="Queue summary">
        <div>
          <span>Jobs in view</span>
          <strong>{visibleJobs.length}</strong>
        </div>
        <div>
          <span>Source size</span>
          <strong>{formatBytes(totalSourceBytes)}</strong>
        </div>
        <div>
          <span>Active workers</span>
          <strong>{jobs.filter((job) => job.status === 'processing').length} / 1</strong>
        </div>
        <div>
          <span>Sources modified</span>
          <strong className="success-text">0</strong>
        </div>
      </section>

      <div className="filter-tabs" role="tablist" aria-label="Conversion status">
        {filters.map((item) => {
          const count =
            item.id === 'all' ? jobs.length : jobs.filter((job) => job.status === item.id).length;
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

      {visibleJobs.length === 0 ? (
        <EmptyState
          title="Nothing in this stage"
          copy="The local queue has no matching jobs. Choose another stage or add a source."
          action={
            <button className="button button--quiet" type="button" onClick={() => onFilter('all')}>
              Show all jobs
            </button>
          }
        />
      ) : (
        <section className="job-list" aria-label={`${filter} jobs`}>
          {visibleJobs.map((job) => (
            <article className="job-card" key={job.id}>
              <div
                className={`job-card__source job-card__source--${job.sourceKind}`}
                aria-hidden="true"
              >
                <Icon
                  name={
                    job.sourceKind === 'video-ts'
                      ? 'disc'
                      : job.sourceKind === 'folder'
                        ? 'folder'
                        : 'file'
                  }
                />
              </div>
              <div className="job-card__main">
                <div className="job-card__heading">
                  <div>
                    <strong>{job.displayName}</strong>
                    <span>{job.sourceReference}</span>
                  </div>
                  <StatusPill status={job.status} label={jobStatusLabel(job.status)} />
                </div>
                <div className="job-card__facts">
                  <span>
                    {job.filesFound} {job.filesFound === 1 ? 'file' : 'files'}
                  </span>
                  <span>{formatBytes(job.sourceSizeBytes)}</span>
                  <span>{job.preset}</span>
                </div>
                {(job.status === 'processing' || job.status === 'queued') && (
                  <ProgressBar value={job.progress} label={`${job.displayName} progress`} />
                )}
                {job.error && (
                  <div className="inline-alert inline-alert--error" role="alert">
                    <Icon name="warning" />
                    <span>
                      <strong>Conversion paused</strong>
                      {job.error}
                    </span>
                  </div>
                )}
                {job.duplicateOf && (
                  <div className="inline-alert inline-alert--warning">
                    <Icon name="warning" />
                    <span>
                      <strong>Possible duplicate</strong>Fast fingerprint matches catalogue item{' '}
                      {job.duplicateOf}.
                    </span>
                  </div>
                )}
              </div>
              <div className="job-card__actions">
                {job.status === 'failed' && (
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => onRetry(job.id)}
                  >
                    <Icon name="refresh" /> Retry
                  </button>
                )}
                {job.status === 'ready' && (
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() => onUpload(job.id)}
                  >
                    <Icon name="cloud" /> Generate upload job
                  </button>
                )}
                {job.status === 'queued' && (
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() =>
                      onUpdate(job.id, { status: 'processing', progress: 8, etaMinutes: 34 })
                    }
                  >
                    <Icon name="play" /> Start locally
                  </button>
                )}
                {job.status === 'processing' && (
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() =>
                      onUpdate(job.id, {
                        status: 'ready',
                        progress: 100,
                        etaMinutes: null,
                        outputSizeBytes: Math.max(
                          job.outputSizeBytes,
                          Math.round(job.sourceSizeBytes * 0.38),
                        ),
                      })
                    }
                  >
                    Complete demo job
                  </button>
                )}
                {job.status === 'review' && (
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => onUpdate(job.id, { status: 'queued', progress: 0 })}
                  >
                    Approve &amp; queue
                  </button>
                )}
                {job.status === 'uploaded' && (
                  <button className="button button--quiet" type="button" disabled>
                    <Icon name="check" /> Delivered
                  </button>
                )}
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`More actions for ${job.displayName}`}
                >
                  <Icon name="more" />
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
