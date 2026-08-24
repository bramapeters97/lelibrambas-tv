import { useMemo } from 'react';
import { Artwork, Icon, StatusPill } from '../components/Primitives';
import { formatCompactDuration } from '../lib/library';
import type { HomeRail, VideoRecord } from '../types';

export function CollectionsView({ videos }: { videos: VideoRecord[] }) {
  const collections = useMemo(() => {
    const map = new Map<string, VideoRecord[]>();
    videos.forEach((video) => {
      const current = map.get(video.collection) ?? [];
      current.push(video);
      map.set(video.collection, current);
    });
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [videos]);

  return (
    <div className="view-stack" data-testid="collections-view">
      <section className="section-heading section-heading--with-actions">
        <div>
          <p className="eyebrow">Curated groups</p>
          <h2>Collections</h2>
          <p>Trips, family chapters and restored sets presented as ordered stories.</p>
        </div>
        <button className="button button--primary" type="button">
          <Icon name="add" /> New collection
        </button>
      </section>
      <section className="collection-grid">
        {collections.map(([name, items], index) => {
          const first = items[0];
          if (!first) return null;
          return (
            <article className="collection-card" key={name}>
              <div className="collection-card__art">
                {items.slice(0, 3).map((video) => (
                  <Artwork compact video={video} key={video.id} />
                ))}
              </div>
              <div className="collection-card__body">
                <div>
                  <p className="eyebrow">{index < 3 ? 'Featured collection' : 'Collection'}</p>
                  <h3>{name}</h3>
                </div>
                <p>
                  {items.length} titles ·{' '}
                  {formatCompactDuration(
                    items.reduce((total, item) => total + item.durationSeconds, 0),
                  )}
                </p>
                <div className="collection-card__footer">
                  <span>
                    {[...new Set(items.flatMap((item) => item.people))].slice(0, 3).join(' · ')}
                  </span>
                  <button className="icon-button" type="button" aria-label={`Open ${name}`}>
                    <Icon name="chevron" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

interface RailsViewProps {
  rails: HomeRail[];
  videos: VideoRecord[];
  onUpdate: (railId: string, patch: Partial<HomeRail>) => void;
  onMove: (railId: string, direction: -1 | 1) => void;
}

export function RailsView({ rails, videos, onUpdate, onMove }: RailsViewProps) {
  return (
    <div className="view-stack" data-testid="rails-view">
      <section className="section-heading section-heading--with-actions">
        <div>
          <p className="eyebrow">Viewer programming</p>
          <h2>Homepage rails</h2>
          <p>
            Reorder and hide discovery rows. Changes stay local until the catalogue is exported.
          </p>
        </div>
        <button className="button button--primary" type="button">
          <Icon name="add" /> Add curated rail
        </button>
      </section>
      <div className="rails-layout">
        <section className="rail-editor panel" aria-label="Homepage rail order">
          <header className="panel__header">
            <div>
              <p className="eyebrow">Presentation order</p>
              <h3>{rails.filter((rail) => rail.visible).length} visible rails</h3>
            </div>
            <StatusPill status="local" label="Local draft" />
          </header>
          <div className="rail-editor__list">
            {rails.map((rail, index) => (
              <article
                className={`rail-editor__row ${rail.visible ? '' : 'is-hidden'}`}
                key={rail.id}
              >
                <span className="drag-handle" aria-hidden="true">
                  ⠿
                </span>
                <span className="rail-editor__order">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{rail.title}</strong>
                  <small>
                    {rail.rule} · {rail.itemCount} matches
                  </small>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={rail.visible}
                    onChange={() => onUpdate(rail.id, { visible: !rail.visible })}
                  />
                  <span />
                  <b className="sr-only">Show {rail.title}</b>
                </label>
                <div className="rail-editor__arrows">
                  <button
                    className="icon-button"
                    type="button"
                    disabled={index === 0}
                    onClick={() => onMove(rail.id, -1)}
                    aria-label={`Move ${rail.title} up`}
                  >
                    <Icon name="arrow-up" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    disabled={index === rails.length - 1}
                    onClick={() => onMove(rail.id, 1)}
                    aria-label={`Move ${rail.title} down`}
                  >
                    <Icon name="arrow-down" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside className="panel viewer-preview" aria-label="TV homepage preview">
          <header className="panel__header panel__header--compact">
            <div>
              <p className="eyebrow">Living-room preview</p>
              <h3>LeliBramBas+</h3>
            </div>
            <span className="viewer-preview__live">Preview</span>
          </header>
          <div className="viewer-preview__screen">
            <div className="viewer-preview__hero">
              <span>LeliBramBas+</span>
              <strong>Eline Maria Peters (Part 1)</strong>
              <small>JEUGDFILMS - Catalogue only</small>
            </div>
            {rails
              .filter((rail) => rail.visible)
              .slice(0, 3)
              .map((rail, railIndex) => (
                <div className="viewer-preview__rail" key={rail.id}>
                  <strong>{rail.title}</strong>
                  <div>
                    {videos.slice(railIndex * 3, railIndex * 3 + 4).map((video) => (
                      <Artwork video={video} compact key={video.id} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
