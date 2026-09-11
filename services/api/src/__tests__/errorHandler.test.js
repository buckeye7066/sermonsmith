import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Drive the REAL global error handler in buildApp(). The client-error router is
// mounted at /api, so replacing it with one throwing route puts a provider
// error through exactly the path an AI route's next(err) takes.
vi.mock('../routes/clientErrors.js', async () => {
  const { Router } = await import('express');
  const router = Router();
  router.get('/provider-no-credits', (_req, _res, next) => {
    next(Object.assign(
      new Error('429 You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.'),
      { status: 429, headers: {}, request_id: 'req_test', error: { code: 'insufficient_quota' }, code: 'insufficient_quota' },
    ));
  });
  router.get('/own-limit', (_req, _res, next) => {
    next(Object.assign(new Error('Daily AI limit reached (5). Upgrade or try again tomorrow.'), { status: 429 }));
  });
  return { default: router };
});

vi.mock('../services/errorReporter.js', () => ({ reportErrorToOwner: vi.fn() }));

const { buildApp } = await import('../index.js');
const { reportErrorToOwner } = await import('../services/errorReporter.js');

describe('global error handler', () => {
  it('never shows users the provider billing notice and still alerts the owner with the raw error', async () => {
    const res = await request(buildApp()).get('/api/provider-no-credits');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ code: 'ai_unavailable', message: expect.stringMatching(/temporarily unavailable/i) });
    expect(JSON.stringify(res.body)).not.toMatch(/credits|platform\.openai|billing/i);
    expect(reportErrorToOwner).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 503,
      error: expect.objectContaining({ message: expect.stringMatching(/no credits remaining/) }),
    }));
  });

  it('keeps the API\'s own 4xx messages unchanged', async () => {
    const res = await request(buildApp()).get('/api/own-limit');

    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/Daily AI limit reached/);
    expect(res.body.code).toBeUndefined();
  });
});
