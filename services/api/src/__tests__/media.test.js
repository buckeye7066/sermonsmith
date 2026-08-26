import { beforeEach, describe, expect, it, vi } from 'vitest';
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createPrismaMock } from './setup.js';
import { MediaTranscriptionError } from '../services/mediaTranscription.js';

const prisma = createPrismaMock();
const SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';

vi.mock('../middleware/auth.js', () => ({
  prisma,
  authenticateToken: async (req, res, next) => {
    try {
      const decoded = jwt.verify(req.cookies?.ss_token, SECRET, { algorithms: ['HS256'] });
      const user = prisma._store.user.find((candidate) => candidate.id === decoded.userId);
      if (!user) return res.status(401).json({ message: 'User account not found' });
      req.userId = user.id;
      req.userRole = user.role;
      req.userPremium = !!user.premium;
      return next();
    } catch {
      return res.status(401).json({ message: 'Authentication required' });
    }
  },
}));

const { buildMediaRouter, MEDIA_DAILY_TRANSCRIPTION_LIMIT } = await import('../routes/media.js');

function tokenFor(userId) {
  return jwt.sign({ userId }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

function asUser(userId) {
  return [`ss_token=${tokenFor(userId)}`];
}

function buildApp(provider) {
  const app = express();
  app.use(cookieParser());
  app.use('/api/media', buildMediaRouter({ provider }));
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }));
  return app;
}

describe('media jobs', () => {
  beforeEach(() => {
    prisma._reset();
    prisma._store.user.push(
      { id: 'owner', role: 'user', premium: true },
      { id: 'other', role: 'user', premium: true },
      { id: 'free', role: 'user', premium: false },
    );
  });

  it('keeps upload bytes transient and persists a completed transcript with clip drafts', async () => {
    const transcribe = vi.fn(async () => ({
      text: 'A useful sermon moment.',
      provider: 'fixture',
      language: 'en',
      duration_seconds: 12,
      segments: [{ id: 1, start: 0, end: 12, text: 'A useful sermon moment.' }],
    }));
    const app = buildApp({ transcribe });
    const response = await request(app)
      .post('/api/media/jobs')
      .set('Cookie', asUser('owner'))
      .set('Content-Type', 'text/plain')
      .set('X-File-Name', encodeURIComponent('../Sunday notes.txt'))
      .send('raw-media-fixture');

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: 'completed',
      file_name: 'Sunday notes.txt',
      transcript: 'A useful sermon moment.',
      provider: 'fixture',
    });
    expect(response.body.clip_drafts[0]).toMatchObject({ start_seconds: 0, end_seconds: 12 });
    expect(response.body.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(transcribe.mock.calls[0][0].buffer).toBeInstanceOf(Buffer);
    expect(prisma._store.entity[0].data).not.toHaveProperty('buffer');
    expect(JSON.stringify(prisma._store.entity[0].data)).not.toContain('raw-media-fixture');
    expect(prisma._store.entity[0].data.transcript).toBe('A useful sermon moment.');
  });

  it('persists safe failure state when a configured provider fails', async () => {
    const app = buildApp({
      transcribe: vi.fn(async () => {
        throw new MediaTranscriptionError('Provider unavailable for fixture.', {
          code: 'MEDIA_PROVIDER_UNAVAILABLE',
          status: 503,
        });
      }),
    });
    const response = await request(app)
      .post('/api/media/jobs')
      .set('Cookie', asUser('owner'))
      .set('Content-Type', 'audio/mpeg')
      .send(Buffer.from([0x49, 0x44, 0x33]));
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('MEDIA_PROVIDER_UNAVAILABLE');
    expect(prisma._store.entity[0].data).toMatchObject({
      status: 'failed',
      error_code: 'MEDIA_PROVIDER_UNAVAILABLE',
    });
    expect(prisma._store.aiUsage[0]).toMatchObject({ count: 0 });
  });

  it('requires premium access before invoking an audio/video provider', async () => {
    const provider = { transcribe: vi.fn() };
    const app = buildApp(provider);
    const response = await request(app)
      .post('/api/media/jobs')
      .set('Cookie', asUser('free'))
      .set('Content-Type', 'audio/mpeg')
      .send(Buffer.from([0x49, 0x44, 0x33]));

    expect(response.status).toBe(402);
    expect(provider.transcribe).not.toHaveBeenCalled();
    expect(prisma._store.entity).toHaveLength(0);
    expect(prisma._store.aiUsage).toHaveLength(0);
  });

  it('uses a durable daily account quota and refunds denied attempts', async () => {
    const bucket = `media:${new Date().toISOString().slice(0, 10)}`;
    prisma._store.aiUsage.push({ id: 'usage-1', userId: 'owner', bucket, count: MEDIA_DAILY_TRANSCRIPTION_LIMIT });
    const provider = { transcribe: vi.fn() };
    const app = buildApp(provider);
    const response = await request(app)
      .post('/api/media/jobs')
      .set('Cookie', asUser('owner'))
      .set('Content-Type', 'audio/mpeg')
      .send(Buffer.from([0x49, 0x44, 0x33]));

    expect(response.status).toBe(429);
    expect(provider.transcribe).not.toHaveBeenCalled();
    expect(prisma._store.entity).toHaveLength(0);
    expect(prisma._store.aiUsage[0].count).toBe(MEDIA_DAILY_TRANSCRIPTION_LIMIT);
  });

  it('counts a successful premium provider request against the account quota', async () => {
    const app = buildApp({
      transcribe: vi.fn(async () => ({ text: 'Audio transcript', provider: 'fixture' })),
    });
    const response = await request(app)
      .post('/api/media/jobs')
      .set('Cookie', asUser('owner'))
      .set('Content-Type', 'audio/mpeg')
      .send(Buffer.from([0x49, 0x44, 0x33]));

    expect(response.status).toBe(201);
    expect(prisma._store.aiUsage[0]).toMatchObject({
      userId: 'owner',
      count: 1,
    });
    expect(prisma._store.aiUsage[0].bucket).toMatch(/^media:\d{4}-\d{2}-\d{2}$/u);
  });

  it('rejects unsupported types before creating a job', async () => {
    const provider = { transcribe: vi.fn() };
    const app = buildApp(provider);
    const response = await request(app)
      .post('/api/media/jobs')
      .set('Cookie', asUser('owner'))
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('bytes'));
    expect(response.status).toBe(415);
    expect(provider.transcribe).not.toHaveBeenCalled();
    expect(prisma._store.entity).toHaveLength(0);
  });

  it('scopes list, get, and delete to the job owner', async () => {
    const app = buildApp({
      transcribe: async () => ({ text: 'Transcript', provider: 'fixture' }),
    });
    const created = await request(app)
      .post('/api/media/jobs')
      .set('Cookie', asUser('owner'))
      .set('Content-Type', 'text/plain')
      .send('Transcript');

    const hidden = await request(app)
      .get(`/api/media/jobs/${created.body.id}`)
      .set('Cookie', asUser('other'));
    const ownerDetail = await request(app)
      .get(`/api/media/jobs/${created.body.id}`)
      .set('Cookie', asUser('owner'));
    const wrongDelete = await request(app)
      .delete(`/api/media/jobs/${created.body.id}`)
      .set('Cookie', asUser('other'));
    const ownerList = await request(app)
      .get('/api/media/jobs')
      .set('Cookie', asUser('owner'));

    expect(hidden.status).toBe(404);
    expect(wrongDelete.status).toBe(404);
    expect(ownerList.body).toHaveLength(1);
    expect(ownerList.body[0]).not.toHaveProperty('transcript');
    expect(ownerList.body[0]).not.toHaveProperty('segments');
    expect(ownerList.body[0]).not.toHaveProperty('clip_drafts');
    expect(ownerList.body[0]).toMatchObject({
      transcript_character_count: 'Transcript'.length,
      segment_count: 0,
    });
    expect(ownerDetail.body.transcript).toBe('Transcript');
  });
});
