import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';

// Streaming Scripture screen (fix #4).
//
// /stream writes model tokens to the client immediately, so a streamed draft
// containing a fabricated reference ("Hezekiah 4:5") reaches the UI before any
// validation runs. The result trailer must therefore report the honest
// Scripture outcome and mark the stream NOT ok, so the client (StreamLLM)
// throws and falls back to /invoke instead of keeping the streamed preview as a
// completed, trusted result.

const prisma = createPrismaMock();

// Configurable streamed content per test.
let STREAM_TEXT = '{"ok":1}';

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

vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {
      this.chat = {
        completions: {
          create: vi.fn(async (params) => {
            if (params.stream) {
              return {
                async *[Symbol.asyncIterator]() {
                  // Emit the whole text as one delta, then a stop finish.
                  yield { choices: [{ delta: { content: STREAM_TEXT }, finish_reason: 'stop' }] };
                },
              };
            }
            return { choices: [{ message: { content: STREAM_TEXT }, finish_reason: 'stop' }] };
          }),
        },
      };
    }
  },
}));

const { default: aiRoutes, __test } = await import('../routes/ai.js');

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

function parseTrailer(body) {
  const i = body.indexOf(RS);
  if (i === -1) return null;
  return JSON.parse(body.slice(i + 1));
}

describe('/stream fabricated-Scripture screen', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.DISABLE_AI;
    STREAM_TEXT = '{"ok":1}';
    app = buildApp();
    prisma._store.user.push({ id: 'u-s', email: 's@x', role: 'user', premium: false });
  });

  it('screenStreamedScripture flags a fabricated book but passes clean text', () => {
    expect(__test.screenStreamedScripture('See John 3:16 and Romans 8:28.').ok).toBe(true);
    const bad = __test.screenStreamedScripture('As Hezekiah 4:5 reminds us...');
    expect(bad.ok).toBe(false);
    expect(bad.fabricated).toBe(1);
    // Canon-dependent states must NOT be flagged (no denomination on a stream).
    expect(__test.screenStreamedScripture('Wisdom 3:1 is a comfort.').ok).toBe(true);
  });

  it('a stream containing a fabricated reference is marked NOT ok in the trailer', async () => {
    STREAM_TEXT = 'Point 1 rests on Hezekiah 4:5, a great promise.';
    const res = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', stream_result: true });
    expect(res.status).toBe(200);
    const trailer = parseTrailer(res.text);
    expect(trailer).toBeTruthy();
    expect(trailer.ok).toBe(false);
    expect(trailer.scripture.ok).toBe(false);
    expect(trailer.scripture.fabricated).toBe(1);
  });

  it('a clean stream stays ok', async () => {
    STREAM_TEXT = 'Grace abounds — John 3:16, Ephesians 2:8.';
    const res = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', stream_result: true });
    expect(res.status).toBe(200);
    const trailer = parseTrailer(res.text);
    expect(trailer.ok).toBe(true);
    expect(trailer.scripture.ok).toBe(true);
  });

  it('the fabricated reference is recorded honestly in the audit row', async () => {
    STREAM_TEXT = 'Hezekiah 4:5 is my anchor.';
    await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', stream_result: true });
    const audit = prisma._store.aiAuditLog.at(-1);
    expect(audit.status).toBe('unverified_scripture');
    expect(audit.failureType).toBe('unverified_scripture');
  });
});
