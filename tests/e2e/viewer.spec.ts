import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

interface GeneratedMovie {
  id: number;
  title: string;
  stream_video_id: string;
}

const generatedCatalog = JSON.parse(
  readFileSync(new URL('../../data/media_catalog.json', import.meta.url), 'utf8'),
) as GeneratedMovie[];

const byId = new Map(generatedCatalog.map((movie) => [movie.id, movie]));

test.beforeEach(async ({ page }) => {
  await page.goto('/?screen=profiles&capture=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('profile to home to details passes the selected row exact stream URL to playback', async ({
  page,
}) => {
  const movie = generatedCatalog[0]!;
  await page.getByRole('button', { name: /Bart & Astrid/i }).click();
  await expect(page.getByRole('heading', { name: movie.title })).toBeVisible();
  await page.getByRole('button', { name: /More information/i }).click();
  await expect(page.locator('.details-screen')).toBeVisible();
  await page.locator('[data-focus-id="detail-play"]').click();
  await expect(page.locator('.player-screen')).toBeVisible();
  const player = page.locator('video, iframe.stream-iframe');
  await expect(player).toHaveCount(1);
  await expect(player).toHaveAttribute('data-catalogue-id', String(movie.id));
  await expect(player).toHaveAttribute('data-stream-video-id', movie.stream_video_id);
  await page.locator('[data-focus-id="player-back"]').click();
  await expect(page.locator('.details-screen')).toBeVisible();
});

test('arrow navigation exposes a visible deterministic focus state', async ({ page }) => {
  await page.getByRole('button', { name: /Bram & Edvin/i }).click();
  await page.keyboard.press('ArrowRight');
  const focusId = await page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.dataset.focusId,
  );
  expect(focusId).toBeTruthy();
  await expect(page.locator(':focus')).toBeVisible();
});

test('search, watched state, and generated collections are functional', async ({ page }) => {
  const movie = byId.get(7)!;
  await page.getByRole('button', { name: /Eline & Luca/i }).click();
  await page.keyboard.press('s');
  await expect(page.getByRole('heading', { name: /Search the archive/i })).toBeVisible();
  await page.getByLabel(/Which folder should we open/i).fill(movie.title);
  await page.getByRole('button', { name: movie.title }).first().click();
  await page.getByRole('button', { name: 'Mark watched' }).click();
  await expect(page.getByRole('button', { name: 'Watched' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Collections' }).click();
  await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible();
  await expect(page.getByRole('button', { name: /VAKANTIEFILMS/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /OTHERS/i })).toBeVisible();
});

test('intro, profiles, and poster-backed cinema hero preserve the viewer contract', async ({
  page,
}) => {
  await page.goto('/?screen=ident&capture=1');
  await expect(page.getByRole('button', { name: /skip intro/i })).toHaveCount(0);

  await page.goto('/?screen=profiles&capture=1');
  await expect(page.getByRole('button', { name: /Bart & Astrid/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Bram & Edvin/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Eline & Luca/i })).toBeVisible();
  await page.getByRole('button', { name: /Bart & Astrid/i }).click();

  await expect(page.locator('.nav-wordmark__icon')).toBeVisible();
  await expect(page.locator('.hero-art img')).toHaveAttribute(
    'src',
    '/artwork/eline_maria_peters.png',
  );
  const heroArtwork = await page.locator('.hero-art').evaluate((element) => {
    const art = element.getBoundingClientRect();
    const hero = element.parentElement?.getBoundingClientRect();
    const mask = getComputedStyle(element).maskImage;
    return { ratio: hero ? art.width / hero.width : 0, mask };
  });
  expect(heroArtwork.ratio).toBeGreaterThanOrEqual(0.7);
  expect(heroArtwork.ratio).toBeLessThanOrEqual(0.82);
  expect(heroArtwork.mask).toContain('radial-gradient');
});

test('rendered collection movie count and ids equal the generated JSON', async ({ page }) => {
  await page.getByRole('button', { name: /Bart & Astrid/i }).click();
  await page.getByRole('button', { name: 'Collections' }).click();

  const renderedIds: number[] = [];
  for (const category of ['JEUGDFILMS', 'VAKANTIEFILMS', 'EVENTS', 'OTHERS']) {
    await page.locator(`[data-focus-id="collection-${category.toLowerCase()}"]`).click();
    const ids = await page
      .locator('.episode-list [data-catalogue-id]')
      .evaluateAll((elements) => elements.map((element) => Number(element.dataset.catalogueId)));
    renderedIds.push(...ids);
  }

  expect(renderedIds).toHaveLength(generatedCatalog.length);
  expect(renderedIds.sort((left, right) => left - right)).toEqual(
    generatedCatalog.map((movie) => movie.id),
  );
});

test('every generated movie selects its own playback row', async ({ page }) => {
  test.setTimeout(120_000);

  for (const movie of generatedCatalog) {
    await page.goto(`/?screen=details&capture=1&video=${movie.id}`);
    await expect(page.getByRole('heading', { name: movie.title })).toBeVisible();
    await page.locator('[data-focus-id="detail-play"]').click();
    const player = page.locator('video, iframe.stream-iframe');
    await expect(player).toHaveAttribute('data-catalogue-id', String(movie.id));
    await expect(player).toHaveAttribute('data-stream-video-id', movie.stream_video_id);
  }
});
