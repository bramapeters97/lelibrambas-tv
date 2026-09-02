import { afterEach, describe, expect, it, vi } from 'vitest';

import { detailShareUrl, shareVideo } from './shareVideo';

const video = {
  id: 'synthetic-film',
  slug: 'synthetic-film',
  title: 'Synthetic Film',
} as Parameters<typeof detailShareUrl>[0];

afterEach(() => vi.unstubAllGlobals());

describe('video sharing', () => {
  it('builds a clean URL that opens the selected detail page', () => {
    expect(detailShareUrl(video, 'https://archive.example/app/?capture=1#frame')).toBe(
      'https://archive.example/app/?screen=details&video=synthetic-film',
    );
  });

  it('uses the system share sheet when the Web Share API is available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    vi.stubGlobal('window', { location: { href: 'https://archive.example/' } });

    await expect(shareVideo(video)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({
      title: 'Synthetic Film',
      text: 'Watch Synthetic Film on LeliBramBas+',
      url: 'https://archive.example/?screen=details&video=synthetic-film',
    });
  });

  it('copies the detail link when system sharing is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.stubGlobal('window', { location: { href: 'https://archive.example/' } });

    await expect(shareVideo(video)).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith(
      'https://archive.example/?screen=details&video=synthetic-film',
    );
  });
});
