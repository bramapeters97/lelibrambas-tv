import type { CatalogueVideoRecord } from './catalogue';
import { applyPosterFallback, resolvePosterUrl } from './media';

function recommendationMetadata(video: CatalogueVideoRecord): string[] {
  const metadata: string[] = [];
  if (video.year !== null) metadata.push(String(video.year));
  if (video.durationSeconds !== null) {
    metadata.push(
      video.durationSeconds < 60
        ? `${Math.round(video.durationSeconds)} sec`
        : `${Math.round(video.durationSeconds / 60)} min`,
    );
  }
  return metadata;
}

export function PlayNextRecommendation({
  video,
  onPlay,
  onClose,
}: {
  video: CatalogueVideoRecord;
  onPlay: () => void;
  onClose: () => void;
}) {
  const metadata = recommendationMetadata(video);

  return (
    <section
      className="play-next-recommendation"
      data-catalogue-id={video.catalogueId}
      aria-label={`Play ${video.title} next`}
      aria-live="polite"
    >
      <div className="play-next-heading">
        <span>PLAY NEXT</span>
        <button
          type="button"
          className="play-next-close"
          data-focusable
          data-focus-id="play-next-close"
          onClick={onClose}
          aria-label={`Dismiss Play Next recommendation for ${video.title}`}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <button
        type="button"
        className="play-next-content"
        data-focusable
        data-focus-id="play-next-card"
        onClick={onPlay}
        aria-label={`Play ${video.title} next`}
      >
        <span className="play-next-thumbnail">
          <img
            src={resolvePosterUrl(video.posterUrl)}
            alt=""
            onError={(event) => applyPosterFallback(event.currentTarget)}
          />
          <span className="play-next-thumbnail-action" aria-hidden="true">
            ▶
          </span>
        </span>
        <span className="play-next-copy">
          <strong>{video.title}</strong>
          {metadata.length > 0 && (
            <span className="play-next-metadata">{metadata.join(' · ')}</span>
          )}
        </span>
      </button>
      <button
        type="button"
        className="play-next-action"
        data-focusable
        data-focus-id="play-next"
        onClick={onPlay}
        aria-label={`Play ${video.title} next`}
      >
        <span aria-hidden="true">▶</span>
        Play next
      </button>
    </section>
  );
}
