import { test, expect } from '@playwright/test';

// Backend-independent smoke: the app must boot, mount React into #root, keep
// its title, and surface an interactive auth UI when unauthenticated — all
// without throwing an uncaught page error.
test('app boots and renders the shell', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/');

  // Title is served from index.html and must survive the build.
  await expect(page).toHaveTitle(/SermonSmith/i);

  // React mounted something into #root.
  await expect(page.locator('#root')).not.toBeEmpty();

  // No uncaught runtime errors during boot/route.
  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toEqual([]);
});

test('unauthenticated user reaches an auth surface', async ({ page }) => {
  await page.goto('/');
  // Either an email field (login) or a visible sign-in/get-started affordance.
  const authSurface = page.locator(
    'input[type="email"], a:has-text("Login"), a:has-text("Sign"), button:has-text("Sign"), button:has-text("Get Started")',
  );
  await expect(authSurface.first()).toBeVisible({ timeout: 15_000 });
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
