import { useMemo, useState } from 'react';
import { Icon, ProgressBar, StatusPill } from '../components/Primitives';
import { formatBytes, formatDuration } from '../lib/library';
import type { ImportJob } from '../types';

interface VideoTsViewProps {
  jobs: ImportJob[];
  onToggleCandidate: (jobId: string, candidateId: string) => void;
  onQueue: (jobId: string) => void;
  onUpdate: (jobId: string, patch: Partial<ImportJob>) => void;
  onImport: () => void;
}

export function VideoTsView({
  jobs,
  onToggleCandidate,
  onQueue,
  onUpdate,
  onImport,
}: VideoTsViewProps) {
  const dvdJobs = jobs.filter((job) => job.sourceKind === 'video-ts');
  const defaultJob = dvdJobs.find((job) => job.candidates.length > 0) ?? dvdJobs[0];
  const [selectedId, setSelectedId] = useState(defaultJob?.id ?? '');
  const selectedJob = dvdJobs.find((job) => job.id === selectedId) ?? defaultJob;

  const selectedDuration = useMemo(
    () =>
      selectedJob?.candidates
        .filter((candidate) => candidate.selected)
        .reduce((total, candidate) => total + candidate.durationSeconds, 0) ?? 0,
    [selectedJob],
  );

  return (
    <div className="view-stack dvd-view" data-testid="video-ts-view">
      <section className="section-heading section-heading--with-actions">
        <div>
          <p className="eyebrow">Legacy video</p>
          <h2>VIDEO_TS review</h2>
          <p>
            Interpret DVD structures, choose meaningful titles and prepare non-destructive viewing
            copies.
          </p>
        </div>
        <button className="button button--primary" type="button" onClick={onImport}>
          <Icon name="disc" /> Scan DVD folder
        </button>
      </section>

      <div className="dvd-layout">
        <aside className="panel dvd-source-list" aria-label="Detected DVD sources">
          <header className="panel__header panel__header--compact">
            <div>
              <p className="eyebrow">Detected sources</p>
              <h3>{dvdJobs.length} DVD folders</h3>
            </div>
          </header>
          <div className="dvd-source-list__items">
            {dvdJobs.map((job) => (
              <button
                type="button"
                className={job.id === selectedJob?.id ? 'is-active' : ''}
                key={job.id}
                onClick={() => setSelectedId(job.id)}
              >
                <span className="dvd-source-list__disc">
                  <Icon name="disc" />
                </span>
                <span>
                  <strong>{job.displayName}</strong>
                  <small>
                    {job.filesFound} files · {formatBytes(job.sourceSizeBytes)}
                  </small>
                </span>
                <StatusPill
                  status={job.status}
                  label={job.status === 'review' ? 'Review' : job.status}
                />
              </button>
            ))}
          </div>
          <div className="safety-note">
            <Icon name="check" />
            <span>
              <strong>Read-only source policy</strong>Original IFO, BUP and VOB files are never
              renamed, moved or changed.
            </span>
          </div>
        </aside>

        {selectedJob && (
          <div className="dvd-workspace view-stack">
            <section className="panel dvd-overview">
              <div className="dvd-overview__header">
                <div className="dvd-overview__disc" aria-hidden="true">
                  <span />
                  <i />
                </div>
                <div>
                  <p className="eyebrow">Scan complete · review required</p>
                  <h3>{selectedJob.displayName}</h3>
                  <p className="path-copy">{selectedJob.sourceReference}</p>
                </div>
                <div className="dvd-overview__actions">
                  <StatusPill status="safe" label="Source verified" />
                  <button className="icon-button" type="button" aria-label="More DVD actions">
                    <Icon name="more" />
                  </button>
                </div>
              </div>
              <dl className="dvd-facts">
                <div>
                  <dt>DVD standard</dt>
                  <dd>PAL · Region free</dd>
                </div>
                <div>
                  <dt>Structure</dt>
                  <dd>{selectedJob.filesFound} files · 3 title sets</dd>
                </div>
                <div>
                  <dt>Source size</dt>
                  <dd>{formatBytes(selectedJob.sourceSizeBytes)}</dd>
                </div>
                <div>
                  <dt>Discovery</dt>
                  <dd>HandBrake-ready fallback</dd>
                </div>
              </dl>
              <div className="scan-steps" aria-label="VIDEO_TS scan progress">
                <div className="is-complete">
                  <span>
                    <Icon name="check" />
                  </span>
                  <strong>Structure indexed</strong>
                  <small>Original preserved</small>
                </div>
                <i />
                <div className="is-complete">
                  <span>
                    <Icon name="check" />
                  </span>
                  <strong>Titles analysed</strong>
                  <small>Menus excluded</small>
                </div>
                <i />
                <div className="is-active">
                  <span>3</span>
                  <strong>Human review</strong>
                  <small>Choose titles</small>
                </div>
                <i />
                <div>
                  <span>4</span>
                  <strong>Prepare copies</strong>
                  <small>Not started</small>
                </div>
              </div>
            </section>

            {selectedJob.candidates.length > 0 ? (
              <section className="panel candidate-panel">
                <header className="panel__header">
                  <div>
                    <p className="eyebrow">Title interpretation</p>
                    <h3>Three playable candidates found</h3>
                    <p>Select the family footage to keep. Short menu loops stay excluded.</p>
                  </div>
                  <div className="selected-runtime">
                    <span>Selected runtime</span>
                    <strong>{formatDuration(selectedDuration)}</strong>
                  </div>
                </header>
                <div className="candidate-table" role="table" aria-label="DVD title candidates">
                  <div className="candidate-table__header" role="row">
                    <span role="columnheader">Keep</span>
                    <span role="columnheader">Title candidate</span>
                    <span role="columnheader">Duration</span>
                    <span role="columnheader">Video</span>
                    <span role="columnheader">Confidence</span>
                  </div>
                  {selectedJob.candidates.map((candidate) => (
                    <label
                      className={`candidate-row ${candidate.role === 'menu-loop' ? 'candidate-row--muted' : ''}`}
                      key={candidate.id}
                      role="row"
                    >
                      <span role="cell">
                        <input
                          type="checkbox"
                          checked={candidate.selected}
                          disabled={candidate.role === 'menu-loop'}
                          onChange={() => onToggleCandidate(selectedJob.id, candidate.id)}
                          aria-label={`Keep ${candidate.label}`}
                        />
                      </span>
                      <span className="candidate-row__title" role="cell">
                        <span className="candidate-thumb">
                          <Icon name={candidate.role === 'menu-loop' ? 'menu' : 'play'} />
                        </span>
                        <span>
                          <strong>
                            Title {String(candidate.titleNumber).padStart(2, '0')} ·{' '}
                            {candidate.label}
                          </strong>
                          <small>
                            {candidate.chapters} chapters · {candidate.role.replace('-', ' ')}
                          </small>
                        </span>
                      </span>
                      <span role="cell">{formatDuration(candidate.durationSeconds)}</span>
                      <span role="cell">
                        {candidate.resolution}
                        <small>
                          {candidate.aspectRatio} · {candidate.frameRate} fps{' '}
                          {candidate.interlaced ? '· interlaced' : ''}
                        </small>
                      </span>
                      <span role="cell">
                        <StatusPill
                          status={
                            candidate.confidence > 0.9
                              ? 'safe'
                              : candidate.confidence > 0.7
                                ? 'warning'
                                : 'muted'
                          }
                          label={`${Math.round(candidate.confidence * 100)}%`}
                        />
                      </span>
                    </label>
                  ))}
                </div>
                <div className="candidate-footer">
                  <div className="conversion-recipe">
                    <Icon name="settings" />
                    <span>
                      <strong>DVD PAL viewing copy</strong>H.264 · AAC · original 4:3 · deinterlace
                      when detected · chapters retained
                    </span>
                  </div>
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() => onQueue(selectedJob.id)}
                    disabled={!selectedJob.candidates.some((candidate) => candidate.selected)}
                  >
                    Queue {selectedJob.candidates.filter((candidate) => candidate.selected).length}{' '}
                    selected titles <Icon name="chevron" />
                  </button>
                </div>
              </section>
            ) : (
              <section className="panel active-conversion-panel">
                <header className="panel__header">
                  <div>
                    <p className="eyebrow">Viewing-copy conversion</p>
                    <h3>
                      {selectedJob.status === 'processing'
                        ? 'Conversion in progress'
                        : 'Title review complete'}
                    </h3>
                  </div>
                  <StatusPill status={selectedJob.status} />
                </header>
                <ProgressBar value={selectedJob.progress} />
                <div className="log-lines">
                  {selectedJob.log.map((line) => (
                    <span key={line}>
                      <Icon name="check" /> {line}
                    </span>
                  ))}
                </div>
                {selectedJob.status === 'processing' && (
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() =>
                      onUpdate(selectedJob.id, { status: 'ready', progress: 100, etaMinutes: null })
                    }
                  >
                    Complete demo conversion
                  </button>
                )}
              </section>
            )}

            <section className="code-preview" aria-label="Importer command preview">
              <div>
                <Icon name="queue" />
                <span>
                  <strong>Dry-run command</strong>Safe to inspect before conversion
                </span>
              </div>
              <code>
                yarn importer prepare --folder &quot;.\synthetic-demo\JEUGDFILMS&quot; --dry-run
              </code>
              <button className="icon-button" type="button" aria-label="Copy command">
                <span aria-hidden="true">□</span>
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
