import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';

// Server-side Scripture integrity gate tests.
//
// The durable entity write is the one choke point every save path crosses,
// so validation evidence must be computed server-side there — a
// client-supplied validation blob or a
// premature `published` status must never be stored as authoritative.

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

describe('entities — server-side Scripture integrity gate (Sermon)', () => {
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
    expect(res.body.status).toBe('draft');
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
    expect(res.body.status).toBe('draft');
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

  it('strips fields from the retired attestation workflow', async () => {
    const res = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('u-pastor'))
      .send({
        title: 'Client supplied metadata',
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
    // text source — not a fabrication accusation.
    expect(res.body.scripture_validation[0].status).toBe('chapter_checked');
    expect(res.body.status).toBe('draft');
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
    expect(res.body.status).toBe('draft');
  });

  it('update revalidates the merged record while preserving a private draft', async () => {
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
    expect(updated.body.status).toBe('draft');
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
    expect(res.body[1].status).toBe('draft');
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

  it('removes retired workflow data from an older row on its next normal edit', async () => {
    const created = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('u-pastor'))
      .send({ title: 'Older row', anchor_passage: 'John 3:16', status: 'draft' });
    const stored = prisma._store.entity.find((item) => item.id === created.body.id);
    stored.data = {
      ...stored.data,
      status: 'needs_review',
      pastor_reviewed: true,
      reviewed_by: 'u-pastor',
      ready_to_present: true,
    };

    const updated = await request(app)
      .put(`/api/entities/Sermon/${created.body.id}`)
      .set('Cookie', asUser('u-pastor'))
      .send({ title: 'Normal draft' });

    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('draft');
    expect(updated.body.pastor_reviewed).toBeUndefined();
    expect(updated.body.reviewed_by).toBeUndefined();
    expect(updated.body.ready_to_present).toBeUndefined();
  });
});
