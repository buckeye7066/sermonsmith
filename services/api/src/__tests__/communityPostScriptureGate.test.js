import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';
import { assertAiReplyExposable } from '../services/scriptureGate.js';

/**
 * AI-drafted content posted as a NEW COMMUNITY THREAD.
 *
 * The repo's stated guarantee is that every Scripture reference in AI output is
 * validated before it can be persisted, and it holds almost everywhere:
 * generation-time screening runs on every /api/ai/invoke and /stream call, the
 * entity API re-validates the gated types, and the reply route gates
 * is_ai_response replies through assertAiReplyExposable.
 *
 * ONE surface was missed. `router.post('/posts')` in routes/community.js called
 * prisma.entity.create directly with no gate call, no is_ai_response field on
 * its schema, and CommunityPost absent from SCRIPTURE_GATED_TYPES. So AI text
 * posted as a top-level thread — the MOST exposed community surface, the one
 * that starts the conversation — reached other members with only the one-time
 * generation screen behind it, which a subsequent edit defeats.
 *
 * These tests pin the gate and, just as importantly, pin what it must NOT do:
 * a human paraphrasing a verse loosely in their own words is not the defect
 * this guards against, and blocking them would be a new obstacle rather than a
 * fix.
 */

const denomination = '';

describe('the Scripture gate an AI community post must now clear', () => {
  it('accepts a real reference', () => {
    const refs = assertAiReplyExposable({
      content: 'As Romans 8:28 puts it, God works all things together for good.',
      denomination,
    });
    expect(Array.isArray(refs)).toBe(true);
  });

  it('REJECTS a chapter that does not exist', () => {
    expect(() => assertAiReplyExposable({
      content: 'See John 99:1 for the fuller picture.',
      denomination,
    })).toThrow(/could not be verified/i);
  });

  it('rejects with HTTP 422, not a 500', () => {
    try {
      assertAiReplyExposable({ content: 'Consider Revelation 23:4.', denomination });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.status).toBe(422);
      expect(err.scripture_validation).toBeDefined();
    }
  });

  it('passes content carrying no reference at all', () => {
    expect(() => assertAiReplyExposable({
      content: 'Praying for your family this week.',
      denomination,
    })).not.toThrow();
  });

  it('validates the declared scripture_reference field alongside the body', () => {
    // A post carries an explicit `scripture_reference`. The author has declared
    // that field to BE a reference, so a fabricated one there is unambiguous —
    // the route joins it to the body before validating.
    const joined = ['Some encouragement for today.', 'Obadiah 4:2'].filter(Boolean).join('\n');
    expect(() => assertAiReplyExposable({ content: joined, denomination }))
      .toThrow(/could not be verified/i);
  });

  it('accepts a valid single-chapter book reference in that field', () => {
    const joined = ['Some encouragement for today.', 'Obadiah 1:4'].filter(Boolean).join('\n');
    expect(() => assertAiReplyExposable({ content: joined, denomination })).not.toThrow();
  });
});


// ─── The route itself, driven for real ───────────────────────────────────────
//
// The first version of this file asserted the wiring by GREPPING community.js
// for `assertAiReplyExposable` before `prisma.entity.create`. That test passed
// when the gate was disabled with `if (false)` — the call site text was still
// there. A wiring test that survives its own canary is not a test. These drive
// the endpoint through supertest instead, so disabling the gate reddens them.

const SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';
const prisma = createPrismaMock();

vi.mock('../middleware/auth.js', () => ({
  prisma,
  authenticateToken: async (req, res, next) => {
    const token = req.cookies?.ss_token;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    try {
      const decoded = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
      const user = prisma._store.user.find((u) => u.id === decoded.userId);
      if (!user) return res.status(401).json({ message: 'User account not found' });
      req.userId = user.id;
      req.userRole = user.role;
      req.userPremium = !!user.premium;
      next();
    } catch {
      res.status(401).json({ message: 'Invalid token' });
    }
  },
  optionalAuth: (_req, _res, next) => next(),
  requireAdmin: (_req, _res, next) => next(),
  requireEntitlement: () => (_req, _res, next) => next(),
}));

const { default: communityRoutes } = await import('../routes/community.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/community', communityRoutes);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }));
  return app;
}

const tokenFor = (id) => jwt.sign({ userId: id }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });

describe('POST /api/community/posts — the surface that was open', () => {
  let app;
  beforeEach(() => {
    prisma._reset?.();
    prisma._store.user.push({ id: 'u-1', role: 'user', premium: true, profile: { denomination: '' } });
    app = buildApp();
  });

  const post = (body) => request(app)
    .post('/api/community/posts')
    .set('Cookie', [`ss_token=${tokenFor('u-1')}`])
    .send({ title: 'A thought', post_type: 'discussion', ...body });

  it('REFUSES an AI post whose reference cannot be verified', async () => {
    const res = await post({ content: 'As John 99:1 reminds us, hold fast.', is_ai_response: true });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/could not be verified/i);
  });

  it('refuses when the fabricated reference is in the scripture_reference FIELD', async () => {
    const res = await post({
      content: 'Encouragement for the week.',
      scripture_reference: 'Obadiah 4:2',
      is_ai_response: true,
    });
    expect(res.status).toBe(422);
  });

  it('ACCEPTS an AI post whose references verify', async () => {
    const res = await post({ content: 'Romans 8:28 has carried me this week.', is_ai_response: true });
    expect(res.status).toBe(201);
  });

  it('does NOT block a HUMAN post — that would be a new obstacle, not a fix', async () => {
    // No is_ai_response flag. A person paraphrasing loosely, or citing a book
    // this validator does not know, must still be able to speak.
    const res = await post({ content: 'As John 99:1 reminds us, hold fast.' });
    expect(res.status).toBe(201);
  });

  it('records the validated references on an accepted AI post', async () => {
    const res = await post({ content: 'Romans 8:28 is enough.', is_ai_response: true });
    expect(res.status).toBe(201);
    const stored = prisma._store.entity.find((e) => e.type === 'CommunityPost');
    expect(stored?.data?.scripture_validation).toBeDefined();
  });
});
