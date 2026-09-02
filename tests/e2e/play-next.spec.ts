import { expect, test, type Locator, type Page } from '@playwright/test';

const moviesApiUrl = 'https://lelibrambas-api.bramapeters.workers.dev/api/movies';
const localMedia = (name: string) => `http://127.0.0.1:4173/media/${name}`;

interface ApiMovie {
  id: number;
  title: string;
  year: number | null;
  description: string;
  category: string;
  poster_url: string;
  stream_video_id: string;
  created_at: string;
  featured: 0 | 1;
  priority: -1 | 0 | 1 | 2;
  available: 0 | 1;
}

function apiMovie(id: number, overrides: Partial<ApiMovie> = {}): ApiMovie {
  return {
    id,
    title: `Synthetic movie ${id}`,
    year: null,
    description: 'A synthetic browser-test record.',
    category: 'EVENTS',
    poster_url: 'artwork/generic_cinema_2.png',
    stream_video_id: localMedia('archive-16x9.mp4'),
    created_at: '2026-08-31T12:00:00.000Z',
    featured: 0,
    priority: 0,
    available: 1,
    ...overrides,
  };
}

const eligibleCatalogue = [
  apiMovie(9001, {
    title: 'Current synthetic film',
    stream_video_id: localMedia('archive-16x9.mp4'),
    priority: 2,
  }),
  apiMovie(9002, {
    title: 'Recommended synthetic film',
    poster_url: '',
    stream_video_id: localMedia('up-next.mp4'),
  }),
  apiMovie(9003, {
    title: 'Duplicate recommendation record',
    stream_video_id: localMedia('up-next.mp4'),
  }),
  apiMovie(9004, {
    title: 'Coming soon synthetic film',
    stream_video_id: localMedia('short-memory.mp4'),
    priority: -1,
  }),
  apiMovie(9005, {
    title: 'Unavailable synthetic film',
    stream_video_id: localMedia('short-memory.mp4'),
    available: 0,
  }),
  apiMovie(9006, {
    title: 'Different category synthetic film',
    category: 'VAKANTIEFILMS',
    stream_video_id: localMedia('short-memory.mp4'),
  }),
];

async function openPlayer(page: Page, catalogue: ApiMovie[] = eligibleCatalogue) {
  await page.route(moviesApiUrl, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(catalogue),
    });
  });
  await page.goto('/?screen=player&capture=1&video=9001');
  const player = page.locator('.player-screen > video');
  await expect(player).toHaveAttribute('data-catalogue-id', '9001');
  await expect
    .poll(() =>
      player.evaluate((element) => {
        const video = element as HTMLVideoElement;
        return Number.isFinite(video.duration) && video.duration > 0;
      }),
    )
    .toBe(true);
  return player;
}

async function revealFromMediaTiming(player: Locator) {
  await player.evaluate(async (element) => {
    const video = element as HTMLVideoElement;
    await video.play();
    video.currentTime = Math.max(0, video.duration - 14);
    video.dispatchEvent(new Event('timeupdate'));
  });
}

test('reveals one stable eligible same-category recommendation and dismissal lasts for the session', async ({
  page,
}) => {
  const player = await openPlayer(page);
  await revealFromMediaTiming(player);

  const recommendation = page.locator('.play-next-recommendation');
  await expect(recommendation).toBeVisible();
  await expect(recommendation).toHaveAttribute('data-catalogue-id', '9002');
  await expect(recommendation.getByText('PLAY NEXT')).toBeVisible();
  await expect(recommendation.getByText('Recommended synthetic film')).toBeVisible();
  await expect(recommendation.locator('.play-next-metadata')).toHaveCount(0);
  await expect(recommendation.locator('img')).toHaveAttribute(
    'src',
    /artwork\/generic_cinema_2\.png$/,
  );

  for (const secondsRemaining of [12, 8, 4]) {
    await player.evaluate((element, remaining) => {
      const video = element as HTMLVideoElement;
      video.currentTime = Math.max(0, video.duration - remaining);
      video.dispatchEvent(new Event('timeupdate'));
    }, secondsRemaining);
    await expect(recommendation).toHaveAttribute('data-catalogue-id', '9002');
  }

  await expect
    .poll(() => player.evaluate((element) => (element as HTMLVideoElement).paused))
    .toBe(false);
  await recommendation.getByRole('button', { name: /dismiss play next/i }).click();
  await expect(recommendation).toHaveCount(0);
  await expect
    .poll(() => player.evaluate((element) => (element as HTMLVideoElement).paused))
    .toBe(false);

  await player.evaluate((element) => element.dispatchEvent(new Event('timeupdate')));
  await expect(recommendation).toHaveCount(0);
});

test('keyboard activation stops the old player and starts the recommended video without a reload', async ({
  page,
}) => {
  const player = await openPlayer(page);
  await revealFromMediaTiming(player);

  const playNextCard = page.locator('[data-focus-id="play-next-card"]');
  await playNextCard.focus();
  await page.keyboard.press('Enter');

  const nextPlayer = page.locator('.player-screen > video[data-catalogue-id="9002"]');
  await expect(nextPlayer).toHaveCount(1);
  await expect(page.locator('.player-screen > video')).toHaveCount(1);
  await expect(page.locator('.player-screen > video[data-catalogue-id="9001"]')).toHaveCount(0);
});

test('shows no recommendation when the category has no other available released video', async ({
  page,
}) => {
  const player = await openPlayer(page, [
    eligibleCatalogue[0]!,
    eligibleCatalogue[3]!,
    eligibleCatalogue[4]!,
    eligibleCatalogue[5]!,
  ]);
  await player.evaluate((element) => element.dispatchEvent(new Event('ended')));

  await expect(page.locator('.play-next-recommendation')).toHaveCount(0);
  await expect(page.getByText('PRESENTATION COMPLETE')).toBeVisible();
});

test('keeps the recommendation in view through resize, rotation, fullscreen, and reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const player = await openPlayer(page);
  await revealFromMediaTiming(player);
  const recommendation = page.locator('.play-next-recommendation');

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const bounds = await recommendation.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width + 1,
    );
  }

  const animationDuration = await recommendation.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).animationDuration),
  );
  expect(animationDuration).toBeLessThanOrEqual(0.001);

  await page.setViewportSize({ width: 1280, height: 900 });
  if (await page.evaluate(() => document.fullscreenEnabled)) {
    await page.getByRole('button', { name: 'Enter fullscreen' }).click({ force: true });
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
    await expect(recommendation).toBeVisible();
    await page.getByRole('button', { name: 'Exit fullscreen' }).click({ force: true });
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    await expect(recommendation).toBeVisible();
  }
});
