import type { CatalogueVideoRecord } from '@lelibrambas/catalog';

export function detailShareUrl(video: CatalogueVideoRecord, currentUrl = window.location.href): string {
  const url = new URL(currentUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('screen', 'details');
  url.searchParams.set('video', video.slug || video.id);
  return url.toString();
}

function copyWithSelection(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

export async function shareVideo(video: CatalogueVideoRecord): Promise<'shared' | 'copied'> {
  const url = detailShareUrl(video);
  const data = {
    title: video.title,
    text: `Watch ${video.title} on LeliBramBas+`,
    url,
  };

  if (typeof navigator.share === 'function') {
    await navigator.share(data);
    return 'shared';
  }

  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
  else if (!copyWithSelection(url)) throw new Error('Copying is unavailable');
  return 'copied';
}
