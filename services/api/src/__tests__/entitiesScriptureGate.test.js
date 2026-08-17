import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';
import { PASTORAL_REVIEW_ITEM_IDS } from '@sermonsmith/shared/review';

// Server-side Scripture / quality-state gate tests.
//
// The durable entity write is the one choke point every save path crosses,
// so trust state (scripture_validation, status, review-only fields) must be
// computed server-side there — a client-supplied validation blob or a
// premature `published` status must never be stored as authoritative.

const prisma = createPrismaMock();
const completedReview = () => ({
  acknowledged: true,
  checklist: [...PASTORAL_REVIEW_ITEM_IDS],
});

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

describe('entities — server-side Scripture / quality-state gate (Sermon)', () => {
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

  it('recomputes scripture_validation server-side, ignoring a forged all-valid blob', async () => {
    const res = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('u-pastor'))
      .send({
        title: 'Forged',
        anchor_passage: 'Hezekiah 4:5',
        points: [],
        // Forged: claims the fake book is valid.
        scripture_validation: [{ ref: 'Hezekiah 4:5', status: 'valid' }],
        status: 'draft',
      });
    expect(res.status).toBe(200);
    const stored = res.body.scripture_validation;
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe('invalid_book');
    // And the record cannot masquerade as a clean draft.
    expect(res.body.status).toBe('needs_review');
  });

  it('accepts a clean sermon as draft with server-computed validation', async () => {
    const res = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('u-pastor'))
      .send({
        title: 'Grace',
        anchor_passage: 'Ephesians 2:1-10',
        points: [{ supporting_scriptures: ['Romans 8:28-30'], text: '' }],
        status: 'draft',
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body.scripture_validation.every((r) => r.status === 'valid')).toBe(true);
  });

  it('range end-points are enforced at the save gate', async () => {
    const res = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('u-pastor'))
      .send({ title: 'Overrun', anchor_passage: 'John 3:16-999', status: 'draft' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('needs_review');
    expect(res.body.scripture_validation[0].status).toBe('out_of_range');
  });

  it('rejects publishing a sermon whose references do not verify (422)', async () => {
    const res = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('u-pastor'))
      .send({ title: 'Bad publish', anchor_passage: 'John 99:1', status: 'published' });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/Cannot publish/);
  });

  it('allows publishing when every reference verifies', async () => {
    const res = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('u-pastor'))
      .send({ title: 'Good publish', anchor_passage: 'John 3:16', status: 'published' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
  });

  it('strips review-only trust fields the AI or a client tries to set', async () => {
    const res = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('u-pastor'))
      .send({
        title: 'Self-certified',
        anchor_passage: 'John 3:16',
        pastor_reviewed: true,
        ready_to_present: true,
        reviewed_by: 'Larry',
        verified: true,
        status: 'draft',
      });
    expect(res.status).toBe(200);
    expect(res.body.pastor_reviewed).toBeUndefined();
    expect(res.body.ready_to_present).toBeUndefined();
    expect(res.body.reviewed_by).toBeUndefined();
    expect(res.body.verified).toBeUndefined();
  });

  it("validates against the user's canon: Catholic deuterocanon is chapter_checked, not invalid", async () => {
    const res = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('u-catholic'))
      .send({ title: 'Funeral homily', anchor_passage: 'Wisdom 3:1-9', status: 'draft' });
    expect(res.status).toBe(200);
    // Real Scripture in this canon, chapter verified, verse level pending a
    // text source — honest review state, not a fabrication accusation.
    expect(res.body.scripture_validation[0].status).toBe('chapter_checked');
    expect(res.body.status).toBe('needs_review');
  });

  it('a payload denomination overrides the profile denomination for canon resolution', async () => {
    const res = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('u-pastor'))
      .send({
        title: 'Catholic sermon from a fresh account',
        denomination: 'Roman Catholic',
        anchor_passage: 'Wisdom 3:1-9',
        status: 'draft',
      });
    expect(res.status).toBe(200);
    expect(res.body.scripture_validation[0].status).toBe('chapter_checked');
  });

  it('protestant users citing deuterocanon get unsupported_canon (never invalid_book)', async () => {
    const res = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('u-pastor'))
      .send({ title: 'Wisdom quote', anchor_passage: 'Wisdom 3:1', status: 'draft' });
    expect(res.status).toBe(200);
    expect(res.body.scripture_validation[0].status).toBe('unsupported_canon');
    expect(res.body.status).toBe('needs_review');
  });

  it('update revalidates the merged record and downgrades a corrupted draft', async () => {
    const created = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('u-pastor'))
      .send({ title: 'Starts clean', anchor_passage: 'John 3:16', status: 'draft' });
    expect(created.body.status).toBe('draft');

    const updated = await request(app)
      .put(`/api/entities/Sermon/${created.body.id}`)
      .set('Cookie', asUser('u-pastor'))
      .send({ conclusion: 'And as Hezekiah 4:5 reminds us...' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('needs_review');
    const statuses = updated.body.scripture_validation.map((r) => r.status).sort();
    expect(statuses).toEqual(['invalid_book', 'valid']);
  });

  it('update cannot push a published record into an unverified state (422)', async () => {
    const created = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('u-pastor'))
      .send({ title: 'Published clean', anchor_passage: 'John 3:16', status: 'published' });
    expect(created.body.status).toBe('published');

    const updated = await request(app)
      .put(`/api/entities/Sermon/${created.body.id}`)
      .set('Cookie', asUser('u-pastor'))
      .send({ conclusion: 'Also see John 99:1.' });
    expect(updated.status).toBe(422);
  });

  it('archiving stays possible even with unverified references', async () => {
    const created = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('u-pastor'))
      .send({ title: 'Old broken sermon', anchor_passage: 'John 99:1', status: 'draft' });
    const res = await request(app)
      .put(`/api/entities/Sermon/${created.body.id}`)
      .set('Cookie', asUser('u-pastor'))
      .send({ status: 'archived' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('archived');
  });

  it('bulk create applies the gate to every item', async () => {
    const res = await request(app)
      .post('/api/entities/Sermon/bulk')
      .set('Cookie', asUser('u-pastor'))
      .send({
        items: [
          { title: 'Week 1', anchor_passage: 'Acts 2:1-21', status: 'draft' },
          { title: 'Week 2', anchor_passage: 'Acts 99:1', status: 'draft', pastor_reviewed: true },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('draft');
    expect(res.body[1].status).toBe('needs_review');
    expect(res.body[1].pastor_reviewed).toBeUndefined();
  });

  it('non-gated types are untouched by the gate', async () => {
    const res = await request(app)
      .post('/api/entities/Note')
      .set('Cookie', asUser('u-pastor'))
      .send({ content: 'My note about John 99:1', verse_id: 'john-3-16' });
    expect(res.status).toBe(200);
    expect(res.body.scripture_validation).toBeUndefined();
  });

  // --- Review acknowledgment (human-only trust transition) ---

  async function createSermon(userId, body) {
    const res = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser(userId))
      .send(body);
    expect(res.status).toBe(200);
    return res.body;
  }

  it('review acknowledgment: owner marks a sermon reviewed; validation evidence is refreshed', async () => {
    const sermon = await createSermon('u-pastor', { title: 'Reviewed', anchor_passage: 'John 3:16', status: 'draft' });
    const res = await request(app)
      .post(`/api/entities/Sermon/${sermon.id}/review`)
      .set('Cookie', asUser('u-pastor'))
      .send(completedReview());
    expect(res.status).toBe(200);
    expect(res.body.pastor_reviewed).toBe(true);
    expect(res.body.reviewed_by).toBe('u-pastor');
    expect(res.body.reviewed_at).toBeTruthy();
    expect(res.body.review_checklist).toEqual(PASTORAL_REVIEW_ITEM_IDS);
    expect(res.body.review_checklist_version).toBe(1);
    expect(res.body.scripture_validation[0].status).toBe('valid');
  });

  it('review acknowledgment requires an explicit boolean', async () => {
    const sermon = await createSermon('u-pastor', { title: 'X', anchor_passage: 'John 3:16' });
    const res = await request(app)
      .post(`/api/entities/Sermon/${sermon.id}/review`)
      .set('Cookie', asUser('u-pastor'))
      .send({});
    expect(res.status).toBe(400);
  });

  it('review acknowledgment requires every pastoral checkpoint', async () => {
    const sermon = await createSermon('u-pastor', { title: 'Incomplete review', anchor_passage: 'John 3:16' });
    const res = await request(app)
      .post(`/api/entities/Sermon/${sermon.id}/review`)
      .set('Cookie', asUser('u-pastor'))
      .send({ acknowledged: true, checklist: PASTORAL_REVIEW_ITEM_IDS.slice(0, -1) });
    expect(res.status).toBe(400);
    expect(res.body.missing).toEqual(['pastoral_application']);
  });

  it('only the owner may acknowledge review', async () => {
    const sermon = await createSermon('u-pastor', { title: 'Mine', anchor_passage: 'John 3:16' });
    const res = await request(app)
      .post(`/api/entities/Sermon/${sermon.id}/review`)
      .set('Cookie', asUser('u-catholic'))
      .send(completedReview());
    expect(res.status).toBe(403);
  });

  it('review acknowledgment is rejected for non-gated types', async () => {
    const res = await request(app)
      .post('/api/entities/Note/some-id/review')
      .set('Cookie', asUser('u-pastor'))
      .send(completedReview());
    expect(res.status).toBe(400);
  });

  it('editing content after review resets pastor_reviewed (stale-review rule)', async () => {
    const sermon = await createSermon('u-pastor', { title: 'Will edit', anchor_passage: 'John 3:16', status: 'draft' });
    await request(app)
      .post(`/api/entities/Sermon/${sermon.id}/review`)
      .set('Cookie', asUser('u-pastor'))
      .send(completedReview());

    const edited = await request(app)
      .put(`/api/entities/Sermon/${sermon.id}`)
      .set('Cookie', asUser('u-pastor'))
      .send({ conclusion: 'A new ending the pastor has not read yet.' });
    expect(edited.status).toBe(200);
    expect(edited.body.pastor_reviewed).toBe(false);
    expect(edited.body.reviewed_by).toBeNull();
  });

  it('a status-only change (archive) does not reset an acknowledged review', async () => {
    const sermon = await createSermon('u-pastor', { title: 'Keep review', anchor_passage: 'John 3:16', status: 'draft' });
    await request(app)
      .post(`/api/entities/Sermon/${sermon.id}/review`)
      .set('Cookie', asUser('u-pastor'))
      .send(completedReview());

    const archived = await request(app)
      .put(`/api/entities/Sermon/${sermon.id}`)
      .set('Cookie', asUser('u-pastor'))
      .send({ status: 'archived' });
    expect(archived.status).toBe(200);
    expect(archived.body.pastor_reviewed).toBe(true);
  });

  it('review does not bypass the publish gate: reviewed content with invalid refs still cannot publish', async () => {
    const sermon = await createSermon('u-pastor', { title: 'Reviewed but broken', anchor_passage: 'John 99:1', status: 'draft' });
    await request(app)
      .post(`/api/entities/Sermon/${sermon.id}/review`)
      .set('Cookie', asUser('u-pastor'))
      .send(completedReview());

    const publish = await request(app)
      .put(`/api/entities/Sermon/${sermon.id}`)
      .set('Cookie', asUser('u-pastor'))
      .send({ status: 'published' });
    expect(publish.status).toBe(422);
  });

  it('acknowledged: false withdraws a review', async () => {
    const sermon = await createSermon('u-pastor', { title: 'Withdraw', anchor_passage: 'John 3:16' });
    await request(app)
      .post(`/api/entities/Sermon/${sermon.id}/review`)
      .set('Cookie', asUser('u-pastor'))
      .send(completedReview());
    const res = await request(app)
      .post(`/api/entities/Sermon/${sermon.id}/review`)
      .set('Cookie', asUser('u-pastor'))
      .send({ acknowledged: false });
    expect(res.status).toBe(200);
    expect(res.body.pastor_reviewed).toBe(false);
  });
});
