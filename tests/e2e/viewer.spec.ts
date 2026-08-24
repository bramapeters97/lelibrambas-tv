import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/?screen=profiles&capture=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('profile to home to details to playback and back persists progress', async ({ page }) => {
  await page.getByRole('button', { name: /Bram/i }).click();
  await expect(page.getByRole('heading', { name: 'Stockholm Summer' })).toBeVisible();
  await page.getByRole('button', { name: /More information/i }).click();
  await expect(page.locator('.details-screen')).toBeVisible();
  await page.locator('[data-focus-id="detail-play"]').click();
  await expect(page.locator('.player-screen')).toBeVisible();
  await page.locator('[data-focus-id="forward"]').click();
  await page.locator('[data-focus-id="player-back"]').click();
  await expect(page.locator('.details-screen')).toBeVisible();
  await expect(page.getByText(/Resume at/i)).toBeVisible();
});

test('arrow navigation exposes a visible deterministic focus state', async ({ page }) => {
  await page.getByRole('button', { name: /Family/i }).click();
  await page.keyboard.press('ArrowRight');
  const focusId = await page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.dataset.focusId,
  );
  expect(focusId).toBeTruthy();
  await expect(page.locator(':focus')).toBeVisible();
});

test('search, watchlist and Surprise Me are functional', async ({ page }) => {
  await page.getByRole('button', { name: /Family/i }).click();
  await page.keyboard.press('s');
  await expect(page.getByRole('heading', { name: /Search the archive/i })).toBeVisible();
  await page.getByLabel(/What would you like to remember/i).fill('Stockholm');
  await page
    .getByRole('button', { name: /Stockholm Summer/i })
    .first()
    .click();
  await page.getByRole('button', { name: /Watchlist/i }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Watchlist' }).click();
  await expect(page.getByText('Stockholm Summer')).toBeVisible();
  await page.getByRole('button', { name: /Surprise me/i }).click();
  await expect(page.locator('.details-screen')).toBeVisible();
});

test('Surprise Me excludes unavailable and failed catalogue states', async ({ page }) => {
  await page.getByRole('button', { name: /Guest/i }).click();
  await page.locator('[data-focus-id="nav-watchlist"]').click();
  for (let index = 0; index < 5; index += 1) {
    await page.locator('[data-focus-id="surprise"]').click();
    await expect(page.locator('[data-focus-id="detail-play"]')).toBeEnabled();
    await expect(
      page.locator('.availability-banner.status-unavailable, .availability-banner.status-failed'),
    ).toHaveCount(0);
    await page.locator('[data-focus-id="details-back"]').click();
  }
});
