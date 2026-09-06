import { beforeEach, describe, expect, it, vi } from 'vitest';
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createPrismaMock } from './setup.js';

const prisma = createPrismaMock();
const SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';

vi.mock('../middleware/auth.js', () => ({
  prisma,
  authenticateToken: async (req, res, next) => {
    try {
      const raw = req.cookies?.ss_token;
      if (!raw) return res.status(401).json({ message: 'Authentication required' });
      const decoded = jwt.verify(raw, SECRET, { algorithms: ['HS256'] });
      const user = prisma._store.user.find((candidate) => candidate.id === decoded.userId);
      if (!user) return res.status(401).json({ message: 'User account not found' });
      req.userId = user.id;
      req.userRole = user.role;
      return next();
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  },
  requireAdmin: (req, res, next) => (
    ['admin', 'dev'].includes(req.userRole)
      ? next()
      : res.status(403).json({ message: 'Admin access required' })
  ),
  optionalAuth: (_req, _res, next) => next(),
  requirePremium: (_req, _res, next) => next(),
}));

const { default: entityRoutes } = await import('../routes/entities.js');

function tokenFor(userId) {
  return jwt.sign({ userId }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

function asUser(userId) {
  return [`ss_token=${tokenFor(userId)}`];
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/entities', entityRoutes);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }));
  return app;
}

describe('entity revision history', () => {
  let app;

  beforeEach(() => {
    prisma._reset();
    prisma._store.user.push(
      { id: 'owner', role: 'user', profile: { denomination: 'Catholic' } },
      { id: 'other', role: 'user' },
      { id: 'admin', role: 'admin', profile: { denomination: 'Protestant' } },
    );
    app = buildApp();
  });

  it('snapshots each mutable source before update and restores an immutable snapshot', async () => {
    const created = await request(app)
      .post('/api/entities/Series')
      .set('Cookie', asUser('owner'))
      .send({ title: 'First title', description: 'Original' });

    const updated = await request(app)
      .put(`/api/entities/Series/${created.body.id}`)
      .set('Cookie', asUser('owner'))
      .send({ title: 'Second title' });
    expect(updated.status).toBe(200);

    const history = await request(app)
      .get(`/api/entities/Series/${created.body.id}/revisions`)
      .set('Cookie', asUser('owner'));
    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0].snapshot).toMatchObject({ title: 'First title', description: 'Original' });

    const restored = await request(app)
      .post(`/api/entities/Series/${created.body.id}/revisions/${history.body[0].id}/restore`)
      .set('Cookie', asUser('owner'));
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ title: 'First title', description: 'Original' });

    const after = await request(app)
      .get(`/api/entities/Series/${created.body.id}/revisions`)
      .set('Cookie', asUser('owner'));
    expect(after.body).toHaveLength(2);
    expect(after.body.find((entry) => entry.reason === 'before_restore')?.snapshot.title).toBe('Second title');
    expect(history.body[0].snapshot.title).toBe('First title');
  });

  it('restores a sermon snapshot as a complete replacement', async () => {
    const created = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('owner'))
      .send({ title: 'Original sermon', introduction: 'Opening', status: 'draft' });
    const updated = await request(app)
      .put(`/api/entities/Sermon/${created.body.id}`)
      .set('Cookie', asUser('owner'))
      .send({ title: 'Reworked sermon', conclusion: 'Added later' });
    expect(updated.status).toBe(200);
    expect(updated.body.conclusion).toBe('Added later');

    const history = await request(app)
      .get(`/api/entities/Sermon/${created.body.id}/revisions`)
      .set('Cookie', asUser('owner'));
    const restored = await request(app)
      .post(`/api/entities/Sermon/${created.body.id}/revisions/${history.body[0].id}/restore`)
      .set('Cookie', asUser('owner'));

    expect(restored.status).toBe(200);
    expect(restored.body.title).toBe('Original sermon');
    expect(restored.body.introduction).toBe('Opening');
    expect(restored.body).not.toHaveProperty('conclusion');
  });

  it('keeps history tenant-scoped and rejects a revision from another source', async () => {
    const first = await request(app)
      .post('/api/entities/Series')
      .set('Cookie', asUser('owner'))
      .send({ title: 'First' });
    const second = await request(app)
      .post('/api/entities/Series')
      .set('Cookie', asUser('owner'))
      .send({ title: 'Second' });
    await request(app)
      .put(`/api/entities/Series/${first.body.id}`)
      .set('Cookie', asUser('owner'))
      .send({ title: 'First changed' });
    const history = await request(app)
      .get(`/api/entities/Series/${first.body.id}/revisions`)
      .set('Cookie', asUser('owner'));

    const foreignUser = await request(app)
      .get(`/api/entities/Series/${first.body.id}/revisions`)
      .set('Cookie', asUser('other'));
    expect(foreignUser.status).toBe(404);

    const wrongSource = await request(app)
      .post(`/api/entities/Series/${second.body.id}/revisions/${history.body[0].id}/restore`)
      .set('Cookie', asUser('owner'));
    expect(wrongSource.status).toBe(404);
  });

  it('removes source revision snapshots transactionally when the source is deleted', async () => {
    const source = await request(app)
      .post('/api/entities/Series')
      .set('Cookie', asUser('owner'))
      .send({ title: 'Delete me' });
    await request(app)
      .put(`/api/entities/Series/${source.body.id}`)
      .set('Cookie', asUser('owner'))
      .send({ title: 'Delete me later' });
    prisma._store.entity.push({
      id: 'unrelated-revision',
      type: 'EntityRevision',
      userId: 'owner',
      data: { source_type: 'Series', source_id: 'unrelated-source', snapshot: {} },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const deleted = await request(app)
      .delete(`/api/entities/Series/${source.body.id}`)
      .set('Cookie', asUser('owner'));

    expect(deleted.status).toBe(204);
    expect(prisma._store.entity.some((entity) => entity.id === source.body.id)).toBe(false);
    expect(prisma._store.entity.some((entity) => (
      entity.type === 'EntityRevision' && entity.data?.source_id === source.body.id
    ))).toBe(false);
    expect(prisma._store.entity.some((entity) => entity.id === 'unrelated-revision')).toBe(true);
  });

  it('blocks generic mutation of server-owned revision records', async () => {
    const forbiddenCreate = await request(app)
      .post('/api/entities/EntityRevision')
      .set('Cookie', asUser('owner'))
      .send({ source_id: 'anything' });
    expect(forbiddenCreate.status).toBe(403);

    prisma._store.entity.push({
      id: 'revision-1',
      type: 'EntityRevision',
      userId: 'owner',
      data: { source_id: 'source-1' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const forbiddenUpdate = await request(app)
      .put('/api/entities/EntityRevision/revision-1')
      .set('Cookie', asUser('owner'))
      .send({ source_id: 'changed' });
    const forbiddenDelete = await request(app)
      .delete('/api/entities/EntityRevision/revision-1')
      .set('Cookie', asUser('owner'));
    const disguisedDelete = await request(app)
      .delete('/api/entities/Sermon/revision-1')
      .set('Cookie', asUser('owner'));
    const forbiddenGet = await request(app)
      .get('/api/entities/EntityRevision/revision-1')
      .set('Cookie', asUser('owner'));
    const forbiddenList = await request(app)
      .get('/api/entities/EntityRevision')
      .set('Cookie', asUser('owner'));
    expect(forbiddenUpdate.status).toBe(403);
    expect(forbiddenDelete.status).toBe(403);
    expect(disguisedDelete.status).toBe(404);
    expect(prisma._store.entity.some((entity) => entity.id === 'revision-1')).toBe(true);
    expect(forbiddenGet.status).toBe(403);
    expect(forbiddenList.status).toBe(403);
  });

  it('re-applies the Scripture boundary when restoring a sermon snapshot', async () => {
    const source = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('owner'))
      .send({ title: 'Current', anchor_passage: 'John 3:16', status: 'draft' });
    prisma._store.entity.push({
      id: 'unsafe-revision',
      type: 'EntityRevision',
      userId: 'owner',
      data: {
        source_type: 'Sermon',
        source_id: source.body.id,
        snapshot: { title: 'Old', anchor_passage: 'Genesis 999:1', status: 'published' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const restored = await request(app)
      .post(`/api/entities/Sermon/${source.body.id}/revisions/unsafe-revision/restore`)
      .set('Cookie', asUser('owner'));
    expect(restored.status).toBe(422);
  });

  it('rejects a stale restore without overwriting a concurrent save or recording false history', async () => {
    const source = await request(app)
      .post('/api/entities/Series')
      .set('Cookie', asUser('owner'))
      .send({ title: 'Original' });
    await request(app)
      .put(`/api/entities/Series/${source.body.id}`)
      .set('Cookie', asUser('owner'))
      .send({ title: 'Version two' });
    const history = await request(app)
      .get(`/api/entities/Series/${source.body.id}/revisions`)
      .set('Cookie', asUser('owner'));
    const historyCount = prisma._store.entity.filter((item) => item.type === 'EntityRevision').length;
    const transaction = prisma.$transaction.getMockImplementation();
    prisma.$transaction.mockImplementationOnce(async (callback) => {
      const index = prisma._store.entity.findIndex((item) => item.id === source.body.id);
      const current = prisma._store.entity[index];
      prisma._store.entity[index] = {
        ...current,
        data: { ...current.data, title: 'Concurrent save' },
        updatedAt: new Date(current.updatedAt.getTime() + 1_000),
      };
      return transaction(callback);
    });

    const restored = await request(app)
      .post(`/api/entities/Series/${source.body.id}/revisions/${history.body[0].id}/restore`)
      .set('Cookie', asUser('owner'));

    expect(restored.status).toBe(409);
    expect(prisma._store.entity.find((item) => item.id === source.body.id)?.data.title).toBe('Concurrent save');
    expect(prisma._store.entity.filter((item) => item.type === 'EntityRevision')).toHaveLength(historyCount);
  });

  it('rejects a stale ordinary save without overwriting concurrent work or recording false history', async () => {
    const source = await request(app)
      .post('/api/entities/Series')
      .set('Cookie', asUser('owner'))
      .send({ title: 'Original' });
    const historyCount = prisma._store.entity.filter((item) => item.type === 'EntityRevision').length;
    const transaction = prisma.$transaction.getMockImplementation();
    prisma.$transaction.mockImplementationOnce(async (callback) => {
      const index = prisma._store.entity.findIndex((item) => item.id === source.body.id);
      const current = prisma._store.entity[index];
      prisma._store.entity[index] = {
        ...current,
        data: { ...current.data, title: 'Concurrent save' },
        updatedAt: new Date(current.updatedAt.getTime() + 1_000),
      };
      return transaction(callback);
    });

    const staleSave = await request(app)
      .put(`/api/entities/Series/${source.body.id}`)
      .set('Cookie', asUser('owner'))
      .send({ title: 'Stale edit' });

    expect(staleSave.status).toBe(409);
    expect(prisma._store.entity.find((item) => item.id === source.body.id)?.data.title).toBe('Concurrent save');
    expect(prisma._store.entity.filter((item) => item.type === 'EntityRevision')).toHaveLength(historyCount);
  });

  it('paginates revision history so versions older than the first page remain reachable', async () => {
    const source = await request(app)
      .post('/api/entities/Series')
      .set('Cookie', asUser('owner'))
      .send({ title: 'Long-running series' });
    for (let index = 0; index < 105; index += 1) {
      prisma._store.entity.push({
        id: `revision-${index}`,
        type: 'EntityRevision',
        userId: 'owner',
        data: {
          source_type: 'Series',
          source_id: source.body.id,
          snapshot: { title: `Version ${index}` },
        },
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
        updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
      });
    }

    const older = await request(app)
      .get(`/api/entities/Series/${source.body.id}/revisions?limit=100&offset=100`)
      .set('Cookie', asUser('owner'));

    expect(older.status).toBe(200);
    expect(older.body).toHaveLength(5);
    expect(older.body.map((revision) => revision.id)).toEqual([
      'revision-4',
      'revision-3',
      'revision-2',
      'revision-1',
      'revision-0',
    ]);
  });

  it('uses the source owner canon when an administrator restores a sermon', async () => {
    const source = await request(app)
      .post('/api/entities/Sermon')
      .set('Cookie', asUser('owner'))
      .send({ title: 'Current', status: 'draft' });
    prisma._store.entity.push({
      id: 'catholic-revision',
      type: 'EntityRevision',
      userId: 'owner',
      data: {
        source_type: 'Sermon',
        source_id: source.body.id,
        snapshot: { title: 'Wisdom', anchor_passage: 'Wisdom 1:1', status: 'draft' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const restored = await request(app)
      .post(`/api/entities/Sermon/${source.body.id}/revisions/catholic-revision/restore`)
      .set('Cookie', asUser('admin'));

    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ title: 'Wisdom', anchor_passage: 'Wisdom 1:1' });
    expect(restored.body.scripture_validation[0].status).toBe('chapter_checked');
  });
});
