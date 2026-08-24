import { Icon, StatusPill } from '../components/Primitives';
import { formatBytes } from '../lib/library';
import type { AdminSettings, DeviceRecord, LibrarySnapshot } from '../types';

interface DevicesViewProps {
  devices: DeviceRecord[];
  onUpdate: (deviceId: string, patch: Partial<DeviceRecord>) => void;
}

export function DevicesView({ devices, onUpdate }: DevicesViewProps) {
  const pending = devices.filter((device) => device.state === 'pending');
  const approved = devices.filter((device) => device.state === 'approved');
  const revoked = devices.filter((device) => device.state === 'revoked');

  return (
    <div className="view-stack" data-testid="devices-view">
      <section className="section-heading">
        <p className="eyebrow">Private family access</p>
        <h2>Devices</h2>
        <p>
          Approve living-room screens, rotate access and revoke devices that should no longer reach
          the archive.
        </p>
      </section>

      {pending.length > 0 && (
        <section className="pairing-card">
          <div className="pairing-card__copy">
            <p className="eyebrow">Pairing request</p>
            <h3>{pending[0]?.name}</h3>
            <p>Confirm that this code matches the one shown on the television.</p>
          </div>
          <div className="pairing-code" aria-label={`Pairing code ${pending[0]?.pairingCode}`}>
            {pending[0]?.pairingCode}
          </div>
          <div className="pairing-card__meta">
            <span>{pending[0]?.platform}</span>
            <span>Expires in 09:42</span>
          </div>
          <div className="button-row">
            <button
              className="button button--quiet"
              type="button"
              onClick={() =>
                pending[0] &&
                onUpdate(pending[0].id, {
                  state: 'revoked',
                  pairingCode: null,
                  codeExpiresAt: null,
                })
              }
            >
              Deny
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={() =>
                pending[0] &&
                onUpdate(pending[0].id, {
                  state: 'approved',
                  pairingCode: null,
                  codeExpiresAt: null,
                  approvedAt: '2026-08-17T10:21:00.000Z',
                })
              }
            >
              <Icon name="check" /> Approve device
            </button>
          </div>
        </section>
      )}

      <section className="panel device-panel">
        <header className="panel__header">
          <div>
            <p className="eyebrow">Approved</p>
            <h3>{approved.length} family devices</h3>
          </div>
          <StatusPill status="safe" label="Private access" />
        </header>
        <div className="device-list">
          {approved.map((device) => (
            <article className="device-row" key={device.id}>
              <span className="device-row__icon">
                <Icon name="devices" />
              </span>
              <div>
                <strong>{device.name}</strong>
                <small>
                  {device.platform} · Default profile: {device.profile}
                </small>
              </div>
              <div>
                <span className="online-dot" /> <strong>Last seen</strong>
                <small>{device.lastSeen ? 'Today, 10:04' : 'Never'}</small>
              </div>
              <StatusPill status="approved" label="Approved" />
              <button
                className="button button--quiet"
                type="button"
                onClick={() => onUpdate(device.id, { state: 'revoked' })}
              >
                Revoke
              </button>
            </article>
          ))}
        </div>
      </section>

      {revoked.length > 0 && (
        <section className="panel device-panel device-panel--muted">
          <header className="panel__header">
            <div>
              <p className="eyebrow">History</p>
              <h3>Revoked devices</h3>
            </div>
          </header>
          <div className="device-list">
            {revoked.map((device) => (
              <article className="device-row" key={device.id}>
                <span className="device-row__icon">
                  <Icon name="devices" />
                </span>
                <div>
                  <strong>{device.name}</strong>
                  <small>{device.platform}</small>
                </div>
                <div>
                  <strong>Access blocked</strong>
                  <small>Token revoked locally</small>
                </div>
                <StatusPill status="revoked" label="Revoked" />
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() =>
                    onUpdate(device.id, {
                      state: 'pending',
                      pairingCode: 'DEMO-02',
                      codeExpiresAt: '2026-08-17T10:45:00.000Z',
                    })
                  }
                >
                  Pair again
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface SettingsViewProps {
  snapshot: LibrarySnapshot;
  onUpdate: (patch: Partial<AdminSettings>) => void;
  onExportJson: () => void;
  onImport: () => void;
  onReset: () => void;
}

export function SettingsView({
  snapshot,
  onUpdate,
  onExportJson,
  onImport,
  onReset,
}: SettingsViewProps) {
  const sourceBytes = snapshot.videos.reduce((total, video) => total + video.sourceSizeBytes, 0);
  const convertedBytes = snapshot.jobs.reduce((total, job) => total + job.outputSizeBytes, 0);

  return (
    <div className="view-stack settings-view" data-testid="settings-view">
      <section className="section-heading">
        <p className="eyebrow">Library preferences</p>
        <h2>Settings</h2>
        <p>
          Configure local processing defaults. Cloud credentials never belong in this browser
          interface.
        </p>
      </section>
      <div className="settings-layout">
        <div className="view-stack">
          <section className="panel settings-card">
            <header className="panel__header">
              <div>
                <p className="eyebrow">General</p>
                <h3>Archive identity</h3>
              </div>
            </header>
            <div className="form-grid">
              <label className="field field--wide">
                <span>Library name</span>
                <input
                  value={snapshot.settings.libraryLabel}
                  onChange={(event) => onUpdate({ libraryLabel: event.target.value })}
                />
              </label>
              <label className="field field--wide">
                <span>Viewing-copy output folder</span>
                <div className="input-with-action">
                  <input
                    value={snapshot.settings.outputFolder}
                    onChange={(event) => onUpdate({ outputFolder: event.target.value })}
                  />
                  <button type="button" className="button button--quiet">
                    Browse
                  </button>
                </div>
                <small>Relative paths keep exported settings portable.</small>
              </label>
              <label className="field">
                <span>Default visibility</span>
                <select
                  value={snapshot.settings.defaultVisibility}
                  onChange={(event) =>
                    onUpdate({
                      defaultVisibility: event.target.value as AdminSettings['defaultVisibility'],
                    })
                  }
                >
                  <option value="family">All family profiles</option>
                  <option value="selected-profiles">Selected profiles</option>
                </select>
              </label>
              <label className="field">
                <span>Local concurrency</span>
                <select
                  value={snapshot.settings.concurrency}
                  onChange={(event) => onUpdate({ concurrency: Number(event.target.value) })}
                >
                  <option value="1">1 conversion (recommended)</option>
                  <option value="2">2 conversions</option>
                  <option value="3">3 conversions</option>
                </select>
              </label>
            </div>
          </section>
          <section className="panel settings-card">
            <header className="panel__header">
              <div>
                <p className="eyebrow">Conversion</p>
                <h3>Archive-safe defaults</h3>
              </div>
              <StatusPill status="safe" label="Non-destructive" />
            </header>
            <div className="toggle-list">
              <label>
                <span>
                  <strong>Preserve original frame rate</strong>
                  <small>Avoid cadence changes unless compatibility requires it.</small>
                </span>
                <span className="switch">
                  <input
                    type="checkbox"
                    checked={snapshot.settings.preserveFrameRate}
                    onChange={() =>
                      onUpdate({ preserveFrameRate: !snapshot.settings.preserveFrameRate })
                    }
                  />
                  <i />
                </span>
              </label>
              <label>
                <span>
                  <strong>Deinterlace only when detected</strong>
                  <small>Keep progressive footage untouched.</small>
                </span>
                <span className="switch">
                  <input
                    type="checkbox"
                    checked={snapshot.settings.deinterlaceWhenDetected}
                    onChange={() =>
                      onUpdate({
                        deinterlaceWhenDetected: !snapshot.settings.deinterlaceWhenDetected,
                      })
                    }
                  />
                  <i />
                </span>
              </label>
              <label>
                <span>
                  <strong>Generate artwork candidates</strong>
                  <small>Extract local still frames after verified conversion.</small>
                </span>
                <span className="switch">
                  <input
                    type="checkbox"
                    checked={snapshot.settings.autoGenerateArtwork}
                    onChange={() =>
                      onUpdate({ autoGenerateArtwork: !snapshot.settings.autoGenerateArtwork })
                    }
                  />
                  <i />
                </span>
              </label>
            </div>
          </section>
          <section className="panel settings-card danger-card">
            <header className="panel__header">
              <div>
                <p className="eyebrow">Demo controls</p>
                <h3>Reset local Library Manager</h3>
              </div>
            </header>
            <p>
              Restore the deterministic demo catalogue, jobs, devices and homepage rails. Source
              media is never touched.
            </p>
            <button className="button button--danger" type="button" onClick={onReset}>
              <Icon name="refresh" /> Restore demo state
            </button>
          </section>
        </div>
        <aside className="view-stack">
          <section className="panel storage-card">
            <header className="panel__header panel__header--compact">
              <div>
                <p className="eyebrow">Local storage</p>
                <h3>Archive footprint</h3>
              </div>
            </header>
            <div
              className="storage-ring"
              aria-label="Converted copies use 12 percent of represented source size"
            >
              <span>
                <strong>12%</strong>
                <small>viewing copies</small>
              </span>
            </div>
            <dl>
              <div>
                <dt>Source archive</dt>
                <dd>{formatBytes(sourceBytes)}</dd>
              </div>
              <div>
                <dt>Viewing copies</dt>
                <dd>{formatBytes(convertedBytes)}</dd>
              </div>
              <div>
                <dt>Browser metadata</dt>
                <dd>148 KB</dd>
              </div>
            </dl>
          </section>
          <section className="panel settings-card">
            <header className="panel__header panel__header--compact">
              <div>
                <p className="eyebrow">Portability</p>
                <h3>Catalogue data</h3>
              </div>
            </header>
            <p>Export a complete local snapshot or restore a previously validated JSON/CSV file.</p>
            <div className="button-stack">
              <button
                className="button button--quiet button--wide"
                type="button"
                onClick={onExportJson}
              >
                <Icon name="download" /> Export complete JSON
              </button>
              <button
                className="button button--quiet button--wide"
                type="button"
                onClick={onImport}
              >
                <Icon name="upload" /> Import catalogue
              </button>
            </div>
          </section>
          <section className="panel cloud-card">
            <span className="cloud-card__icon">
              <Icon name="cloud" />
            </span>
            <div>
              <p className="eyebrow">Cloud adapter</p>
              <h3>Demo mode</h3>
              <p>
                Upload jobs are generated locally. No Cloudflare credentials are configured in the
                browser.
              </p>
            </div>
            <StatusPill status="local" label="No network writes" />
          </section>
        </aside>
      </div>
    </div>
  );
}
