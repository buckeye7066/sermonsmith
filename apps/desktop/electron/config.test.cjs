const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_LOCAL_API_URL,
  LEGACY_LOCAL_API_URL,
  migrateLegacyLocalApiUrl,
} = require('./config.cjs');

test('migrates only the historical bare localhost:3001 default', () => {
  const saved = { apiUrl: LEGACY_LOCAL_API_URL, theme: 'dark' };

  const migrated = migrateLegacyLocalApiUrl(saved);

  assert.deepEqual(migrated, { apiUrl: DEFAULT_LOCAL_API_URL, theme: 'dark' });
  assert.deepEqual(saved, { apiUrl: LEGACY_LOCAL_API_URL, theme: 'dark' });
});

test('preserves explicit or non-default API URLs', () => {
  const configs = [
    { apiUrl: 'http://localhost:3001/api' },
    { apiUrl: 'http://127.0.0.1:3001' },
    { apiUrl: 'http://localhost:3101' },
    { apiUrl: 'https://sermons.example.com' },
    { apiUrl: 'not-a-url' },
  ];

  for (const config of configs) {
    assert.strictEqual(migrateLegacyLocalApiUrl(config), config);
  }
});
