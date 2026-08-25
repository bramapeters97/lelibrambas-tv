export const FALLBACK_POSTER = 'artwork/generic_cinema_2.png';

export function resolvePosterUrl(value?: string): string {
  const poster = value?.trim() || FALLBACK_POSTER;
  if (/^https?:\/\//i.test(poster)) return poster;
  const normalized = poster.replaceAll('\\', '/').replace(/^\/+/, '');
  return `/${normalized || FALLBACK_POSTER}`;
}

export function applyPosterFallback(image: HTMLImageElement): void {
  if (image.dataset.fallbackApplied === 'true') return;
  image.dataset.fallbackApplied = 'true';
  image.src = resolvePosterUrl(FALLBACK_POSTER);
}

export type PlaybackSource =
  | { kind: 'hls'; url: string; originalUrl: string; tvosCompatible: true }
  | { kind: 'mp4'; url: string; originalUrl: string; tvosCompatible: true }
  | {
      kind: 'iframe';
      url: string;
      originalUrl: string;
      directHlsUrl: string;
      tvosCompatible: false;
    }
  | { kind: 'unsupported'; url: null; originalUrl: string; tvosCompatible: false };

function isCloudflareStreamHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'videodelivery.net' ||
    host.endsWith('.videodelivery.net') ||
    host.endsWith('.cloudflarestream.com')
  );
}

export function resolvePlaybackSource(
  value?: string,
  options: { autoplay?: boolean; preferDirectHls?: boolean } = {},
): PlaybackSource {
  const originalUrl = value?.trim() ?? '';
  let parsed: URL;
  try {
    parsed = new URL(originalUrl);
  } catch {
    return { kind: 'unsupported', url: null, originalUrl, tvosCompatible: false };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { kind: 'unsupported', url: null, originalUrl, tvosCompatible: false };
  }

  const pathname = parsed.pathname.toLowerCase();
  if (pathname.endsWith('.m3u8')) {
    return { kind: 'hls', url: parsed.toString(), originalUrl, tvosCompatible: true };
  }
  if (pathname.endsWith('.mp4')) {
    return { kind: 'mp4', url: parsed.toString(), originalUrl, tvosCompatible: true };
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  const suffix = segments.at(-1)?.toLowerCase();
  const identifier = segments.length === 2 ? segments[0] : undefined;
  if (
    isCloudflareStreamHost(parsed.hostname) &&
    identifier &&
    ['watch', 'iframe'].includes(suffix ?? '')
  ) {
    const iframe = new URL(parsed.toString());
    iframe.protocol = 'https:';
    iframe.pathname = `/${identifier}/iframe`;
    iframe.search = '';
    iframe.hash = '';
    if (options.autoplay) iframe.searchParams.set('autoplay', 'true');
    const manifest = new URL(iframe.toString());
    manifest.pathname = `/${identifier}/manifest/video.m3u8`;
    manifest.search = '';
    if (options.preferDirectHls) {
      return {
        kind: 'hls',
        url: manifest.toString(),
        originalUrl,
        tvosCompatible: true,
      };
    }
    return {
      kind: 'iframe',
      url: iframe.toString(),
      originalUrl,
      directHlsUrl: manifest.toString(),
      tvosCompatible: false,
    };
  }

  return { kind: 'unsupported', url: null, originalUrl, tvosCompatible: false };
}

export function resolveNativePlaybackSource(value?: string): PlaybackSource {
  return resolvePlaybackSource(value, { preferDirectHls: true });
}
