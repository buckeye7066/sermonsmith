import { test, expect } from '@playwright/test';

const USER = {
  id: 'reader-test', email: 'reader@example.com', full_name: 'Test Reader', role: 'user',
  onboarding_completed: true, last_seen_version: 'test-version',
  study_preferences: {}, content_preferences: {},
};

// Intercept every backend call; these navigation checks must never make paid
// provider calls, use real accounts, or depend on public Bible API uptime.
async function readerApi(page, { delayJohn = 0, anonymous = false } = {}) {
  const calls = [];
  let expired = anonymous;
  let failSettings = false;
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const body = req.postDataJSON();
    calls.push({ path, method: req.method(), body });
    const reply = (data, status = 200) => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(data),
    });
    if (path === '/api/auth/session') return reply(expired ? null : USER);
    if (path === '/api/auth/maintenance') return reply({ active: false });
    if (path === '/api/auth/me' && req.method() === 'PATCH' && failSettings) {
      expired = true;
      return reply({ message: 'Authentication required' }, 401);
    }
    if (path === '/api/auth/me') return reply(USER);
    if (path.includes('/biblePassage')) {
      if (body.bookCode === 'JHN' && body.chapter === 3 && delayJohn) {
        await new Promise((resolve) => setTimeout(resolve, delayJohn));
      }
      return reply({ verses: Array.from({ length: 36 }, (_, index) => ({
        verse: index + 1,
        text: `Test passage ${body.bookCode} ${body.chapter}:${index + 1}.`,
      })) });
    }
    if (path.includes('/listAvailableTranslations')) {
      return reply({ translations: [{ id: 'kjv', name: 'King James Version' }] });
    }
    if (path.startsWith('/api/ai/')) return reply({
      reference: 'Isaiah 40:31', text: 'But those who hope in the Lord will renew their strength.',
      why_today: 'A reminder of hope.', reflection: 'Trust and patient endurance.',
      application: 'Pause and pray.', prayer_starter: 'Lord, renew my strength today.',
    });
    if (path.startsWith('/api/entities/')) return reply([]);
    return reply({});
  });
  return { calls, expireSettings: () => { failSettings = true; } };
}

const navigation = (page) => page.getByRole('form', { name: 'Passage navigation' });
async function openReader(page, url = '/Reader') {
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Bible Reader', exact: true })).toBeVisible();
  await expect(navigation(page)).toBeVisible();
}

test('typed book, chapter and verse work on mobile Safari and Android profiles', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const { calls } = await readerApi(page, { delayJohn: 1100 });
  await openReader(page);
  const form = navigation(page);
  await form.getByLabel('Book', { exact: true }).fill('jn');
  await form.getByLabel('Chapter', { exact: true }).fill('3');
  await form.getByLabel('Verse (Optional)', { exact: true }).fill('16');
  await form.getByLabel('Verse (Optional)', { exact: true }).press('Enter');
  const verse = page.locator('[data-verse="16"]');
  await expect(verse).toHaveAttribute('aria-label', 'John 3:16');
  await expect(verse).toBeFocused();
  await expect(verse).toBeInViewport();
  await expect(form.getByLabel('Book', { exact: true })).toHaveValue('John');
  expect(calls.filter((call) => call.path === '/api/auth/session')).toHaveLength(1);
  // Merely loading preferences must not PATCH them back to the server.
  expect(calls.filter((call) => call.path === '/api/auth/me' && call.body?.reading_preferences)).toHaveLength(0);
  expect(errors).toEqual([]);
});

test('invalid typed input is rejected without fetching a different passage', async ({ page }) => {
  const { calls } = await readerApi(page);
  await openReader(page);
  await expect(page.locator('[data-verse="1"]')).toHaveAttribute('aria-label', 'Genesis 1:1');
  const initial = calls.filter((call) => call.path.includes('/biblePassage')).length;
  const form = navigation(page);
  await form.getByLabel('Book', { exact: true }).fill('John');
  await form.getByLabel('Chapter', { exact: true }).fill('3.5');
  await form.getByRole('button', { name: 'Open passage' }).click();
  await expect(form.getByRole('alert')).toContainText('whole number');
  expect(calls.filter((call) => call.path.includes('/biblePassage'))).toHaveLength(initial);
  await form.getByLabel('Book', { exact: true }).fill('John 3:16');
  await form.getByLabel('Book', { exact: true }).press('Enter');
  await expect(page.locator('[data-verse="16"]')).toHaveAttribute('aria-label', 'John 3:16');
  await expect(form.getByRole('alert')).toHaveCount(0);
});

test('the jump dialog accepts a full typed passage on mobile Safari and Android profiles', async ({ page }) => {
  await readerApi(page);
  await openReader(page);
  await page.getByTitle('Jump to Verse', { exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Jump to Verse' });
  await dialog.getByLabel('Book', { exact: true }).fill('1 Cor 13:4');
  await dialog.getByLabel('Book', { exact: true }).press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-verse="4"]')).toHaveAttribute('aria-label', '1 Corinthians 13:4');
  await page.getByTitle('Jump to Verse', { exact: true }).click();
  await expect(dialog.getByLabel('Book', { exact: true })).toHaveValue('1 Corinthians');
  await expect(dialog.getByLabel('Chapter', { exact: true })).toHaveValue('13');
});

test('late responses cannot replace a newer typed chapter', async ({ page }) => {
  const { calls } = await readerApi(page, { delayJohn: 1500 });
  await openReader(page);
  const form = navigation(page);
  await form.getByLabel('Book', { exact: true }).fill('John 3:16');
  await form.getByLabel('Book', { exact: true }).press('Enter');
  await expect.poll(() => calls.some((call) => call.body?.bookCode === 'JHN' && call.body?.chapter === 3)).toBe(true);
  await form.getByLabel('Book', { exact: true }).fill('Matthew 2:2');
  await form.getByLabel('Book', { exact: true }).press('Enter');
  await expect(page.locator('[data-verse="2"]')).toHaveAttribute('aria-label', 'Matthew 2:2');
  // Wait for the deliberately slower old request, not arbitrary UI readiness.
  await page.waitForTimeout(1700);
  await expect(page.locator('[data-verse="2"]')).toHaveAttribute('aria-label', 'Matthew 2:2');
  await expect(page.getByText('Test passage JHN 3:16.', { exact: true })).toHaveCount(0);
});

test('deep links validate full references and focus the requested verse', async ({ page }) => {
  await readerApi(page, { delayJohn: 1100 });
  await openReader(page, '/Reader?reference=Jn.%203%3A16');
  await expect(page.locator('[data-verse="16"]')).toHaveAttribute('aria-label', 'John 3:16');
  await expect(page.locator('[data-verse="16"]')).toBeFocused();
});

test('expired profile saves clear the signed-in UI and preserve the return location', async ({ page }) => {
  const { expireSettings } = await readerApi(page);
  await openReader(page);
  expireSettings();
  await page.getByTitle('Reader Settings', { exact: true }).click();
  await page.getByRole('dialog', { name: 'Reader Settings' }).getByRole('radio', { name: 'Dark', exact: true }).click();
  await expect(page).toHaveURL(/\/Login\?return=%2FReader$/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sermonsmith.authenticated-session'))).toBeNull();
});

test('anonymous startup does not generate an authentication error response', async ({ page }) => {
  const { calls } = await readerApi(page, { anonymous: true });
  const failures = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/auth/') && response.status() >= 400) failures.push(response.status());
  });
  await page.goto('/Pricing');
  await expect(page.getByRole('heading', { name: 'Choose Your Plan', exact: true })).toBeVisible();
  await expect.poll(() => calls.some((call) => call.path === '/api/auth/session')).toBe(true);
  expect(calls.some((call) => call.path === '/api/auth/me')).toBe(false);
  expect(failures).toEqual([]);
});
