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

test('anonymous public pages stay public after auth initialization', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await mockLoggedOutApi(page);

  const publicPages = [
    { path: '/', heading: 'SermonSmith', url: /\/$/ },
    { path: '/Pricing', heading: 'Choose Your Plan', url: /\/Pricing$/i },
    { path: '/privacy', heading: 'Privacy Policy', url: /\/privacy$/i },
  ];

  for (const publicPage of publicPages) {
    await page.goto(publicPage.path);
    await expect(page.getByRole('heading', { name: publicPage.heading }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(publicPage.url);
    expect(page.url()).not.toContain('/Login');
  }

  await expect(page).toHaveTitle(/SermonSmith/i);
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
});

test('registration form is reachable from a stable public URL', async ({ page }) => {
  await mockLoggedOutApi(page);
  await page.goto('/Login?mode=register');

  await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  await expect(page).toHaveURL(/\/Login\?mode=register$/i);
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
  await page.route('**/api/functions/biblePassage', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        verses: [
          { verse: 1, text: 'In the beginning God created the heaven and the earth.' },
          { verse: 2, text: 'And the earth was without form, and void.' },
        ],
      }),
    });
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
