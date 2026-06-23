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
