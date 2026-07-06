import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// The route resolves identity itself (best-effort, never 401s), so we only
// need the prisma user lookup and the cookie name from the auth middleware.
const users = [];
vi.mock('../middleware/auth.js', () => ({
  prisma: {
    user: {
      findUnique: async ({ where }) => users.find((u) => u.id === where.id) || null,
    },
  },
  AUTH_COOKIE: 'ss_token',
}));

const reportErrorToOwner = vi.fn();
vi.mock('../services/errorReporter.js', () => ({
  reportErrorToOwner: (...args) => reportErrorToOwner(...args),
}));

const { default: clientErrorRoutes } = await import('../routes/clientErrors.js');
const { classifyExternalError } = await import('../services/externalErrorClassifier.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', clientErrorRoutes);
  return app;
}

// env-setup.js guarantees JWT_SECRET is set; sign with the same secret the
// route verifies against.
function tokenFor(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

const OUTLOOK_SCANNER_MESSAGE = 'Object Not Found Matching Id:4, MethodName:update, ParamCount:4';

describe('externalErrorClassifier', () => {
  it('classifies the Outlook SafeLinks scanner signature and extracts the claimed target', () => {
    const result = classifyExternalError(OUTLOOK_SCANNER_MESSAGE);
    expect(result).toEqual({
      classification: 'external-scanner',
      detail: { objectId: '4', methodName: 'update', paramCount: '4' },
    });
  });

  it('classifies other id/method variants of the same signature', () => {
    expect(classifyExternalError('Object Not Found Matching Id:2, MethodName:simulateEvent, ParamCount:1'))
      .toMatchObject({ classification: 'external-scanner' });
  });

  it('does not classify ordinary app errors', () => {
    expect(classifyExternalError("Cannot read properties of undefined (reading 'id')")).toBeNull();
    expect(classifyExternalError('Not found')).toBeNull();
    expect(classifyExternalError('')).toBeNull();
    expect(classifyExternalError(undefined)).toBeNull();
  });

  it('does not classify a message that merely mentions the phrase mid-string', () => {
    expect(classifyExternalError('user saw: Object Not Found Matching Id:4, MethodName:update, ParamCount:4')).toBeNull();
  });
});

describe('POST /api/report-client-error', () => {
  let app;
  beforeEach(() => {
    reportErrorToOwner.mockClear();
    users.length = 0;
    app = buildApp();
  });

  it('logs (does not email) the Outlook scanner error from /Login', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const res = await request(app)
        .post('/api/report-client-error')
        .send({ message: OUTLOOK_SCANNER_MESSAGE, route: '/Login' });

      expect(res.status).toBe(204);
      expect(reportErrorToOwner).not.toHaveBeenCalled();

      // The audit-trail log line carries the diagnostics the owner would
      // otherwise have gotten by email.
      expect(warn).toHaveBeenCalledTimes(1);
      const logged = JSON.parse(warn.mock.calls[0][1]);
      expect(logged).toMatchObject({
        disposition: 'logged-not-emailed',
        classification: 'external-scanner',
        claimedMissingObject: { objectId: '4', methodName: 'update', paramCount: '4' },
        route: '/Login',
        authState: 'anonymous',
      });
    } finally {
      warn.mockRestore();
    }
  });

  it('honors a client-sent external-scanner classification even when the message regex does not match', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const res = await request(app)
        .post('/api/report-client-error')
        .send({ message: 'some future scanner signature', route: '/Login', classification: 'external-scanner' });

      expect(res.status).toBe(204);
      expect(reportErrorToOwner).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('still forwards genuine client errors to the owner reporter', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const res = await request(app)
        .post('/api/report-client-error')
        .send({
          message: "Cannot read properties of undefined (reading 'title')",
          name: 'TypeError',
          stack: 'TypeError: Cannot read properties of undefined\n    at Login.jsx:42',
          route: '/Login',
        });

      expect(res.status).toBe(204);
      expect(reportErrorToOwner).toHaveBeenCalledTimes(1);
      const call = reportErrorToOwner.mock.calls[0][0];
      expect(call.source).toBe('frontend');
      expect(call.route).toBe('/Login');
      expect(call.userEmail).toBeNull();
      expect(call.error.name).toBe('TypeError');
      // No fabricated HTTP status: a client crash is not a 500.
      expect(call.statusCode).toBeUndefined();
    } finally {
      info.mockRestore();
    }
  });

  it('passes through an explicitly observed status code', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await request(app)
        .post('/api/report-client-error')
        .send({ message: 'Request failed', statusCode: 502, route: '/Home' });
      expect(reportErrorToOwner.mock.calls[0][0].statusCode).toBe(502);
    } finally {
      info.mockRestore();
    }
  });

  it('resolves the authenticated user email from the auth cookie', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      users.push({ id: 'u-1', email: 'user@example.com' });
      await request(app)
        .post('/api/report-client-error')
        .set('Cookie', [`ss_token=${tokenFor('u-1')}`])
        .send({ message: 'Boom', route: '/Settings' });
      expect(reportErrorToOwner.mock.calls[0][0].userEmail).toBe('user@example.com');
    } finally {
      info.mockRestore();
    }
  });

  it('quietly drops a garbage payload without reporting', async () => {
    const res = await request(app).post('/api/report-client-error').send({ nope: true });
    expect(res.status).toBe(204);
    expect(reportErrorToOwner).not.toHaveBeenCalled();
  });

  it('flags synthetic stacks so the throw site is not misattributed to our bundle', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await request(app)
        .post('/api/report-client-error')
        .send({ message: 'Weird non-Error rejection', route: '/Login', syntheticStack: true });
      expect(reportErrorToOwner.mock.calls[0][0].extra).toMatchObject({ syntheticStack: true });
    } finally {
      info.mockRestore();
    }
  });
});
