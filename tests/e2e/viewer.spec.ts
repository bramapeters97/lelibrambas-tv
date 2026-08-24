import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/?screen=profiles&capture=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('profile to home to details to playback and back persists progress', async ({ page }) => {
  await page.getByRole('button', { name: /Bart & Astrid/i }).click();
  await expect(page.getByRole('heading', { name: 'Jeugdfilm 01' })).toBeVisible();
  await page.getByRole('button', { name: /More information/i }).click();
  await expect(page.locator('.details-screen')).toBeVisible();
  await page.locator('[data-focus-id="detail-play"]').click();
  await expect(page.locator('.player-screen')).toBeVisible();
  const video = page.locator('video');
  await expect(video).toHaveCount(1);
  await page.getByRole('button', { name: 'Play' }).click();
  await expect.poll(() => video.evaluate((element) => element.currentTime)).toBeGreaterThan(0.25);
  expect(await video.evaluate((element) => element.error?.code ?? null)).toBeNull();
  await page.locator('[data-focus-id="forward"]').click();
  await page.locator('[data-focus-id="player-back"]').click();
  await expect(page.locator('.details-screen')).toBeVisible();
  await expect(page.getByText(/Resume at/i)).toBeVisible();
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

test('search, watched state and collections are functional', async ({ page }) => {
  await page.getByRole('button', { name: /Eline & Luca/i }).click();
  await page.keyboard.press('s');
  await expect(page.getByRole('heading', { name: /Search the archive/i })).toBeVisible();
  await page.getByLabel(/Which folder should we open/i).fill('Vakantiefilm 01');
  await page
    .getByRole('button', { name: /Vakantiefilm 01/i })
    .first()
    .click();
  await page.getByRole('button', { name: 'Mark watched' }).click();
  await expect(page.getByRole('button', { name: 'Watched' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Collections' }).click();
  await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible();
  await expect(page.getByRole('button', { name: /VAKANTIEFILMS/i })).toBeVisible();
});

test('intro, profiles and the blended cinema hero match the viewer contract', async ({ page }) => {
  await page.goto('/?screen=ident&capture=1');
  await expect(page.getByRole('button', { name: /skip intro/i })).toHaveCount(0);

  await page.goto('/?screen=profiles&capture=1');
  await expect(page.getByRole('button', { name: /Bart & Astrid/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Bram & Edvin/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Eline & Luca/i })).toBeVisible();
  await page.getByRole('button', { name: /Bart & Astrid/i }).click();

  await expect(page.locator('.nav-wordmark__icon')).toBeVisible();
  await expect(page.locator('.nav-wordmark__letters')).toHaveCount(0);
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

test('all four directory groups receive playable test records in E2E mode', async ({ page }) => {
  const representativeIds = [
    'folder-placeholder-01',
    'folder-placeholder-04',
    'folder-placeholder-21',
    'folder-placeholder-29',
  ];

  for (const id of representativeIds) {
    await page.goto(`/?screen=details&capture=1&video=${id}`);
    await expect(page.locator('.details-screen')).toBeVisible();
    await expect(page.locator('[data-focus-id="detail-play"]')).toBeEnabled();
    await expect(
      page.locator('.availability-banner.status-unavailable, .availability-banner.status-failed'),
    ).toHaveCount(0);
  }
});
