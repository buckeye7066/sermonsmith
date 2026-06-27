import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';

const prisma = createPrismaMock();
const SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';

vi.mock('../middleware/auth.js', () => ({
  prisma,
  authenticateToken: async (req, res, next) => {
    const token = req.cookies?.ss_token;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    try {
      const decoded = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
      req.userId = decoded.userId;
      const user = prisma._store.user.find((u) => u.id === decoded.userId);
      req.userRole = user?.role;
      req.userPremium = !!user?.premium;
      next();
    } catch {
      res.status(401).json({ message: 'Invalid token' });
    }
  },
  optionalAuth: (_req, _res, next) => next(),
  requireAdmin: (req, res, next) => {
    if (req.userRole !== 'admin' && req.userRole !== 'dev') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  },
}));

const { default: functionRoutes } = await import('../routes/functions.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/functions', functionRoutes);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }));
  return app;
}

describe('function routes - Bible source registry', () => {
  let app;

  beforeEach(() => {
    prisma._reset();
    app = buildApp();
  });

  it('returns license and attribution metadata for available translations', async () => {
    const res = await request(app).post('/api/functions/listAvailableTranslations').send({});

    expect(res.status).toBe(200);
    const kjv = res.body.translations.find((t) => t.id === 'kjv');
    expect(kjv).toMatchObject({
      name: 'King James Version',
      displayAllowed: true,
      exportAllowed: true,
      publicDomain: true,
    });
    expect(kjv.attribution).toMatch(/public domain/i);
  });

  it('rejects unsupported translations before contacting the upstream Bible API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await request(app)
      .post('/api/functions/biblePassage')
      .send({ book: 'John', chapter: 3, verse: 16, translation: 'niv' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Unsupported translation/i);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
