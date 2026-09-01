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

const byId = new Map(generatedCatalog.map((movie) => [movie.id, movie]));

test.beforeEach(async ({ page }) => {
  await page.goto('/?screen=profiles&capture=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('web share metadata exposes the LELIBRAMBAS preview contract', async ({ page, request }) => {
  const launchDescription =
    "We're celebrating the launch of our new streaming-service Lelibrambas+. What's to discover? Subscribe to get access to the exclusive Peters Family-archive..";
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    launchDescription,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'LELIBRAMBAS+',
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    'content',
    launchDescription,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://lelibrambas.com/lelibrambas-studios.png',
  );
  await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute(
    'content',
    'image/png',
  );
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1536');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '1024');
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
    'content',
    launchDescription,
  );
  await expect(page.locator('link[rel="icon"][href$="/cinema-app-icon.png"]')).toHaveAttribute(
    'sizes',
    '1024x1024',
  );
  await expect(page.locator('link[rel="shortcut icon"]')).toHaveAttribute(
    'href',
    /(?:^|\/)favicon\.png$/,
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    /(?:^|\/)apple-touch-icon\.png$/,
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('sizes', '180x180');
  await expect(page.locator('link[rel="mask-icon"]')).toHaveAttribute(
    'href',
    /(?:^|\/)safari-pinned-tab\.png$/,
  );
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    /(?:^|\/)site\.webmanifest$/,
  );
  expect((await request.get('/lelibrambas-studios.png')).ok()).toBe(true);
  expect((await request.get('/favicon.png')).ok()).toBe(true);
  expect((await request.get('/cinema-app-icon.png')).ok()).toBe(true);
  expect((await request.get('/safari-pinned-tab.png')).ok()).toBe(true);
  expect((await request.get('/apple-touch-icon.png')).ok()).toBe(true);
  expect((await request.get('/cinema-icon-192.png')).ok()).toBe(true);
  expect((await request.get('/cinema-icon-512.png')).ok()).toBe(true);
  const manifestResponse = await request.get('/site.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    name: string;
    background_color: string;
    icons: { src: string; sizes: string; type: string }[];
  };
  expect(manifest.name).toBe('LELIBRAMBAS+');
  expect(manifest.background_color).toBe('#03050b');
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: '/favicon.png', sizes: '1024x1024', type: 'image/png' }),
      expect.objectContaining({ src: '/cinema-icon-192.png', sizes: '192x192' }),
      expect.objectContaining({ src: '/cinema-icon-512.png', sizes: '512x512' }),
    ]),
  );

  const iconGeometry = await page.evaluate(async () => {
    const image = new Image();
    image.src = '/favicon.png';
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(image, 0, 0);
    const alphaAt = (x: number, y: number) => context.getImageData(x, y, 1, 1).data[3];
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      corners: [alphaAt(0, 0), alphaAt(1023, 0), alphaAt(0, 1023), alphaAt(1023, 1023)],
      edgeCenters: [alphaAt(512, 0), alphaAt(0, 512), alphaAt(1023, 512), alphaAt(512, 1023)],
    };
  });
  expect(iconGeometry).toEqual({
    width: 1024,
    height: 1024,
    corners: [0, 0, 0, 0],
    edgeCenters: [255, 255, 255, 255],
  });
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
  const player = page.locator('.player-screen > video');
  await expect(player).toHaveCount(1);
  await expect(player).toHaveAttribute('data-catalogue-id', String(movie.id));
  await expect(player).toHaveAttribute('data-stream-video-id', movie.stream_video_id);
  await expect(player).toHaveAttribute('data-playback-url', /\/manifest\/video\.m3u8$/);
  const skipBack = page.getByRole('button', { name: 'Skip back 10 seconds' });
  const playPause = page.locator('[data-focus-id="play-pause"]');
  const skipForward = page.getByRole('button', { name: 'Skip forward 10 seconds' });
  const mute = page.getByRole('button', { name: 'Mute' });
  await expect(skipBack).toBeVisible();
  await expect(skipForward).toBeVisible();
  await expect(mute).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Playback position' })).toBeVisible();
  const skipStyle = await skipBack.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      width: style.width,
      height: style.height,
      borderRadius: style.borderRadius,
      backgroundColor: style.backgroundColor,
    };
  });
  const volumeStyle = await mute.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      width: style.width,
      height: style.height,
      borderRadius: style.borderRadius,
      backgroundColor: style.backgroundColor,
    };
  });
  expect(skipStyle).toEqual(volumeStyle);
  await playPause.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(skipBack).toBeFocused();
  await playPause.focus();
  await page.keyboard.press('ArrowRight');
  await expect(skipForward).toBeFocused();
  const playerBack = page.locator('[data-focus-id="player-back"]');
  await expect(playerBack).toHaveText('←');
  const playerBackStyle = await playerBack.evaluate((element) => {
    const style = getComputedStyle(element);
    return { borderWidth: style.borderTopWidth, backgroundColor: style.backgroundColor };
  });
  expect(playerBackStyle).toEqual({
    borderWidth: '1px',
    backgroundColor: 'rgba(3, 5, 11, 0.42)',
  });
  await playerBack.click();
  await expect(page.locator('.details-screen')).toBeVisible();
});

test('arrow navigation exposes a visible deterministic focus state', async ({ page }) => {
  await page.getByRole('button', { name: /Bram & Edvin/i }).click();
  await expect(page.locator('[data-focus-id="hero-play"]')).toBeVisible();
  await page.locator('[data-focus-id="nav-home"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() =>
      page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.focusId),
    )
    .not.toBe('nav-home');
  const focusId = await page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.dataset.focusId ?? null,
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
  const introButton = page.getByRole('button', { name: 'Replay entrance with logo and tune' });
  await expect(introButton).toHaveText('');
  const introWidth = (await introButton.boundingBox())!.width;
  await introButton.focus();
  expect((await introButton.boundingBox())!.width).toBe(introWidth);
  const heroHeading = page.getByRole('heading', { name: 'LELIBRAMBAS+ Trailer' });
  await expect(heroHeading).toBeVisible();
  await expect(heroHeading.locator('.hero-title-plus')).toHaveText('+');
  expect(
    await heroHeading
      .locator('.hero-title-plus')
      .evaluate((element) => getComputedStyle(element).color),
  ).toBe('rgb(112, 216, 255)');
  await expect(page.getByRole('button', { name: 'Play Trailer' })).toBeVisible();
  await expect(page.locator('.hero .metadata')).toContainText('2026');
  await expect(page.locator('.hero-art .hero-poster')).toHaveCount(1);
  await expect(page.locator('.hero-art .hero-poster')).toHaveAttribute(
    'src',
    /lelibrambas_productions.*\.png$/,
  );
  await expect(page.locator('.hero-art .hero-poster')).not.toHaveAttribute(
    'src',
    new RegExp(
      generatedCatalog.find((movie) => movie.title === 'Lelibrambas+ Trailer')!.poster_url,
    ),
  );
  const heroArtwork = await page.locator('.hero-art').evaluate((element) => {
    const art = element.getBoundingClientRect();
    const hero = element.parentElement?.getBoundingClientRect();
    const mask = getComputedStyle(element).maskImage;
    return { ratio: hero ? art.width / hero.width : 0, mask };
  });
  expect(heroArtwork.ratio).toBeGreaterThanOrEqual(0.7);
  expect(heroArtwork.ratio).toBeLessThanOrEqual(0.9);
  expect(heroArtwork.mask).toContain('radial-gradient');
  await expect(page.getByText('Format unknown')).toHaveCount(0);
});

test('home collection shortcuts open the selected collection and home rows mirror JSON', async ({
  page,
}) => {
  await page.getByRole('button', { name: /Bart & Astrid/i }).click();

  const collectionCardAnimations = await page
    .locator('.home-hubs-row button')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element, '::after');
        return {
          name: style.animationName,
          duration: style.animationDuration,
          iterations: style.animationIterationCount,
        };
      }),
    );
  expect(collectionCardAnimations).toHaveLength(4);
  expect(collectionCardAnimations).toEqual(
    Array.from({ length: 4 }, () => ({
      name: 'home-collection-shade',
      duration: '2s',
      iterations: 'infinite',
    })),
  );
  expect((await page.locator('.home-hubs-row button').first().boundingBox())!.width).toBeGreaterThanOrEqual(
    230,
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
    'collection-jeugdfilms',
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
    await expect(page.locator('#collection-results')).toHaveAttribute(
      'data-collection-id',
      category.toLowerCase(),
    );
    await expect(page.locator('.collection-grid > button').first()).toHaveAttribute(
      'data-focus-id',
      'collection-jeugdfilms',
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

test('full library and home All movies contain every catalogue id exactly once in order', async ({
  page,
}) => {
  await page.getByRole('button', { name: /Bart & Astrid/i }).click();
  const expectedIds = generatedCatalog.map((movie) => movie.id);
  const homeCards = page.locator('[data-all-movies-grid] [data-catalogue-id]');
  await expect(homeCards).toHaveCount(expectedIds.length);
  const homeIds = await homeCards
    .evaluateAll((elements) => elements.map((element) => Number(element.dataset.catalogueId)));
  expect(homeIds).toEqual(expectedIds);

  await page.getByRole('button', { name: 'Full Library' }).click();
  const libraryCards = page.locator('[data-library-grid] [data-catalogue-id]');
  await expect(libraryCards).toHaveCount(expectedIds.length);
  const libraryIds = await libraryCards
    .evaluateAll((elements) => elements.map((element) => Number(element.dataset.catalogueId)));
  expect(libraryIds).toEqual(expectedIds);
  expect(new Set(libraryIds).size).toBe(expectedIds.length);
  await expect(page.getByText('Format unknown')).toHaveCount(0);
});

test('catalogue poster corrections use the exact generated PNGs', async ({ page, request }) => {
  for (const id of [10, 14, 40]) {
    const movie = byId.get(id)!;
    await page.goto(`/?screen=details&capture=1&video=${id}`);
    await expect(page.locator('.details-art img')).toHaveAttribute(
      'src',
      new RegExp(movie.poster_url),
    );
    expect((await request.get(`/${movie.poster_url}`)).ok()).toBe(true);
  }
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
