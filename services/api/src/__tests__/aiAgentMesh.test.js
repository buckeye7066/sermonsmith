import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';
import { SERVER_AI_INVARIANTS } from '@sermonsmith/shared/aiFeatures';

// Agent-mesh route wiring tests: the run-start hook (peer-note system message
// injected AFTER the server invariants, consumed exactly once, fail-open) and
// the run-end teaching hook (repeated provider-side failures record a lesson
// and message the peer agent). Mirrors the ai.test.js / aiInvariants.test.js
// harness: mocked auth/prisma, mocked OpenAI recording every params object.

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

// OpenAI mock: records params; behavior switchable per test (success JSON or a
// thrown provider error). status 408 is used for failure tests because
// callWithRetry does not retry it (keeps the tests fast) while it still counts
// as a provider-side failure for the teaching hook.
const createCalls = [];
let mockFailure = null;
vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {
      this.chat = {
        completions: {
          create: vi.fn(async (params) => {
            createCalls.push(params);
            if (mockFailure) throw mockFailure;
            if (params.stream) {
              return {
                async *[Symbol.asyncIterator]() {
                  yield { choices: [{ delta: { content: '{"ok":1}' }, finish_reason: 'stop' }] };
                },
              };
            }
            return { choices: [{ message: { content: '{"ok":1}' }, finish_reason: 'stop' }] };
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

function seedLessonFromArlynn(overrides = {}) {
  const now = new Date();
  prisma._store.agentLesson.push({
    id: `l-${Math.random().toString(36).slice(2, 8)}`,
    authorAgent: 'arlynn',
    topic: 'provider_reliability',
    claim: 'model gpt-4o failing repeatedly (http_500)',
    evidence: { model: 'gpt-4o', failureType: 'http_500', count: 3, windowHours: 24 },
    timesSeen: 3,
    confirmations: [],
    refutations: [],
    consumedBy: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe('agent mesh route wiring', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    createCalls.length = 0;
    mockFailure = null;
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.DISABLE_AI;
    app = buildApp();
    prisma._store.user.push({ id: 'u-m', email: 'm@x', role: 'user', premium: false });
  });

  it('/invoke appends the peer note AFTER invariants and client prompt, and consumption is stamped', async () => {
    seedLessonFromArlynn();
    const res = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-m')}`])
      .send({ prompt: 'p', system_prompt: 'You are Larry.', feature: 'sermon' });
    expect(res.status).toBe(200);

    const { messages } = createCalls[0];
    // Invariants stay first and undisplaceable; the client prompt keeps its slot.
    expect(messages[0]).toEqual({ role: 'system', content: SERVER_AI_INVARIANTS });
    expect(messages[1].role).toBe('system');
    expect(messages[1].content).toMatch(/^You are Larry\./);
    // The peer note is one server-composed system message before the user turn.
    expect(messages[2].role).toBe('system');
    expect(messages[2].content).toContain('Peer notes from your fellow assistant');
    expect(messages[2].content).toContain('model gpt-4o failing repeatedly (http_500)');
    expect(messages[3]).toEqual({ role: 'user', content: 'p' });

    // The visible cross-agent consumption: Larry has now learned Arlynn's lesson.
    expect(prisma._store.agentLesson[0].consumedBy.larry).toBeTruthy();
  });

  it('/invoke appends no peer note when there are no lessons or messages', async () => {
    const res = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-m')}`])
      .send({ prompt: 'p', system_prompt: 'You are Larry.', feature: 'sermon' });
    expect(res.status).toBe(200);
    const { messages } = createCalls[0];
    expect(messages).toHaveLength(3);
    expect(messages.some((m) => m.content.includes('Peer notes'))).toBe(false);
  });

  it('an agent does not receive its own lessons as peer notes', async () => {
    seedLessonFromArlynn({ authorAgent: 'larry' });
    await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-m')}`])
      .send({ prompt: 'p', feature: 'sermon' });
    const { messages } = createCalls[0];
    expect(messages.some((m) => m.content.includes('Peer notes'))).toBe(false);
  });

  it('the same lesson is consumed once: the second run gets no peer note', async () => {
    seedLessonFromArlynn();
    const send = () => request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-m')}`])
      .send({ prompt: 'p', feature: 'sermon' });
    await send();
    await send();
    expect(createCalls[0].messages.some((m) => m.content.includes('Peer notes'))).toBe(true);
    expect(createCalls[1].messages.some((m) => m.content.includes('Peer notes'))).toBe(false);
  });

  it('/stream gets the same peer note via the shared helper', async () => {
    seedLessonFromArlynn();
    const res = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-m')}`])
      .send({ prompt: 'p', system_prompt: 'You are Arlynn.', feature: 'sermon_series', stream_result: true });
    expect(res.status).toBe(200);
    const { messages } = createCalls[0];
    expect(messages[0].content).toBe(SERVER_AI_INVARIANTS);
    expect(messages[1].content).toBe('You are Arlynn.');
    // feature sermon_series → acting agent arlynn... who authored this lesson,
    // so she must NOT receive it. Re-check with a larry-authored lesson.
    expect(messages.some((m) => m.content.includes('Peer notes'))).toBe(false);

    prisma._reset();
    prisma._store.user.push({ id: 'u-m', email: 'm@x', role: 'user', premium: false });
    createCalls.length = 0;
    seedLessonFromArlynn({ authorAgent: 'larry', claim: 'model gpt-4o-mini failing repeatedly (http_429)' });
    const res2 = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-m')}`])
      .send({ prompt: 'p', system_prompt: 'You are Arlynn.', feature: 'sermon_series', stream_result: true });
    expect(res2.status).toBe(200);
    const note = createCalls[0].messages.find((m) => m.content.includes('Peer notes'));
    expect(note).toBeTruthy();
    expect(note.content).toContain('model gpt-4o-mini failing repeatedly (http_429)');
    expect(prisma._store.agentLesson[0].consumedBy.arlynn).toBeTruthy();
  });

  it('mesh failure is fail-open: the request still succeeds without peer notes', async () => {
    seedLessonFromArlynn();
    prisma.agentMessage.findMany.mockRejectedValueOnce(new Error('mesh table on fire'));
    const res = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-m')}`])
      .send({ prompt: 'p', system_prompt: 'You are Larry.', feature: 'sermon' });
    expect(res.status).toBe(200);
    const { messages } = createCalls[0];
    expect(messages.some((m) => m.content.includes('Peer notes'))).toBe(false);
    // Nothing was consumed because the compose step aborted before stamping.
    expect(prisma._store.agentLesson[0].consumedBy).toEqual({});
  });

  it('teaching hook: 3 provider-side failures record a lesson + peer message; 1 does not', async () => {
    mockFailure = Object.assign(new Error('upstream request timeout'), { status: 408 });
    const fail = () => request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-m')}`])
      .send({ prompt: 'p', feature: 'sermon' });

    const r1 = await fail();
    expect(r1.status).toBe(408);
    // Fire-and-forget hook: give it a tick, then assert it did NOT teach.
    await new Promise((r) => setTimeout(r, 25));
    expect(prisma._store.agentLesson).toHaveLength(0);
    expect(prisma._store.agentMessage).toHaveLength(0);

    await fail();
    await fail();
    await vi.waitFor(() => {
      expect(prisma._store.agentLesson).toHaveLength(1);
    });
    const [lesson] = prisma._store.agentLesson;
    expect(lesson.authorAgent).toBe('larry'); // feature 'sermon' → persona larry
    expect(lesson.topic).toBe('provider_reliability');
    expect(lesson.claim).toBe('model gpt-4o-mini failing repeatedly (http_408)');
    const [msg] = prisma._store.agentMessage;
    expect(msg.toAgent).toBe('arlynn');
    expect(msg.kind).toBe('lesson');

    // Close the loop: Arlynn's next series call receives the note.
    mockFailure = null;
    createCalls.length = 0;
    const ok = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-m')}`])
      .send({ prompt: 'p', feature: 'sermon_series' });
    expect(ok.status).toBe(200);
    const note = createCalls[0].messages.find((m) => m.content.includes('Peer notes'));
    expect(note).toBeTruthy();
    expect(note.content).toContain('model gpt-4o-mini failing repeatedly (http_408)');
    expect(prisma._store.agentLesson[0].consumedBy.arlynn).toBeTruthy();
  });

  it('audit summary includes a bounded agentMesh section', async () => {
    seedLessonFromArlynn({ consumedBy: { larry: new Date().toISOString() } });
    prisma._store.agentMessage.push({
      id: 'm-1', fromAgent: 'arlynn', toAgent: 'larry', kind: 'lesson',
      body: 'operational', readBy: {}, createdAt: new Date(),
    });
    const res = await request(app)
      .get('/api/ai/audit/summary')
      .set('Cookie', [`ss_token=${tokenFor('u-m')}`]);
    expect(res.status).toBe(200);
    expect(res.body.agentMesh).toEqual({
      messagesLast7d: 1,
      lessons: [{
        author: 'arlynn',
        topic: 'provider_reliability',
        claim: 'model gpt-4o failing repeatedly (http_500)',
        timesSeen: 3,
        consumedBy: expect.objectContaining({ larry: expect.any(String) }),
      }],
      lessonsConsumedCount: 1,
    });
    // Privacy: the section carries no hashes, prompts, or user content fields.
    expect(JSON.stringify(res.body.agentMesh)).not.toMatch(/promptHash|responseHash/);
  });
});
