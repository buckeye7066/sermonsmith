import { test, expect } from '@playwright/test';

// Browser proof for the core sermon flow (spec: generate → validate → save →
// reopen) and for the invalid-Scripture warning flow (visible finding, draft
// stays editable, save is honestly downgraded — never silently clean).
//
// The AI and entity APIs are route-mocked: this is UI-truth evidence
// (rendering, wiring, validation surfacing, save payloads), not live-model
// evidence. Streaming is mocked as unavailable (503) so the builder takes
// its real fallback path through /api/ai/invoke.

const USER = {
  id: 'user-1',
  email: 'pastor@example.com',
  full_name: 'Test Pastor',
  role: 'user',
  onboarding_completed: true,
  last_seen_version: 'test-version',
  study_preferences: {},
  content_preferences: {},
};

function sermonPayload({ badRef = false } = {}) {
  return {
    title: 'Amazing Grace for Every Day',
    big_idea: 'Grace is God’s gift, received not earned.',
    theological_notes: 'Salvation by grace through faith.',
    points: [
      {
        title: 'Dead in sin, alive in Christ',
        exegesis: 'Paul contrasts our former state with God’s mercy.',
        illustration: 'A hypothetical story about an unpayable debt forgiven.',
        application: 'Receive grace with gratitude this week.',
        supporting_scriptures: badRef ? ['Hezekiah 4:5'] : ['Romans 8:28-30'],
      },
    ],
    conclusion: 'Respond to grace with faith. Ephesians 2:8 reminds us it is the gift of God.',
  };
}

async function mockCommonRoutes(page, { aiSermon }) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }));

  // Generic entity traffic (activity logs, collections, tags…) succeeds
  // quietly. Registered FIRST so the specific Sermon routes below win.
  await page.route('**/api/entities/**', (route) => {
    const req = route.request();
    // List/filter endpoints must return arrays; creates return a record.
    const wantsArray = req.method() === 'GET' || req.url().includes('/filter');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wantsArray ? [] : { id: 'x-1' }),
    });
  });

  // Streaming unavailable → the builder exercises its real invoke fallback.
  await page.route('**/api/ai/stream', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'streaming disabled in e2e' }) }));

  await page.route('**/api/ai/invoke', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(aiSermon) }));
}

async function mockSermonEntity(page, { saved }) {
  const captured = [];
  await page.route('**/api/entities/Sermon', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const payload = req.postDataJSON();
      captured.push(payload);
      // Mirror the API's formatEntity shape — pages render created_date.
      const now = new Date().toISOString();
      const record = { id: 's-1', ...payload, user_id: USER.id, created_date: now, updated_date: now };
      saved.push(record);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(record) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(saved) });
  });
  await page.route('**/api/entities/Sermon/filter', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(saved) }));
  return captured;
}

test('core flow: generate → validation → save as clean draft → reopen from library', async ({ page }) => {
  const saved = [];
  await mockCommonRoutes(page, { aiSermon: sermonPayload() });
  const captured = await mockSermonEntity(page, { saved });

  await page.goto('/SermonBuilder');
  await page.getByPlaceholder(/Faith, Grace, Prayer/i).fill('Grace');
  await page.getByPlaceholder(/John 3:16, Romans/i).fill('Ephesians 2:1-10');
  await page.getByRole('button', { name: /Generate Sermon with Larry/i }).click();

  // The generated draft renders.
  await expect(page.getByText('Amazing Grace for Every Day').first()).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: /^Save Sermon$/i }).click();
  await expect(page.getByText(/Sermon saved successfully/i)).toBeVisible({ timeout: 10_000 });

  // The save payload is a clean draft with fully valid, verse-checked refs.
  expect(captured).toHaveLength(1);
  expect(captured[0].status).toBe('draft');
  expect(captured[0].scripture_validation.length).toBeGreaterThan(0);
  expect(captured[0].scripture_validation.every((r) => r.status === 'valid')).toBe(true);

  // The quality chip is honest: a draft, not a green "verified" badge.
  await expect(page.getByText(/AI-generated draft — review before preaching/i)).toBeVisible();

  // Explicit human review via the acknowledgment endpoint.
  await page.route('**/api/entities/Sermon/*/review', (route) => {
    const { acknowledged } = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...saved[0], pastor_reviewed: acknowledged, reviewed_by: USER.id }),
    });
  });
  for (const checkpoint of [
    'Scripture in context',
    'Theological claims',
    'Illustrations and facts',
    'Pastoral application',
  ]) {
    await page.getByRole('checkbox', { name: checkpoint }).check();
  }
  await page.getByRole('button', { name: /I've reviewed this sermon/i }).click();
  // Case-sensitive, unanchored: matches the chip ("Pastor reviewed"), not
  // the lowercase toast copy ("Marked as pastor reviewed.").
  await expect(page.getByText(/Pastor reviewed/).first()).toBeVisible({ timeout: 10_000 });

  // Reopen from the library.
  await page.goto('/MySermons');
  await expect(page.getByText('Amazing Grace for Every Day').first()).toBeVisible({ timeout: 15_000 });
});

test('warning flow: invalid Scripture → visible finding → still editable → honest needs_review save', async ({ page }) => {
  const saved = [];
  await mockCommonRoutes(page, { aiSermon: sermonPayload({ badRef: true }) });
  const captured = await mockSermonEntity(page, { saved });

  await page.goto('/SermonBuilder');
  await page.getByPlaceholder(/Faith, Grace, Prayer/i).fill('Grace');
  await page.getByPlaceholder(/John 3:16, Romans/i).fill('Ephesians 2:1-10');
  await page.getByRole('button', { name: /Generate Sermon with Larry/i }).click();
  await expect(page.getByText('Amazing Grace for Every Day').first()).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: /^Save Sermon$/i }).click();

  // The finding is visible — not hidden, not fatal.
  await expect(page.getByText(/Scripture references look invalid/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Sermon saved successfully/i)).toBeVisible({ timeout: 10_000 });

  // The stored record is honestly flagged, with the invalid ref recorded.
  expect(captured).toHaveLength(1);
  expect(captured[0].status).toBe('needs_review');
  const statuses = captured[0].scripture_validation.map((r) => r.status);
  expect(statuses).toContain('invalid_book');

  // The draft remains editable after the warning (Save stays available for
  // a corrected re-save).
  await expect(page.getByRole('button', { name: /^Save Sermon$/i })).toBeEnabled();

  // The finding is also surfaced as a persistent chip with the specific
  // reference — not just a transient toast.
  await expect(page.getByText(/1 reference needs? attention/i)).toBeVisible();
  await expect(page.getByText(/Hezekiah 4:5/).first()).toBeVisible();
});
