import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';

// Extended server-side Scripture / trust-state gate tests.
//
// The durable Scripture gate historically covered only the `Sermon` entity
// type. AI-generated Bible studies, quizzes, reading plans, ethics analyses,
// and study notes also carry Scripture references but were persisted with
// whatever `scripture_validation` (or forged trust fields) the client sent.
// These tests pin the extension: every one of those types now gets a
// server-recomputed, canon-aware `scripture_validation`, ignores a forged
// client blob, and cannot self-certify via review-only fields — using the
// shape-agnostic deep validator so type-specific and nested shapes are all
// swept.

const prisma = createPrismaMock();

vi.mock('../middleware/auth.js', () => ({
  prisma,
  AUTH_COOKIE: 'ss_token',
  cookieOptions: () => ({ httpOnly: true, secure: false, sameSite: 'lax' }),
  signToken: (id) => jwt.sign({ userId: id }, 'test-jwt-secret-that-is-at-least-32-chars-long', { algorithm: 'HS256', expiresIn: '1h' }),
  authenticateToken: async (req, res, next) => {
    const token = req.cookies?.ss_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    try {
      const decoded = jwt.verify(token, 'test-jwt-secret-that-is-at-least-32-chars-long', { algorithms: ['HS256'] });
      req.userId = decoded.userId;
      const user = prisma._store.user.find((u) => u.id === decoded.userId);
      if (!user) return res.status(401).json({ message: 'User account not found' });
      req.userRole = user.role;
      req.userPremium = !!user.premium;
      next();
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  },
  requireAdmin: (req, res, next) => {
    if (req.userRole !== 'admin' && req.userRole !== 'dev') return res.status(403).json({ message: 'Admin access required' });
    next();
  },
  optionalAuth: (req, _res, next) => next(),
  requirePremium: (req, res, next) => {
    if (!req.userPremium && req.userRole !== 'admin' && req.userRole !== 'dev') return res.status(402).json({ message: 'Premium subscription required' });
    next();
  },
}));

const { default: entityRoutes } = await import('../routes/entities.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/entities', entityRoutes);
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return app;
}

const SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';
const tokenFor = (userId) => jwt.sign({ userId }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
const asUser = (id) => [`ss_token=${tokenFor(id)}`];

const post = (app, type, userId, body) =>
  request(app).post(`/api/entities/${type}`).set('Cookie', asUser(userId)).send(body);

describe('entities — Scripture gate extended to all persisted AI types', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    app = buildApp();
    prisma._store.user.push({ id: 'u-pastor', email: 'p@x', role: 'user', premium: false, profile: {} });
    prisma._store.user.push({
      id: 'u-catholic', email: 'rc@x', role: 'user', premium: false,
      profile: { denomination: 'Roman Catholic' },
    });
  });

  // --- BibleStudy ---
  it('BibleStudy: recomputes validation over sections/key_verses, ignoring a forged blob', async () => {
    const res = await post(app, 'BibleStudy', 'u-pastor', {
      title: 'Grace study',
      overview: 'A study rooted in Ephesians 2:8.',
      key_verses: ['Romans 8:28', 'Hezekiah 4:5'], // second is a fabricated book
      study_sections: [
        { title: 'S1', scripture: 'John 3:16', insights: 'x', questions: [], application: 'y' },
      ],
      // Forged: claims everything is valid.
      scripture_validation: [{ ref: 'Hezekiah 4:5', status: 'valid' }],
    });
    expect(res.status).toBe(200);
    const stored = res.body.scripture_validation;
    // Server swept 4 real refs (Ephesians 2:8, Romans 8:28, Hezekiah 4:5, John 3:16).
    const byStatus = stored.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
    expect(byStatus.invalid_book).toBe(1);
    expect(byStatus.valid).toBe(3);
    // Forged single-entry blob was discarded.
    expect(stored.length).toBe(4);
  });

  it('BibleStudy: Catholic deuterocanon is chapter_checked (not invalid) for a Catholic user', async () => {
    const res = await post(app, 'BibleStudy', 'u-catholic', {
      title: 'Funeral study',
      key_verses: ['Wisdom 3:1'],
    });
    expect(res.status).toBe(200);
    expect(res.body.scripture_validation[0].status).toBe('chapter_checked');
  });

  // --- Quiz ---
  it('Quiz: revalidates per-question scripture_reference server-side', async () => {
    const res = await post(app, 'Quiz', 'u-pastor', {
      title: 'Gospel quiz',
      questions: [
        { question: 'q1', options: ['a'], correct_answer: 'a', explanation: 'See John 3:16', scripture_reference: 'John 3:16' },
        { question: 'q2', options: ['b'], correct_answer: 'b', explanation: '', scripture_reference: 'Hezekiah 9:9' },
      ],
    });
    expect(res.status).toBe(200);
    const statuses = res.body.scripture_validation.map((r) => r.status).sort();
    expect(statuses).toContain('invalid_book');
    expect(statuses).toContain('valid');
  });

  // --- ReadingPlan ---
  it('ReadingPlan: sweeps daily_readings[].passages arrays', async () => {
    const res = await post(app, 'ReadingPlan', 'u-pastor', {
      name: 'Advent plan',
      daily_readings: [
        { day: 1, passages: ['Luke 2:1-20', 'Isaiah 9:6'], reflection: 'Hope.' },
        { day: 2, passages: ['Matthew 99:1'], reflection: '' },
      ],
    });
    expect(res.status).toBe(200);
    const byStatus = res.body.scripture_validation.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
    expect(byStatus.valid).toBe(2);
    expect(byStatus.out_of_range).toBe(1); // Matthew has only 28 chapters
  });

  // --- EthicsAnalysis (double-nested under data.result) ---
  it('EthicsAnalysis: extracts references from the double-nested data.result shape', async () => {
    const res = await post(app, 'EthicsAnalysis', 'u-pastor', {
      title: 'On honesty',
      data: {
        question: 'Is lying ever right?',
        mode: 'single',
        result: {
          definition: 'Honesty as covenant faithfulness.',
          biblical_foundation: {
            key_scriptures: [
              { reference: 'Ephesians 4:25', text: 'put away falsehood', application: 'speak truth' },
              { reference: 'Deuteronomy 99:1', text: '', application: '' },
            ],
          },
        },
        denominations: ['baptist'],
      },
    });
    expect(res.status).toBe(200);
    const statuses = res.body.scripture_validation.map((r) => r.status).sort();
    // Reached into data.result.biblical_foundation.key_scriptures[].reference.
    expect(statuses).toContain('valid'); // Ephesians 4:25
    expect(statuses).toContain('out_of_range'); // Deuteronomy has 34 chapters
  });

  // --- StudyNote ---
  it('StudyNote: strips review-only trust fields a client/AI tries to forge', async () => {
    const res = await post(app, 'StudyNote', 'u-pastor', {
      title: 'Note',
      content: 'A reflection on John 3:16.',
      scripture_reference: 'John 3:16',
      pastor_reviewed: true,
      verified: true,
      ready_to_present: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.pastor_reviewed).toBeUndefined();
    expect(res.body.verified).toBeUndefined();
    expect(res.body.ready_to_present).toBeUndefined();
    expect(res.body.scripture_validation[0].status).toBe('valid');
  });

  // --- publish gate on a non-sermon gated type ---
  it('a gated non-sermon type cannot be published with unverified references (422)', async () => {
    const res = await post(app, 'BibleStudy', 'u-pastor', {
      title: 'Bad publish',
      key_verses: ['Hezekiah 4:5'],
      status: 'published',
    });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/Cannot publish/);
  });

  it('a gated non-sermon type is NOT force-relabeled needs_review (no invented status)', async () => {
    const res = await post(app, 'Quiz', 'u-pastor', {
      title: 'Draftless quiz',
      questions: [{ question: 'q', options: ['a'], correct_answer: 'a', scripture_reference: 'Hezekiah 4:5' }],
    });
    expect(res.status).toBe(200);
    // Honest validation stored, but no fabricated status the Quiz UI can't render.
    expect(res.body.status).toBeUndefined();
    expect(res.body.scripture_validation[0].status).toBe('invalid_book');
  });

  // --- review acknowledgment stays Sermon-only (item 4 preserved) ---
  it('review acknowledgment is rejected for newly-gated non-sermon types', async () => {
    const created = await post(app, 'BibleStudy', 'u-pastor', { title: 'S', key_verses: ['John 3:16'] });
    const res = await request(app)
      .post(`/api/entities/BibleStudy/${created.body.id}/review`)
      .set('Cookie', asUser('u-pastor'))
      .send({ acknowledged: true });
    expect(res.status).toBe(400);
  });

  // --- update path revalidates a newly-gated type ---
  it('updating a BibleStudy revalidates the merged record and drops stale validation', async () => {
    const created = await post(app, 'BibleStudy', 'u-pastor', { title: 'Clean', key_verses: ['John 3:16'] });
    expect(created.body.scripture_validation.every((r) => r.status === 'valid')).toBe(true);

    const updated = await request(app)
      .put(`/api/entities/BibleStudy/${created.body.id}`)
      .set('Cookie', asUser('u-pastor'))
      .send({ overview: 'Now referencing Hezekiah 4:5.' });
    expect(updated.status).toBe(200);
    const statuses = updated.body.scripture_validation.map((r) => r.status).sort();
    // Exactly the two current refs — no stale duplication from the prior blob.
    expect(statuses).toEqual(['invalid_book', 'valid']);
  });

  // --- Bypass #1: public/share transition must be gated, not just `published` ---
  it('a public ReadingPlan with an invalid reference is rejected (is_public transition)', async () => {
    const res = await post(app, 'ReadingPlan', 'u-pastor', {
      name: 'Public plan',
      is_public: true,
      daily_readings: [{ day: 1, passages: ['Hezekiah 4:5'], reflection: '' }],
    });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/Cannot publish or share/);
  });

  it('turning an existing ReadingPlan public via update is also gated', async () => {
    const created = await post(app, 'ReadingPlan', 'u-pastor', {
      name: 'Private plan',
      daily_readings: [{ day: 1, passages: ['Ezekiel 4:5'], reflection: '' }], // Ezekiel = fabricated? no — valid book, ch4 exists
    });
    expect(created.status).toBe(200);
    // Introduce an invalid ref AND flip public in one update.
    const updated = await request(app)
      .put(`/api/entities/ReadingPlan/${created.body.id}`)
      .set('Cookie', asUser('u-pastor'))
      .send({ is_public: true, daily_readings: [{ day: 1, passages: ['Hezekiah 4:5'], reflection: '' }] });
    expect(updated.status).toBe(422);
  });

  it('a private ReadingPlan with an invalid reference still saves (only public is blocked)', async () => {
    const res = await post(app, 'ReadingPlan', 'u-pastor', {
      name: 'Private draft',
      daily_readings: [{ day: 1, passages: ['Hezekiah 4:5'], reflection: '' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.scripture_validation[0].status).toBe('invalid_book');
  });

  it('visibility:public also triggers the share gate', async () => {
    const res = await post(app, 'StudyNote', 'u-pastor', {
      title: 'Note',
      content: 'A note about Hezekiah 4:5.',
      visibility: 'public',
    });
    expect(res.status).toBe(422);
  });

  // --- Bypass #2: update via type/id mismatch must be rejected ---
  it('PUT to a gated row through a WRONG (non-gated) type path is rejected', async () => {
    const study = await post(app, 'BibleStudy', 'u-pastor', { title: 'Real study', key_verses: ['John 3:16'] });
    expect(study.status).toBe(200);
    // Attempt to smuggle invalid Scripture + published in via the permissive
    // Collection schema, addressing the BibleStudy row by id.
    const attack = await request(app)
      .put(`/api/entities/Collection/${study.body.id}`)
      .set('Cookie', asUser('u-pastor'))
      .send({ overview: 'Now citing Hezekiah 4:5.', status: 'published' });
    expect(attack.status).toBe(404);
    // The row is untouched: still valid, still no forged published status.
    const after = await request(app)
      .get(`/api/entities/BibleStudy/${study.body.id}`)
      .set('Cookie', asUser('u-pastor'));
    expect(after.body.status).not.toBe('published');
    expect(after.body.scripture_validation.every((r) => r.status === 'valid')).toBe(true);
  });

  it('PUT with the correct stored type still gates using that stored type', async () => {
    const study = await post(app, 'BibleStudy', 'u-pastor', { title: 'S', key_verses: ['John 3:16'] });
    const res = await request(app)
      .put(`/api/entities/BibleStudy/${study.body.id}`)
      .set('Cookie', asUser('u-pastor'))
      .send({ is_public: true, overview: 'See Hezekiah 4:5.' });
    expect(res.status).toBe(422); // gated as BibleStudy (stored type), public+invalid
  });

  // --- Round-3 B2: SharedContent public-share must be gated + trust-stripped ---
  it('public SharedContent with an invalid reference and forged verified:true is rejected', async () => {
    const res = await post(app, 'SharedContent', 'u-pastor', {
      title: 'Public study',
      content: 'A study leaning on Hezekiah 4:5 for hope.',
      content_type: 'study',
      visibility: 'public',
      verified: true,
    });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/Cannot publish or share/);
  });

  it('private SharedContent recomputes validation and strips forged verified:true', async () => {
    const res = await post(app, 'SharedContent', 'u-pastor', {
      title: 'Private study',
      content: 'A study leaning on Hezekiah 4:5 for hope.',
      content_type: 'study',
      visibility: 'private',
      verified: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.verified).toBeFalsy();
    expect(res.body.scripture_validation.some((r) => r.status === 'invalid_book')).toBe(true);
  });

  it('public SharedContent with only valid references is allowed', async () => {
    const res = await post(app, 'SharedContent', 'u-pastor', {
      title: 'Clean public study',
      content: 'Grounded in John 3:16 and Ephesians 2:8.',
      content_type: 'study',
      visibility: 'public',
    });
    expect(res.status).toBe(200);
    expect(res.body.scripture_validation.every((r) => r.status === 'valid')).toBe(true);
  });

  // --- Round-5: SharedSermon is an inherently-public gated copy ---
  it('SharedSermon with an invalid reference is blocked even without a visibility flag', async () => {
    const res = await post(app, 'SharedSermon', 'u-pastor', {
      title: 'Shared bad',
      anchor_passage: 'Hezekiah 4:5',
      points: [{ supporting_scriptures: ['John 3:16'] }],
    });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/Cannot publish or share/);
  });

  it('SharedSermon with only valid references is allowed', async () => {
    const res = await post(app, 'SharedSermon', 'u-pastor', {
      title: 'Shared good',
      anchor_passage: 'Ephesians 2:8',
      points: [{ supporting_scriptures: ['Romans 8:28-30'] }],
    });
    expect(res.status).toBe(200);
    expect(res.body.scripture_validation.every((r) => r.status === 'valid')).toBe(true);
  });

  it('SharedSermon strips forged trust fields', async () => {
    const res = await post(app, 'SharedSermon', 'u-pastor', {
      title: 'Shared', anchor_passage: 'John 3:16', verified: true, pastor_reviewed: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.verified).toBeFalsy();
    expect(res.body.pastor_reviewed).toBeFalsy();
  });

  // --- Bypass #3: stale trust markers must be neutralized on revalidation ---
  it('a stale verified:true is stripped when a gated row is updated to an invalid state', async () => {
    // Seed a row that already carries forged trust markers (legacy/migrated).
    const created = await post(app, 'BibleStudy', 'u-pastor', { title: 'Legacy', key_verses: ['John 3:16'] });
    prisma._store.entity.find((e) => e.id === created.body.id).data.verified = true;
    prisma._store.entity.find((e) => e.id === created.body.id).data.ready_to_present = true;

    const updated = await request(app)
      .put(`/api/entities/BibleStudy/${created.body.id}`)
      .set('Cookie', asUser('u-pastor'))
      .send({ overview: 'Now referencing Hezekiah 4:5.' });
    expect(updated.status).toBe(200);
    // Trust markers neutralized even though the update did not mention them.
    expect(updated.body.verified).toBeFalsy();
    expect(updated.body.ready_to_present).toBeFalsy();
    expect(updated.body.scripture_validation.some((r) => r.status === 'invalid_book')).toBe(true);
  });
});
