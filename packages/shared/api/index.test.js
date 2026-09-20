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


test('owner worker requests use the existing shared client and preserve escaped maximum-size jobs', async () => {
  const module = await import('./index.js');
  assert.equal(typeof module.createOwnerWorkerClient, 'function');
  const prompt = '\u0001'.repeat(131072);
  const response = { job: { prompt, system: '', id: 'fixture', lease: 'fixture' } };
  let observed;
  const client = module.createOwnerWorkerClient({ baseUrl: 'https://backend.example', token: 'x'.repeat(48), fetchImpl: async (url, options) => { observed = { url, options }; return Response.json(response); } });
  assert.deepEqual(await client.post('poll', { providers: { codex: 'ready' } }), response);
  assert.equal(observed.url, 'https://backend.example/api/owner-ai/worker/poll');
  assert.equal(observed.options.redirect, 'error');
  assert.equal(observed.options.credentials, 'omit');
  assert.equal(observed.options.method, 'POST');
});

test('owner worker transport rejects unsafe routes, non-HTTPS origins and excessive response bytes', async () => {
  const { createOwnerWorkerClient } = await import('./index.js');
  assert.equal(typeof createOwnerWorkerClient, 'function');
  assert.throws(() => createOwnerWorkerClient({ baseUrl: 'http://backend.example', token: 'x'.repeat(48) }));
  let requests = 0;
  const client = createOwnerWorkerClient({ baseUrl: 'https://backend.example', token: 'x'.repeat(48), fetchImpl: async () => { requests++; return new Response('x'.repeat(1048577)); } });
  await assert.rejects(client.post('../private', {}), /invalid/i);
  assert.equal(requests, 0);
  await assert.rejects(client.post('poll', {}), /unavailable/i);
  assert.equal(requests, 1);
});

test('owner worker failures preserve only the HTTP status, never private response or credentials', async () => {
  const { createOwnerWorkerClient } = await import('./index.js');
  assert.equal(typeof createOwnerWorkerClient, 'function');
  const client = createOwnerWorkerClient({ baseUrl: 'https://backend.example', token: 'x'.repeat(48), fetchImpl: async () => new Response('private credential error', { status: 403 }) });
  await assert.rejects(client.post('result', {}), error => error.status === 403 && !error.message.includes('private') && !error.message.includes('x'.repeat(48)));
});

test('AI provenance is explicit validated metadata, never inferred from generated content', async () => {
  const { readAiResponseMetadata, AI_RESPONSE_HEADERS } = await import('./index.js');
  assert.equal(typeof readAiResponseMetadata, 'function');
  const headers = new Headers({ 'X-AI-Billing-Mode': 'subscription', 'X-AI-Provider': 'subscription:codex', 'X-AI-Model': 'gpt-6-astra' });
  assert.deepEqual(readAiResponseMetadata(headers), { billing_mode: 'subscription', provider: 'subscription:codex', model: 'gpt-6-astra' });
  assert.equal(readAiResponseMetadata(new Headers()), null);
  headers.set('X-AI-Provider', 'paid-api'); assert.equal(readAiResponseMetadata(headers), null);
  assert.deepEqual(AI_RESPONSE_HEADERS, ['X-AI-Billing-Mode', 'X-AI-Provider', 'X-AI-Model']);
});
