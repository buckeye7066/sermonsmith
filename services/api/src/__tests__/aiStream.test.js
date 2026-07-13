import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';

// /api/ai/stream — final-validator parity with /invoke.
//
// The streaming path previously audited whatever the model produced as
// `success` with no JSON check at all, and old clients kept a truncated
// partial preview as the "completed" object. These tests pin the fixed
// contract: the server checks the FINAL accumulated text against the same
// extractJson gate /invoke uses, audits the honest outcome, and (for clients
// that opt in with `stream_result: true`) appends a machine-readable result
// trailer after the streamed text.

const prisma = createPrismaMock();

vi.mock('../middleware/auth.js', () => ({
  prisma,
  AUTH_COOKIE: 'ss_token',
  cookieOptions: () => ({ httpOnly: true, secure: false, sameSite: 'lax' }),
  signToken: (id) => jwt.sign({ userId: id }, 'test-jwt-secret-that-is-at-least-32-chars-long', { algorithm: 'HS256', expiresIn: '1h' }),
  authenticateToken: async (req, res, next) => {
    const token = req.cookies?.ss_token;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    try {
      const decoded = jwt.verify(token, 'test-jwt-secret-that-is-at-least-32-chars-long', { algorithms: ['HS256'] });
      req.userId = decoded.userId;
      const u = prisma._store.user.find((x) => x.id === decoded.userId);
      req.userRole = u?.role;
      req.userPremium = !!u?.premium;
      next();
    } catch {
      return res.status(401).json({ message: 'Invalid token' });
    }
  },
  requireAdmin: (req, res, next) => next(),
  optionalAuth: (req, _res, next) => next(),
}));

vi.mock('../services/email.js', () => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
}));

// Controllable OpenAI mock. Each test sets `nextStreamChunks` to the deltas
// the fake model will stream (with the last chunk carrying finish_reason).
let nextStreamChunks = [];

function chunksToAsyncIterable(chunks) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };
}

vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {
      this.chat = {
        completions: {
          create: vi.fn(async (params) => {
            if (params.stream) return chunksToAsyncIterable(nextStreamChunks);
            throw new Error('non-streaming call not expected in this suite');
          }),
        },
      };
    }
  },
}));

const { default: aiRoutes } = await import('../routes/ai.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/ai', aiRoutes);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }));
  return app;
}

const SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';
const tokenFor = (id) => jwt.sign({ userId: id }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
const RS = String.fromCharCode(0x1e);

function textChunks(text, finishReason = 'stop') {
  const mid = Math.ceil(text.length / 2);
  return [
    { choices: [{ delta: { content: text.slice(0, mid) } }] },
    { choices: [{ delta: { content: text.slice(mid) }, finish_reason: finishReason }] },
  ];
}

function auditRows() {
  return prisma._store.aiAuditLog || [];
}

describe('/api/ai/stream — final validator parity', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.DISABLE_AI;
    app = buildApp();
    prisma._store.user.push({ id: 'u-s', email: 's@x', role: 'user', premium: false });
  });

  it('appends an ok:true trailer for valid JSON when the client opts in', async () => {
    const payload = JSON.stringify({ title: 'Grace', points: [] });
    nextStreamChunks = textChunks(payload);
    const res = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(res.status).toBe(200);
    const [text, trailer] = res.text.split(RS);
    expect(text.trimEnd()).toBe(payload);
    expect(JSON.parse(trailer)).toEqual({ ok: true, truncated: false });
    const audit = auditRows().at(-1);
    expect(audit.status).toBe('success');
  });

  it('appends an ok:false trailer and audits invalid_json when the stream ends mid-object', async () => {
    nextStreamChunks = textChunks('{"title": "Cut off", "points": [', 'length');
    const res = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(res.status).toBe(200);
    const [, trailer] = res.text.split(RS);
    expect(JSON.parse(trailer)).toEqual({ ok: false, truncated: true });
    const audit = auditRows().at(-1);
    expect(audit.status).toBe('invalid_json');
    expect(audit.failureType).toBe('truncated');
  });

  it('audits invalid_json for prose output even when the trailer flags it non-truncated', async () => {
    nextStreamChunks = textChunks('Sorry, I cannot produce JSON right now.');
    const res = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    const [, trailer] = res.text.split(RS);
    expect(JSON.parse(trailer)).toEqual({ ok: false, truncated: false });
    const audit = auditRows().at(-1);
    expect(audit.status).toBe('invalid_json');
    expect(audit.failureType).toBe('invalid_json');
  });

  it('legacy clients (no stream_result) get the raw bytes with NO trailer — but the audit is still honest', async () => {
    nextStreamChunks = textChunks('{"broken": [', 'length');
    const res = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(res.status).toBe(200);
    expect(res.text).toBe('{"broken": [');
    expect(res.text.includes(RS)).toBe(false);
    const audit = auditRows().at(-1);
    expect(audit.status).toBe('invalid_json');
  });

  it('plain-text streams (no schema) stay success and are never flagged', async () => {
    nextStreamChunks = textChunks('Here is a warm pastoral paragraph.');
    const res = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', stream_result: true });
    const [, trailer] = res.text.split(RS);
    expect(JSON.parse(trailer)).toEqual({ ok: true, truncated: false });
    expect(auditRows().at(-1).status).toBe('success');
  });
});
