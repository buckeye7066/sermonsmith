import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadinessClient } from './index.js';

test('shared readiness client owns endpoint construction and request policy', async () => {
  const calls = [];
  const client = createReadinessClient({
    baseUrl: 'https://api.example.test/some/path',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'ready', releaseSha: 'a'.repeat(40) }),
      };
    },
  });

  const body = await client.getReadiness();
  assert.equal(body.releaseSha, 'a'.repeat(40));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.example.test/readyz');
  assert.equal(calls[0].options.method, 'GET');
  assert.deepEqual(calls[0].options.headers, { Accept: 'application/json' });
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test('shared readiness client rejects HTTP failures and malformed payloads', async () => {
  const unavailable = createReadinessClient({
    baseUrl: 'https://api.example.test',
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  });
  await assert.rejects(unavailable.getReadiness(), /HTTP 503/);

  const malformed = createReadinessClient({
    baseUrl: 'https://api.example.test',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => [] }),
  });
  await assert.rejects(malformed.getReadiness(), /invalid JSON object/);
});

test('shared readiness client requires HTTPS outside localhost', () => {
  assert.throws(
    () => createReadinessClient({ baseUrl: 'http://api.example.test', fetchImpl: async () => ({}) }),
    /must use HTTPS/,
  );
  assert.doesNotThrow(
    () => createReadinessClient({ baseUrl: 'http://localhost:3001', fetchImpl: async () => ({}) }),
  );
});
