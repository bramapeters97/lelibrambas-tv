import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

interface GeneratedMovie {
  id: number;
  title: string;
  description: string;
  category: string;
  poster_url: string;
  stream_video_id: string;
}

const generatedCatalog = JSON.parse(
  readFileSync(new URL('../../data/media_catalog.json', import.meta.url), 'utf8'),
) as GeneratedMovie[];

async function clearViewerStorage(page: import('@playwright/test').Page) {
  await page.goto('/?screen=profiles&capture=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

test.describe('mobile responsive viewer', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await clearViewerStorage(page);
  });

  test('keeps all three profile cards centered on one row without page overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    const layout = await page.locator('.profile-card').evaluateAll((cards) => {
      const bounds = cards.map((card) => card.getBoundingClientRect());
      return {
        count: bounds.length,
        topSpread:
          Math.max(...bounds.map(({ top }) => top)) - Math.min(...bounds.map(({ top }) => top)),
        targetHeights: bounds.map(({ height }) => height),
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });
    expect(layout.count).toBe(3);
    expect(layout.topSpread).toBeLessThan(2);
    expect(layout.targetHeights.every((height) => height >= 44)).toBe(true);
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  });

  test('holds the branded profile loading screen for exactly 3000ms', async ({ page }) => {
    await page.clock.install({ time: new Date('2035-01-01T00:00:00.000Z') });
    await page.clock.pauseAt(new Date('2035-01-01T00:00:01.000Z'));
    await page.goto('/?screen=profiles');
    await page.getByRole('button', { name: /Bart & Astrid/i }).click();
    await expect(page.locator('.profile-loading-screen')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('lelibrambas-plus:profile-id'))).toBe(
      '"bart-astrid"',
    );

    await page.clock.fastForward(2999);
    await expect(page.locator('.profile-loading-screen')).toBeVisible();
    await page.clock.fastForward(1);
    await expect(page.locator('.home-content')).toBeVisible();
    await page.clock.resume();
  });

  test('uses compact mobile home cards and preserves the desktop collection shimmer', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Bart & Astrid/i }).click();
    const hero = page.locator('.hero-copy h1');
    const heroBounds = await hero.boundingBox();
    expect(heroBounds).not.toBeNull();
    expect(heroBounds!.x + heroBounds!.width).toBeLessThanOrEqual(390);
    expect(
      Number.parseFloat(await hero.evaluate((element) => getComputedStyle(element).fontSize)),
    ).toBeLessThan(50);

    const shimmer = await page
      .locator('.home-hubs-row button')
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element, '::after');
        return {
          name: style.animationName,
          duration: style.animationDuration,
          iterations: style.animationIterationCount,
        };
      });
    expect(shimmer).toEqual({
      name: 'home-collection-shade',
      duration: '2s',
      iterations: '1',
    });

    const visibleCardCount = await page
      .locator('.card-rail')
      .first()
      .evaluate((rail) => {
        const railBounds = rail.getBoundingClientRect();
        return [...rail.querySelectorAll('.art-card-shell')].filter((card) => {
          const cardBounds = card.getBoundingClientRect();
          return cardBounds.left < railBounds.right && cardBounds.right > railBounds.left;
        }).length;
      });
    expect(visibleCardCount).toBeGreaterThanOrEqual(3);
    expect((await page.locator('.card-rail .art-card-shell').first().boundingBox())!.width).toBeLessThanOrEqual(
      135,
    );
  });

  test('renders stable scrollable collection selectors and an exact two-column movie grid', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Bart & Astrid/i }).click();
    await page.getByRole('button', { name: 'Collections' }).click();

    const selector = page.locator('[data-collection-selector]');
    const initialOrder = await selector
      .locator('[data-collection-id]')
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-collection-id')),
      );
    expect(initialOrder).toEqual(['jeugdfilms', 'vakantiefilms', 'events', 'others']);
    const selectorLayout = await selector.evaluate((element) => {
      const style = getComputedStyle(element);
      const tops = [...element.children].map((child) => child.getBoundingClientRect().top);
      return {
        display: style.display,
        overflowX: style.overflowX,
        topSpread: Math.max(...tops) - Math.min(...tops),
        canScroll: element.scrollWidth > element.clientWidth,
      };
    });
    expect(selectorLayout.display).toBe('flex');
    expect(selectorLayout.overflowX).toBe('auto');
    expect(selectorLayout.topSpread).toBeLessThan(2);
    expect(selectorLayout.canScroll).toBe(true);

    await page.locator('[data-focus-id="collection-vakantiefilms"]').click();
    await expect(page.locator('#collection-results')).toHaveAttribute(
      'data-collection-id',
      'vakantiefilms',
    );
    expect(
      await selector
        .locator('[data-collection-id]')
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('data-collection-id')),
        ),
    ).toEqual(initialOrder);

    const grid = page.locator('[data-collection-video-grid]');
    const gridLayout = await grid.evaluate((element) => {
      const style = getComputedStyle(element);
      const first = [...element.children].slice(0, 2).map((child) => child.getBoundingClientRect());
      return {
        columns: style.gridTemplateColumns.split(' ').filter(Boolean).length,
        firstRowSpread:
          Math.max(...first.map(({ top }) => top)) - Math.min(...first.map(({ top }) => top)),
        xPositions: first.map(({ x }) => x),
      };
    });
    expect(gridLayout.columns).toBe(2);
    expect(gridLayout.firstRowSpread).toBeLessThan(2);
    expect(new Set(gridLayout.xPositions).size).toBe(2);

    const selectedAnimation = await page
      .locator('[data-focus-id="collection-vakantiefilms"]')
      .evaluate((element) => {
        const card = getComputedStyle(element);
        const sweep = getComputedStyle(element, '::after');
        return {
          cardDuration: card.animationDuration,
          sweepDuration: sweep.animationDuration,
          transitionContract: element.parentElement?.nextElementSibling?.getAttribute(
            'data-transition-duration-ms',
          ),
        };
      });
    expect(selectedAnimation.cardDuration).toBe('1s');
    expect(selectedAnimation.sweepDuration).toBe('1s');
    expect(selectedAnimation.transitionContract).toBe('1000');

    const overflow = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1);
  });

  test('uses a compact native search input, hides TV extras, and shows every result in two columns', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Bart & Astrid/i }).click();
    await page.getByRole('button', { name: 'Search' }).click();
    const searchInput = page.getByLabel('Which folder should we open?');
    await searchInput.fill('a');
    await expect(page.locator('[data-search-extras]')).toBeHidden();
    await expect(page.locator('.voice-placeholder')).toBeHidden();
    expect((await page.locator('[data-search-input]').boundingBox())!.height).toBeLessThanOrEqual(
      50,
    );

    const resultCount = Number(
      await page.locator('[data-search-results]').getAttribute('data-result-count'),
    );
    expect(resultCount).toBeGreaterThan(8);
    await expect(page.locator('[data-search-grid] [data-catalogue-id]')).toHaveCount(resultCount);
    expect(
      await page
        .locator('[data-search-grid]')
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length),
    ).toBe(2);
  });

  test('opens playback on the first mobile card tap while retaining a separate Details action', async ({
    page,
  }) => {
    await page.goto('/?screen=search&capture=1');
    await page.getByLabel('Which folder should we open?').fill('South Africa');
    const card = page.locator('[data-search-grid] [data-catalogue-id="7"]');
    await expect(card.locator('.mobile-card-info')).toBeVisible();
    await card.locator('.mobile-card-info').click();
    await expect(page.locator('.details-screen')).toBeVisible();

    await page.goto('/?screen=search&capture=1');
    await page.getByLabel('Which folder should we open?').fill('South Africa');
    await page
      .locator('[data-search-grid] [data-catalogue-id="7"] [data-card-action="primary"]')
      .click();
    await expect(page.locator('.player-screen')).toBeVisible();
    await expect(page.locator('video, iframe.stream-iframe')).toHaveAttribute(
      'data-catalogue-id',
      '7',
    );
  });

  test('keeps mobile details readable, scrollable, and free of fabricated runtime copy', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/?screen=details&capture=1&video=40');
    const heading = page.locator('.details-copy h1');
    const bounds = await heading.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    expect(
      Number.parseFloat(await heading.evaluate((element) => getComputedStyle(element).fontSize)),
    ).toBeLessThan(48);
    await expect(page.getByText('60 min')).toHaveCount(0);
    await expect(page.getByText('Format unknown')).toHaveCount(0);
    expect(
      await page
        .locator('.details-screen')
        .evaluate((element) => element.scrollHeight >= element.clientHeight),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      321,
    );
  });
});

test('profile-isolated Recently watched is newest-first and carries saved progress', async ({
  page,
}) => {
  await clearViewerStorage(page);
  await page.evaluate(() => {
    const prefix = 'lelibrambas-plus:progress:bart-astrid:';
    localStorage.setItem(
      `${prefix}1`,
      JSON.stringify({
        profileId: 'bart-astrid',
        videoId: '1',
        seconds: 25,
        durationSeconds: 100,
        completed: false,
        updatedAt: '2026-08-24T10:00:00.000Z',
      }),
    );
    localStorage.setItem(
      `${prefix}2`,
      JSON.stringify({
        profileId: 'bart-astrid',
        videoId: '2',
        seconds: 75,
        durationSeconds: 100,
        completed: false,
        updatedAt: '2026-08-24T11:00:00.000Z',
      }),
    );
  });
  await page.getByRole('button', { name: /Bart & Astrid/i }).click();
  const history = page.locator('[data-home-rail="recently-watched"]');
  await expect(history).toBeVisible();
  expect(
    await page
      .locator('.home-content > [data-home-rail]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-home-rail'))),
  ).toEqual([
    'collections',
    'recently-watched',
    'currently-trending',
    'jeugdfilms',
    'vakantiefilms',
    'events',
    'others',
    'all-movies',
  ]);
  expect(
    await history
      .locator('[data-catalogue-id]')
      .evaluateAll((elements) => elements.map((element) => Number(element.dataset.catalogueId))),
  ).toEqual([2, 1]);
  await expect(history.locator('[data-catalogue-id="2"] .browse-card-progress')).toHaveAttribute(
    'data-progress-percent',
    '75',
  );

  await page.getByRole('button', { name: /Switch profile/i }).click();
  await page.getByRole('button', { name: /Bram & Edvin/i }).click();
  await expect(page.locator('[data-home-rail="recently-watched"]')).toHaveCount(0);
});

test('reduced motion collapses collection result transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?screen=collections&capture=1');
  await page.locator('[data-focus-id="collection-vakantiefilms"]').click();
  await expect(page.locator('#collection-results')).toHaveAttribute(
    'data-collection-id',
    'vakantiefilms',
  );
  await expect(page.locator('#collection-results')).toHaveAttribute(
    'data-transition-state',
    'idle',
  );
  const reducedDurationSeconds = await page.locator('#collection-results').evaluate((element) =>
    getComputedStyle(element)
      .transitionDuration.split(',')
      .map((value) => Number.parseFloat(value) * (value.trim().endsWith('ms') ? 0.001 : 1)),
  );
  expect(Math.max(...reducedDurationSeconds)).toBeLessThan(0.001);
});

test('hero idle media is disabled in capture mode and restores the poster after rejected autoplay', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2035-01-01T00:00:00.000Z') });
  await page.clock.pauseAt(new Date('2035-01-01T00:00:01.000Z'));
  await page.goto('/?screen=home&capture=1');
  await page.clock.fastForward(2500);
  await expect(page.locator('[data-hero-media="trailer"]')).toHaveCount(0);
  await expect(page.locator('[data-hero-state="poster"]')).toBeVisible();

  await page.addInitScript(() => {
    const currentTimes = new WeakMap<HTMLMediaElement, number>();
    Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get() {
        return currentTimes.get(this) ?? 0;
      },
      set(value: number) {
        currentTimes.set(this, value);
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'seeking', {
      configurable: true,
      get: () => false,
    });
    HTMLMediaElement.prototype.play = () =>
      Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
  });
  await page.goto('/?screen=home');
  await expect(page.locator('[data-hero-state="poster"]')).toBeVisible();
  await page.clock.fastForward(1500);
  await page.dispatchEvent('body', 'pointerdown');
  await page.clock.fastForward(1999);
  await expect(page.locator('[data-hero-media="trailer"]')).toHaveCount(0);
  await page.clock.fastForward(2);
  const trailer = page.locator('[data-hero-media="trailer"]');
  await expect(trailer).toHaveCount(1);
  await expect(trailer).toHaveAttribute('data-preview-start-seconds', '40');
  await expect(trailer).not.toHaveAttribute('controls');
  await trailer.dispatchEvent('loadedmetadata');
  await expect(page.locator('[data-hero-media="trailer"]')).toHaveCount(0);
  await expect(page.locator('[data-hero-state="poster"]')).toBeVisible();
  await page.clock.resume();
});

test('detail backgrounds cue a borderless preview at 120s only after the two-second idle', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.clock.install({ time: new Date('2035-01-01T00:00:00.000Z') });
  await page.clock.pauseAt(new Date('2035-01-01T00:00:01.000Z'));
  await page.addInitScript(() => {
    const currentTimes = new WeakMap<HTMLMediaElement, number>();
    Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get() {
        return currentTimes.get(this) ?? 0;
      },
      set(value: number) {
        currentTimes.set(this, value);
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'seeking', {
      configurable: true,
      get: () => false,
    });
    HTMLMediaElement.prototype.play = () => Promise.resolve();
  });
  await page.goto('/?screen=details&video=7');
  await expect(page.locator('[data-detail-preview-state="poster"]')).toBeVisible();
  await page.clock.fastForward(1999);
  await expect(page.locator('[data-detail-media="preview"]')).toHaveCount(0);
  await page.clock.fastForward(1);

  const preview = page.locator('[data-detail-media="preview"]');
  await expect(preview).toHaveCount(1);
  await expect(preview).toHaveAttribute('data-preview-start-seconds', '120');
  await expect(preview).not.toHaveAttribute('controls');
  await preview.dispatchEvent('loadedmetadata');
  await expect(page.locator('[data-detail-preview-state="playing"]')).toBeVisible();
  expect(await preview.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBe(120);
  const blendedStyle = await preview.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderWidth: style.borderTopWidth,
      opacity: style.opacity,
      objectFit: style.objectFit,
    };
  });
  expect(blendedStyle).toEqual({ borderWidth: '0px', opacity: '0.58', objectFit: 'cover' });

  expect(
    await page
      .locator('.details-screen')
      .evaluate((element) => element.scrollHeight > element.clientHeight),
  ).toBe(true);
  await page.locator('.details-screen').evaluate((element) => {
    element.scrollTo(0, 100);
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(page.locator('[data-detail-media="preview"]')).toHaveCount(0);
  await expect(page.locator('[data-detail-preview-state="poster"]')).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.includes(':progress:')),
    ),
  ).toEqual([]);
  await page.clock.resume();
});

test('responsive document width stays bounded at required representative viewports', async ({
  page,
}) => {
  for (const viewport of [
    { width: 430, height: 932 },
    { width: 740, height: 430 },
    { width: 800, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/?screen=library&capture=1');
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
});
