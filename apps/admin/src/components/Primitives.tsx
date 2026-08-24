import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { formatDuration } from '../lib/library';
import type { ProcessingStatus, VideoRecord } from '../types';

export type IconName =
  | 'dashboard'
  | 'review'
  | 'queue'
  | 'disc'
  | 'catalogue'
  | 'collections'
  | 'rails'
  | 'devices'
  | 'settings'
  | 'search'
  | 'add'
  | 'upload'
  | 'download'
  | 'more'
  | 'chevron'
  | 'edit'
  | 'check'
  | 'warning'
  | 'close'
  | 'play'
  | 'refresh'
  | 'folder'
  | 'file'
  | 'cloud'
  | 'arrow-up'
  | 'arrow-down'
  | 'menu';

const icons: Record<IconName, string> = {
  dashboard: '⌂',
  review: '◇',
  queue: '↻',
  disc: '◎',
  catalogue: '▤',
  collections: '▣',
  rails: '≋',
  devices: '▱',
  settings: '⚙',
  search: '⌕',
  add: '+',
  upload: '↑',
  download: '↓',
  more: '•••',
  chevron: '›',
  edit: '✎',
  check: '✓',
  warning: '!',
  close: '×',
  play: '▶',
  refresh: '↻',
  folder: '▰',
  file: '▯',
  cloud: '☁',
  'arrow-up': '↑',
  'arrow-down': '↓',
  menu: '☰',
};

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <span className={`icon ${className}`} aria-hidden="true">
      {icons[name]}
    </span>
  );
}

export function Artwork({ video, compact = false }: { video: VideoRecord; compact?: boolean }) {
  const artworkStyle = {
    '--art-start': video.palette[0],
    '--art-end': video.palette[1],
  } as CSSProperties;
  const initials = video.title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('');

  return (
    <div
      className={`artwork ${compact ? 'artwork--compact' : ''}`}
      style={artworkStyle}
      aria-hidden="true"
    >
      <span className="artwork__glow" />
      <span className="artwork__initials">{initials}</span>
      {!compact && <span className="artwork__year">{video.year ?? 'Date needed'}</span>}
    </div>
  );
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const className = status.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const displayLabel = label ?? status.replace(/-/g, ' ');
  return <span className={`status-pill status-pill--${className}`}>{displayLabel}</span>;
}

export function VideoStatus({ status }: { status: ProcessingStatus }) {
  const labels: Record<ProcessingStatus, string> = {
    'awaiting-review': 'Review',
    queued: 'Queued',
    processing: 'Processing',
    failed: 'Failed',
    'ready-to-upload': 'Ready',
    uploaded: 'Uploaded',
    unavailable: 'Unavailable',
  };
  return <StatusPill status={status} label={labels[status]} />;
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className="progress" aria-label={label ?? `${safeValue}% complete`}>
      <span className="progress__track">
        <span className="progress__fill" style={{ width: `${safeValue}%` }} />
      </span>
      <span className="progress__value">{safeValue}%</span>
    </div>
  );
}

export function Duration({ seconds }: { seconds: number }) {
  return <span>{formatDuration(seconds)}</span>;
}

export function EmptyState({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__mark" aria-hidden="true">
        ◇
      </span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}

export function Modal({
  title,
  eyebrow,
  children,
  onClose,
  className = '',
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`modal-panel ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal-panel__header">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id="modal-title">{title}</h2>
          </div>
          <button
            ref={closeRef}
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <Icon name="close" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
