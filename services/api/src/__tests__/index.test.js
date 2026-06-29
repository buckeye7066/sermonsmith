import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../index.js';

describe('app request ids', () => {
  it('echoes a safe incoming request id on error responses', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/missing-route')
      .set('X-Request-Id', 'req-test-12345');

    expect(res.status).toBe(404);
    expect(res.headers['x-request-id']).toBe('req-test-12345');
    expect(res.body).toMatchObject({
      message: 'Not found',
      requestId: 'req-test-12345',
    });
  });

  it('generates a request id when the client does not supply one', async () => {
    const app = buildApp();
    const res = await request(app).get('/healthz');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/i);
  });
});
