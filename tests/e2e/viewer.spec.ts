import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

interface GeneratedMovie {
  id: number;
  title: string;
  description: string;
  category: string;
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

test('web share metadata exposes the LELIBRAMBAS preview contract', async ({ page, request }) => {
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'LELIBRAMBAS+',
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    'content',
    'A Private Family Archive',
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://lelibrambas.com/lelibrambas-share.png',
  );
  expect((await request.get('/lelibrambas-share.png')).ok()).toBe(true);
});

test('profile to home to details passes the selected row exact stream URL to playback', async ({
  page,
}) => {
  const movie = generatedCatalog.find((item) => item.title === 'Lelibrambas+ Trailer')!;
  await page.getByRole('button', { name: /Bart & Astrid/i }).click();
  await expect(page.getByRole('heading', { name: movie.title })).toBeVisible();
  await expect(page.locator('.hero-copy > p:not(.studio-line)')).toHaveText(movie.description);
  await page.getByRole('button', { name: /More information/i }).click();
  await expect(page.locator('.details-screen')).toBeVisible();
  await expect(page.locator('.synopsis')).toHaveText(movie.description);
  await expect(page.locator('[data-focus-id="detail-play"]')).toHaveText('Play');
  const detailLogoBackground = await page
    .locator('.details-art')
    .evaluate((element) => getComputedStyle(element, '::after').backgroundImage);
  expect(detailLogoBackground).toBe('none');
  await page.locator('[data-focus-id="detail-play"]').click();
  await expect(page.locator('.player-screen')).toBeVisible();
  const player = page.locator('video, iframe.stream-iframe');
  await expect(player).toHaveCount(1);
  await expect(player).toHaveAttribute('data-catalogue-id', String(movie.id));
  await expect(player).toHaveAttribute('data-stream-video-id', movie.stream_video_id);
  await expect(player).toHaveAttribute('src', /\/iframe\?autoplay=true$/);
  await expect(player).toHaveAttribute('allow', /autoplay/);
  const playerBack = page.locator('[data-focus-id="player-back"]');
  await expect(playerBack).toHaveText('←');
  const playerBackStyle = await playerBack.evaluate((element) => {
    const style = getComputedStyle(element);
    return { borderWidth: style.borderTopWidth, backgroundColor: style.backgroundColor };
  });
  expect(playerBackStyle).toEqual({
    borderWidth: '0px',
    backgroundColor: 'rgba(0, 0, 0, 0)',
  });
  await playerBack.click();
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
  await expect(page.locator('.ident-mark .nav-wordmark__icon')).toBeVisible();
  await expect(page.locator('.ident-mark b')).toHaveCount(0);

  await page.goto('/?screen=profiles&capture=1');
  await expect(page.getByRole('button', { name: /Bart & Astrid/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Bram & Edvin/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Eline & Luca/i })).toBeVisible();
  const profileCenterOffset = await page.locator('.profile-card').evaluateAll((elements) => {
    const bounds = elements.map((element) => element.getBoundingClientRect());
    const left = Math.min(...bounds.map((bound) => bound.left));
    const right = Math.max(...bounds.map((bound) => bound.right));
    return (left + right) / 2 - window.innerWidth / 2;
  });
  expect(Math.abs(profileCenterOffset)).toBeLessThan(5);
  await page.getByRole('button', { name: /Bart & Astrid/i }).click();

  await expect(page.locator('.nav-wordmark__icon')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lelibrambas+ Trailer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Trailer' })).toBeVisible();
  await expect(page.locator('.hero-art img')).toHaveCount(0);
  const heroArtwork = await page.locator('.hero-art').evaluate((element) => {
    const art = element.getBoundingClientRect();
    const hero = element.parentElement?.getBoundingClientRect();
    const mask = getComputedStyle(element).maskImage;
    const backgroundImage = getComputedStyle(element).backgroundImage;
    return { ratio: hero ? art.width / hero.width : 0, mask, backgroundImage };
  });
  expect(heroArtwork.ratio).toBeGreaterThanOrEqual(0.7);
  expect(heroArtwork.ratio).toBeLessThanOrEqual(0.82);
  expect(heroArtwork.mask).toContain('radial-gradient');
  expect(heroArtwork.backgroundImage).toContain('lelibrambas-studios');
});

test('home collection shortcuts open the selected collection and home rows mirror JSON', async ({
  page,
}) => {
  await page.getByRole('button', { name: /Bart & Astrid/i }).click();

  const collectionCardAnimations = await page.locator('.home-hubs-row button').evaluateAll(
    (elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element, '::after');
        return { name: style.animationName, duration: style.animationDuration };
      }),
  );
  expect(collectionCardAnimations).toHaveLength(4);
  expect(collectionCardAnimations).toEqual(
    Array.from({ length: 4 }, () => ({ name: 'home-collection-shade', duration: '2s' })),
  );

  const trendingIds = await page
    .locator('[data-home-rail="currently-trending"] [data-catalogue-id]')
    .evaluateAll((elements) => elements.map((element) => Number(element.dataset.catalogueId)));
  expect(trendingIds).toEqual([22, 23, 7, 40]);

  for (const category of ['JEUGDFILMS', 'VAKANTIEFILMS', 'EVENTS', 'OTHERS']) {
    const expectedIds = generatedCatalog
      .filter((movie) => movie.category === category)
      .map((movie) => movie.id);
    const renderedIds = await page
      .locator(`[data-home-rail="${category.toLowerCase()}"] [data-catalogue-id]`)
      .evaluateAll((elements) => elements.map((element) => Number(element.dataset.catalogueId)));
    expect(renderedIds).toEqual(expectedIds);
  }

  await page.locator('[data-focus-id="home-hub-vakantiefilms"]').click();
  await expect(page.locator('.result-title h2')).toHaveText('VAKANTIEFILMS');
  await expect(page.locator('[data-focus-id="collection-vakantiefilms"]')).toHaveClass(/active/);
  await expect(page.locator('.collection-grid > button').first()).toHaveAttribute(
    'data-focus-id',
    'collection-vakantiefilms',
  );
  const selectedCollectionStyle = await page
    .locator('[data-focus-id="collection-vakantiefilms"]')
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const selectedBounds = element.getBoundingClientRect();
      const nextBounds = element.nextElementSibling?.getBoundingClientRect();
      return {
        animationName: style.animationName,
        borderWidth: style.borderTopWidth,
        isLarger: nextBounds ? selectedBounds.width > nextBounds.width : false,
      };
    });
  expect(selectedCollectionStyle).toEqual({
    animationName: 'selected-collection-arrive',
    borderWidth: '4px',
    isLarger: true,
  });
  const holidayIds = await page
    .locator('.collection-video-grid [data-catalogue-id]')
    .evaluateAll((elements) => elements.map((element) => Number(element.dataset.catalogueId)));
  expect(holidayIds).toEqual(
    generatedCatalog.filter((movie) => movie.category === 'VAKANTIEFILMS').map((movie) => movie.id),
  );
});

test('rendered collection movie count and ids equal the generated JSON', async ({ page }) => {
  await page.getByRole('button', { name: /Bart & Astrid/i }).click();
  await page.getByRole('button', { name: 'Collections' }).click();

  const renderedIds: number[] = [];
  for (const category of ['JEUGDFILMS', 'VAKANTIEFILMS', 'EVENTS', 'OTHERS']) {
    await page.locator(`[data-focus-id="collection-${category.toLowerCase()}"]`).click();
    await expect(page.locator('.collection-grid > button').first()).toHaveAttribute(
      'data-focus-id',
      `collection-${category.toLowerCase()}`,
    );
    const ids = await page
      .locator('.collection-video-grid [data-catalogue-id]')
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
    await expect(page.locator('.synopsis')).toHaveText(movie.description);
    await page.locator('[data-focus-id="detail-play"]').click();
    const player = page.locator('video, iframe.stream-iframe');
    await expect(player).toHaveAttribute('data-catalogue-id', String(movie.id));
    await expect(player).toHaveAttribute('data-stream-video-id', movie.stream_video_id);
  }
});
