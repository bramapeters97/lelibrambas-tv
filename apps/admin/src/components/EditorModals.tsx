import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Artwork, Icon, Modal, StatusPill } from './Primitives';
import { formatDuration } from '../lib/library';
import type { ImportJob, VideoRecord } from '../types';

interface MetadataEditorProps {
  video: VideoRecord;
  onSave: (patch: Partial<VideoRecord>) => void;
  onClose: () => void;
}

export function MetadataEditor({ video, onSave, onClose }: MetadataEditorProps) {
  const [draft, setDraft] = useState(video);
  const [tab, setTab] = useState<'metadata' | 'artwork' | 'technical'>('metadata');
  const update = <Key extends keyof VideoRecord>(key: Key, value: VideoRecord[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <Modal title={draft.title} eyebrow="Video editor" onClose={onClose} className="editor-modal">
      <div className="editor-layout">
        <aside className="editor-preview">
          <Artwork video={draft} />
          <div className="editor-preview__copy">
            <StatusPill status={draft.publishState} />
            <h3>{draft.title || 'Untitled video'}</h3>
            <p>
              {draft.year ?? 'Year needed'} · {formatDuration(draft.durationSeconds)} ·{' '}
              {draft.place || 'Place needed'}
            </p>
          </div>
          <div className="editor-preview__progress">
            <span
              style={{
                width: `${(draft.previewStartSeconds / Math.max(1, draft.durationSeconds)) * 100}%`,
              }}
            />
          </div>
          <small>TV detail preview · synthetic artwork only</small>
        </aside>
        <div className="editor-main">
          <div className="editor-tabs" role="tablist" aria-label="Video editor sections">
            {(['metadata', 'artwork', 'technical'] as const).map((item) => (
              <button
                type="button"
                role="tab"
                aria-selected={tab === item}
                className={tab === item ? 'is-active' : ''}
                key={item}
                onClick={() => setTab(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {tab === 'metadata' && (
            <div className="form-grid editor-form">
              <label className="field field--wide">
                <span>Title</span>
                <input
                  value={draft.title}
                  onChange={(event) => update('title', event.target.value)}
                />
              </label>
              <label className="field field--wide">
                <span>Subtitle</span>
                <input
                  value={draft.subtitle}
                  onChange={(event) => update('subtitle', event.target.value)}
                  placeholder="Optional collection or production line"
                />
              </label>
              <label className="field field--wide">
                <span>Synopsis</span>
                <textarea
                  rows={4}
                  value={draft.description}
                  onChange={(event) => update('description', event.target.value)}
                />
              </label>
              <label className="field">
                <span>Recording date</span>
                <input
                  type="date"
                  value={draft.recordingDate ?? ''}
                  onChange={(event) => update('recordingDate', event.target.value || null)}
                />
              </label>
              <label className="field field--checkbox">
                <input
                  type="checkbox"
                  checked={draft.approximateDate}
                  onChange={() => update('approximateDate', !draft.approximateDate)}
                />
                <span>Approximate date</span>
              </label>
              <label className="field">
                <span>Year</span>
                <input
                  type="number"
                  min="1900"
                  max="2100"
                  value={draft.year ?? ''}
                  onChange={(event) =>
                    update('year', event.target.value ? Number(event.target.value) : null)
                  }
                />
              </label>
              <label className="field">
                <span>Place</span>
                <input
                  value={draft.place}
                  onChange={(event) => update('place', event.target.value)}
                />
              </label>
              <label className="field">
                <span>Country</span>
                <input
                  value={draft.country}
                  onChange={(event) => update('country', event.target.value)}
                />
              </label>
              <label className="field field--wide">
                <span>
                  People <small>separate with commas</small>
                </span>
                <input
                  value={draft.people.join(', ')}
                  onChange={(event) =>
                    update(
                      'people',
                      event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </label>
              <label className="field field--wide">
                <span>
                  Tags <small>separate with commas</small>
                </span>
                <input
                  value={draft.tags.join(', ')}
                  onChange={(event) =>
                    update(
                      'tags',
                      event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </label>
              <label className="field">
                <span>Collection</span>
                <input
                  value={draft.collection}
                  onChange={(event) => update('collection', event.target.value)}
                />
              </label>
              <label className="field">
                <span>Season / episode</span>
                <div className="field-pair">
                  <input
                    aria-label="Season number"
                    type="number"
                    min="1"
                    placeholder="S"
                    value={draft.seasonNumber ?? ''}
                    onChange={(event) =>
                      update('seasonNumber', event.target.value ? Number(event.target.value) : null)
                    }
                  />
                  <input
                    aria-label="Episode number"
                    type="number"
                    min="1"
                    placeholder="E"
                    value={draft.episodeNumber ?? ''}
                    onChange={(event) =>
                      update(
                        'episodeNumber',
                        event.target.value ? Number(event.target.value) : null,
                      )
                    }
                  />
                </div>
              </label>
              <label className="field">
                <span>Visibility</span>
                <select
                  value={draft.visibility}
                  onChange={(event) =>
                    update('visibility', event.target.value as VideoRecord['visibility'])
                  }
                >
                  <option value="family">All family profiles</option>
                  <option value="selected-profiles">Selected profiles</option>
                  <option value="hidden">Hidden</option>
                </select>
              </label>
              <label className="field">
                <span>Publish state</span>
                <select
                  value={draft.publishState}
                  onChange={(event) =>
                    update('publishState', event.target.value as VideoRecord['publishState'])
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="ready">Ready</option>
                  <option value="published">Published</option>
                  <option value="hidden">Hidden</option>
                </select>
              </label>
              <label className="field field--checkbox">
                <input
                  type="checkbox"
                  checked={draft.featured}
                  onChange={() => update('featured', !draft.featured)}
                />
                <span>Eligible for homepage hero</span>
              </label>
              <label className="field field--wide">
                <span>Restoration note</span>
                <textarea
                  rows={3}
                  value={draft.restorationNotes}
                  onChange={(event) => update('restorationNotes', event.target.value)}
                  placeholder="Document restoration decisions for the family."
                />
              </label>
            </div>
          )}
          {tab === 'artwork' && (
            <div className="artwork-editor">
              <div className="artwork-editor__frames">
                {[0, 1, 2, 3].map((index) => (
                  <button
                    type="button"
                    className={index === 1 ? 'is-selected' : ''}
                    key={index}
                    aria-label={`Select frame candidate ${index + 1}`}
                  >
                    <div style={{ '--frame-shift': `${index * 12}%` } as React.CSSProperties}>
                      <span>
                        {String(Math.floor((draft.previewStartSeconds + index * 18) / 60)).padStart(
                          2,
                          '0',
                        )}
                        :{String((draft.previewStartSeconds + index * 18) % 60).padStart(2, '0')}
                      </span>
                    </div>
                    {index === 1 && <Icon name="check" />}
                  </button>
                ))}
              </div>
              <div className="artwork-crops">
                <div>
                  <span>16:9 landscape</span>
                  <Artwork video={draft} />
                </div>
                <div className="artwork-crops__poster">
                  <span>2:3 poster</span>
                  <Artwork video={draft} />
                </div>
              </div>
              <div className="range-field">
                <label htmlFor="thumbnail-time">
                  Thumbnail time <strong>{formatDuration(draft.previewStartSeconds)}</strong>
                </label>
                <input
                  id="thumbnail-time"
                  type="range"
                  min="0"
                  max={Math.max(1, draft.durationSeconds)}
                  value={draft.previewStartSeconds}
                  onChange={(event) => update('previewStartSeconds', Number(event.target.value))}
                />
              </div>
              <div className="inline-alert">
                <Icon name="check" />
                <span>
                  <strong>Hero safe area clear</strong>Title and faces remain inside the
                  television-safe crop.
                </span>
              </div>
              <div className="button-row">
                <button className="button button--quiet" type="button">
                  <Icon name="refresh" /> Extract new frames
                </button>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => update('artworkStatus', 'generated')}
                >
                  <Icon name="add" /> Use gradient fallback
                </button>
              </div>
            </div>
          )}
          {tab === 'technical' && (
            <div className="technical-grid">
              <dl>
                <div>
                  <dt>Original filename</dt>
                  <dd>{draft.originalFilename}</dd>
                </div>
                <div>
                  <dt>Source reference</dt>
                  <dd>{draft.sourceReference}</dd>
                </div>
                <div>
                  <dt>Source type</dt>
                  <dd>{draft.sourceType}</dd>
                </div>
                <div>
                  <dt>Resolution</dt>
                  <dd>{draft.resolution}</dd>
                </div>
                <div>
                  <dt>Aspect ratio</dt>
                  <dd>{draft.aspectRatio}</dd>
                </div>
                <div>
                  <dt>Frame rate</dt>
                  <dd>{draft.frameRate} fps</dd>
                </div>
                <div>
                  <dt>Interlaced</dt>
                  <dd>{draft.interlaced ? 'Detected' : 'No'}</dd>
                </div>
                <div>
                  <dt>Legacy format</dt>
                  <dd>{draft.legacyFormat ?? 'Not marked'}</dd>
                </div>
                <div>
                  <dt>Checksum</dt>
                  <dd>
                    <code>{draft.checksum}</code>
                  </dd>
                </div>
                <div>
                  <dt>Playback provider</dt>
                  <dd>{draft.playbackProvider}</dd>
                </div>
              </dl>
              <div className="safety-note">
                <Icon name="check" />
                <span>
                  <strong>Source metadata is read-only</strong>Edits here update the local catalogue
                  record, never the original media file.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      <footer className="modal-panel__footer">
        <span>Changes stay on this device until exported.</span>
        <div className="button-row">
          <button className="button button--quiet" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button--primary"
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            <Icon name="check" /> Save metadata
          </button>
        </div>
      </footer>
    </Modal>
  );
}

interface ImportModalProps {
  onAddSources: (names: string[], kind: ImportJob['sourceKind']) => void;
  onImportJson: (text: string) => void;
  onImportCsv: (text: string) => void;
  onClose: () => void;
}

export function ImportModal({
  onAddSources,
  onImportJson,
  onImportCsv,
  onClose,
}: ImportModalProps) {
  const videoInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const dataInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const acceptedVideoTypes = useMemo(
    () => ['.mp4', '.m4v', '.mov', '.avi', '.mkv', '.mpg', '.mpeg', '.m2ts', '.mts', '.vob'],
    [],
  );

  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
    folderInput.current?.setAttribute('directory', '');
  }, []);

  const acceptFiles = (files: FileList | File[], kind: ImportJob['sourceKind']) => {
    const names = Array.from(files)
      .map((file) => file.name)
      .filter(Boolean);
    if (names.length) {
      onAddSources(names.slice(0, 12), kind);
      onClose();
    }
  };

  const handleDataFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    if (file.name.toLowerCase().endsWith('.csv')) onImportCsv(text);
    else onImportJson(text);
    onClose();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    acceptFiles(event.dataTransfer.files, 'file');
  };

  return (
    <Modal
      title="Bring memories into the archive"
      eyebrow="Local import"
      onClose={onClose}
      className="import-modal"
    >
      <div className="import-grid">
        <div
          className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <span className="drop-zone__icon">
            <Icon name="upload" />
          </span>
          <h3>Drop video files here</h3>
          <p>Files are indexed locally. Nothing is uploaded or changed during review.</p>
          <button
            className="button button--primary"
            type="button"
            onClick={() => videoInput.current?.click()}
          >
            Choose videos
          </button>
          <small>{acceptedVideoTypes.join(' · ')}</small>
        </div>
        <div className="import-options">
          <button type="button" onClick={() => folderInput.current?.click()}>
            <span>
              <Icon name="folder" />
            </span>
            <span>
              <strong>Import a folder</strong>
              <small>Recursively scan supported video files</small>
            </span>
            <Icon name="chevron" />
          </button>
          <button type="button" onClick={() => folderInput.current?.click()}>
            <span>
              <Icon name="cloud" />
            </span>
            <span>
              <strong>Select a synced OneDrive folder</strong>
              <small>Reads local files; online-only items are flagged</small>
            </span>
            <Icon name="chevron" />
          </button>
          <button type="button" onClick={() => folderInput.current?.click()}>
            <span>
              <Icon name="disc" />
            </span>
            <span>
              <strong>Scan a VIDEO_TS folder</strong>
              <small>Detect title sets without modifying the DVD</small>
            </span>
            <Icon name="chevron" />
          </button>
          <button type="button" onClick={() => dataInput.current?.click()}>
            <span>
              <Icon name="file" />
            </span>
            <span>
              <strong>Import catalogue data</strong>
              <small>Validated LeliBramBas+ JSON or CSV</small>
            </span>
            <Icon name="chevron" />
          </button>
        </div>
      </div>
      <div className="import-demo-bar">
        <span>
          <StatusPill status="local" label="Demo mode" /> No private media is included.
        </span>
        <button
          className="text-button"
          type="button"
          onClick={() => {
            onAddSources(['Family Archive Demo Folder'], 'folder');
            onClose();
          }}
        >
          Load a sample folder <Icon name="chevron" />
        </button>
      </div>
      <input
        ref={videoInput}
        hidden
        type="file"
        multiple
        accept={acceptedVideoTypes.join(',')}
        onChange={(event) => acceptFiles(event.target.files ?? [], 'file')}
      />
      <input
        ref={folderInput}
        hidden
        type="file"
        multiple
        onChange={(event) => acceptFiles(event.target.files ?? [], 'folder')}
      />
      <input
        ref={dataInput}
        hidden
        type="file"
        accept=".json,.csv,application/json,text/csv"
        onChange={(event) => {
          void handleDataFile(event.target.files?.[0]);
        }}
      />
    </Modal>
  );
}
