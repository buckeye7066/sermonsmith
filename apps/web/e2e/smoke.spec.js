import { test, expect } from '@playwright/test';

async function mockLoggedOutApi(page) {
  await page.route('**/api/**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Authentication required' }),
    });
  });
}

test('route-specific documents expose aligned crawl metadata over HTTP', async ({ request }) => {
  const documents = [
    { file: '/index.html', canonical: 'https://sermonsmith.axiombiolabs.org/' },
    { file: '/pricing.html', canonical: 'https://sermonsmith.axiombiolabs.org/Pricing' },
    { file: '/downloads.html', canonical: 'https://sermonsmith.axiombiolabs.org/Downloads' },
    { file: '/privacy.html', canonical: 'https://sermonsmith.axiombiolabs.org/privacy' },
    { file: '/terms.html', canonical: 'https://sermonsmith.axiombiolabs.org/terms' },
  ];

  for (const document of documents) {
    const response = await request.get(document.file);
    expect(response.ok()).toBeTruthy();
    const html = await response.text();
    expect(html).toContain(`rel="canonical" href="${document.canonical}"`);
    expect(html).toContain('name="robots" content="index,follow,max-image-preview:large"');
  }

  const protectedShell = await request.get('/app.html');
  expect(protectedShell.ok()).toBeTruthy();
  const protectedHtml = await protectedShell.text();
  expect(protectedHtml).toContain('name="robots" content="noindex,nofollow,noarchive"');
  expect(protectedHtml).not.toContain('rel="canonical"');
});

test('anonymous public pages stay public after auth initialization', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await mockLoggedOutApi(page);

  const publicPages = [
    {
      path: '/',
      heading: 'SermonSmith',
      url: /\/$/,
      canonical: 'https://sermonsmith.axiombiolabs.org/',
      title: /AI-Assisted Sermon Builder/i,
    },
    {
      path: '/Pricing',
      heading: 'Choose Your Plan',
      url: /\/Pricing$/i,
      canonical: 'https://sermonsmith.axiombiolabs.org/Pricing',
      title: /SermonSmith Pricing/i,
    },
    {
      path: '/Downloads',
      heading: 'Scripture Sources & Offline Use',
      url: /\/Downloads$/i,
      canonical: 'https://sermonsmith.axiombiolabs.org/Downloads',
      title: /Scripture Sources & Offline Use/i,
    },
    {
      path: '/privacy',
      heading: 'Privacy Policy',
      url: /\/privacy$/i,
      canonical: 'https://sermonsmith.axiombiolabs.org/privacy',
      title: /SermonSmith Privacy Policy/i,
    },
    {
      path: '/terms',
      heading: 'Terms of Use',
      url: /\/terms$/i,
      canonical: 'https://sermonsmith.axiombiolabs.org/terms',
      title: /SermonSmith Terms of Use/i,
    },
  ];

  for (const publicPage of publicPages) {
    await page.goto(publicPage.path);
    await expect(page.getByRole('heading', { name: publicPage.heading }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(publicPage.url);
    await expect(page).toHaveTitle(publicPage.title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      publicPage.canonical,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'index,follow,max-image-preview:large',
    );
    expect(page.url()).not.toContain('/Login');
  }
  await expect(page.locator('#root')).not.toBeEmpty();
  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toEqual([]);
});

test('unauthenticated user reaches the login surface directly', async ({ page }) => {
  await mockLoggedOutApi(page);
  await page.goto('/Login');

  const authSurface = page.locator(
    'input[type="email"], [role="status"]:has-text("upgraded")',
  );
  await expect(authSurface.first()).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/Login$/i);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex,nofollow,noarchive',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});

test('registration form is reachable from a stable public URL', async ({ page }) => {
  await mockLoggedOutApi(page);
  await page.goto('/Login?mode=register');

  await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  await expect(page).toHaveURL(/\/Login\?mode=register$/i);
});

test('legacy service workers and SermonSmith caches are removed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SermonSmith' }).first()).toBeVisible();
  await expect.poll(async () => page.evaluate(async () => {
    const registrations = 'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistrations()
      : [];
    const cacheKeys = window.caches?.keys ? await caches.keys() : [];
    return {
      registrations: registrations.length,
      controlled: Boolean(navigator.serviceWorker?.controller),
      sermonSmithCaches: cacheKeys.filter((key) => key.startsWith('sermon-smith-')).length,
    };
  })).toEqual({ registrations: 0, controlled: false, sermonSmithCaches: 0 });
});

// Regression guard for the 2026-08-02 "Bible reader is a broken link" report:
// the sidebar link must navigate to /Reader and the Reader page chunk must
// load and render scripture. (The production failure mode was a stale lazy
// chunk after a deploy — see apps/web/src/lib/lazyWithReload.js — but this
// journey also catches the simpler regressions: route renamed/removed, nav
// link pointing elsewhere, Reader chunk failing to build or throwing on mount.)
test('Bible Reader sidebar link opens the reader and renders scripture', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-1',
        email: 'john@example.com',
        full_name: 'John White',
        role: 'user',
        onboarding_completed: true,
        last_seen_version: 'test-version',
        study_preferences: {},
        content_preferences: {},
      }),
    });
  });
  // Verse of the Day devotional — not under test; fail it fast and quietly.
  await page.route('**/api/ai/invoke', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.route('**/api/entities/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  // Route every Reader function request through one deterministic handler.
  // WebKit can dispatch the chapter request while the translation-list effect
  // starts; separate overlapping page routes intermittently allowed one of
  // those requests to escape to the production API during CI.
  await page.route('**/api/functions/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/biblePassage')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          verses: [
            { verse: 1, text: 'In the beginning God created the heaven and the earth.' },
            { verse: 2, text: 'And the earth was without form, and void.' },
          ],
        }),
      });
    }
    if (path.includes('/listAvailableTranslations')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ translations: [{ id: 'kjv', name: 'King James Version' }] }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/Home');
  const readerLink = page.locator('a[href="/Reader"]', { hasText: 'Bible Reader' }).first();
  await expect(readerLink).toBeVisible();
  await readerLink.click();

  await expect(page).toHaveURL(/\/Reader/);
  await expect(page.getByText('In the beginning God created', { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toEqual([]);
});

test('authenticated desktop shell fills the viewport without sidebar clipping', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-1',
        email: 'john@example.com',
        full_name: 'John White',
        role: 'dev',
        onboarding_completed: true,
        last_seen_version: 'test-version',
        study_preferences: {},
        content_preferences: {},
      }),
    });
  });

  await page.route('**/api/ai/invoke', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reference: 'Isaiah 40:31',
        text: 'But those who hope in the Lord will renew their strength.',
        why_today: 'A steady reminder to begin the day with hope.',
        reflection: 'This verse invites renewed trust and patient endurance.',
        application: 'Pause before the next task and name one place where you need strength.',
        prayer_starter: 'Lord, renew my strength today.',
      }),
    });
  });

  await page.route('**/api/entities/UserActivity', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'activity-1' }),
    });
  });

  await page.goto('/Home');
  await expect(page.getByRole('button', { name: /Create Sermon/i })).toBeVisible();

  const metrics = await page.evaluate(() => {
    const shell = document.querySelector('[data-app-shell]').getBoundingClientRect();
    const main = document.querySelector('main').getBoundingClientRect();
    const sidebar = document.querySelector('[data-app-sidebar]');
    const sidebarContent = document.querySelector('[data-sidebar-content]');

    return {
      viewportWidth: window.innerWidth,
      shellWidth: shell.width,
      mainRight: main.right,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      sidebarClientWidth: sidebar.clientWidth,
      sidebarContentClientWidth: sidebarContent.clientWidth,
      sidebarContentScrollWidth: sidebarContent.scrollWidth,
    };
  });

  expect(Math.abs(metrics.shellWidth - metrics.viewportWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(metrics.mainRight - metrics.viewportWidth)).toBeLessThanOrEqual(1);
  expect(metrics.documentScrollWidth).toBe(metrics.documentClientWidth);
  expect(metrics.sidebarContentScrollWidth).toBeLessThanOrEqual(metrics.sidebarContentClientWidth);
});

test('mobile Safari and Android profiles keep navigation reachable without page overflow', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile-'), 'mobile viewport contract');

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mobile-user',
        email: 'mobile@example.com',
        full_name: 'Mobile Reader',
        role: 'user',
        onboarding_completed: true,
        last_seen_version: 'test-version',
        study_preferences: {},
        content_preferences: {},
      }),
    });
  });
  await page.route('**/api/ai/invoke', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.route('**/api/entities/**', (route) => (
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  ));

  await page.goto('/Home');
  const navigation = page.getByRole('navigation').last();
  await expect(navigation).toBeVisible();

  const metrics = await page.evaluate(() => {
    const mobileNavigation = [...document.querySelectorAll('nav')]
      .find((element) => getComputedStyle(element).position === 'fixed');
    const links = [...mobileNavigation.querySelectorAll('a')]
      .map((link) => link.getBoundingClientRect());
    const main = document.querySelector('main');
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      smallestNavigationTarget: Math.min(...links.map((rect) => Math.min(rect.width, rect.height))),
      mainBottomPadding: Number.parseFloat(getComputedStyle(main).paddingBottom),
    };
  });

  expect(metrics.documentWidth).toBe(metrics.viewportWidth);
  expect(metrics.smallestNavigationTarget).toBeGreaterThanOrEqual(44);
  expect(metrics.mainBottomPadding).toBeGreaterThanOrEqual(64);
});

