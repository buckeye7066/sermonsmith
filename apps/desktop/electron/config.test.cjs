const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_LOCAL_API_URL,
  LEGACY_LOCAL_API_URL,
  isBareLegacyLocalApiUrl,
  requiresLocalApiUrlReview,
} = require('./config.cjs');

test('requires an explicit review before changing the historical bare localhost:3001 value', () => {
  const saved = { apiUrl: LEGACY_LOCAL_API_URL, theme: 'dark' };

  assert.equal(requiresLocalApiUrlReview(saved), true);
  assert.deepEqual(saved, { apiUrl: LEGACY_LOCAL_API_URL, theme: 'dark' });
  assert.equal(requiresLocalApiUrlReview({ ...saved, localApiUrlReviewed: true }), false);
});

test('recognizes only the old first-run URL as needing a review', () => {
  assert.equal(DEFAULT_LOCAL_API_URL, 'http://localhost:3101');

  const urls = [
    'http://localhost:3001/api',
    'http://127.0.0.1:3001',
    'http://localhost:3101',
    'https://sermons.example.com',
    'not-a-url',
  ];

  for (const apiUrl of urls) {
    assert.equal(isBareLegacyLocalApiUrl(apiUrl), false);
    assert.equal(requiresLocalApiUrlReview({ apiUrl }), false);
  }
});
