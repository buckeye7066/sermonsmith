import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';
import { _resetPremiumCatalogCache } from '../services/premiumTranslations.js';

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
    // Keep these registry tests offline — the premium tier is exercised in its
    // own describe below with a stubbed fetch.
    process.env.DISABLE_PREMIUM_TRANSLATIONS = '1';
    prisma._reset();
    app = buildApp();
  });

  afterEach(() => {
    delete process.env.DISABLE_PREMIUM_TRANSLATIONS;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it('caches verse-level Bible passages', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        reference: 'John 3:16',
        text: 'For God so loved the world',
        verses: [{ book_name: 'John', chapter: 3, verse: 16, text: 'For God so loved the world' }],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const payload = { book: 'John', chapter: 3, verse: 16, translation: 'kjv' };
    const first = await request(app).post('/api/functions/biblePassage').send(payload);
    const second = await request(app).post('/api/functions/biblePassage').send(payload);

    expect(first.status).toBe(200);
    expect(first.body.cacheHit).toBe(false);
    expect(second.status).toBe(200);
    expect(second.body.cacheHit).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prisma._store.biblePassageCache).toHaveLength(1);
    expect(prisma._store.biblePassageCache[0]).toMatchObject({
      translationId: 'kjv',
      normalizedRef: 'john 3:16',
    });
  });

  it('deduplicates normalized translations for multi-source passage lookups', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        reference: 'John 3:16',
        text: 'For God so loved the world',
        verses: [{ book_name: 'John', chapter: 3, verse: 16, text: 'For God so loved the world' }],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/api/functions/getPassageMultiSource')
      .send({
        book: 'John',
        chapter: 3,
        verse: 16,
        translations: ['kjv', 'en-kjv', 'web', 'kjv'],
      });

    expect(res.status).toBe(200);
    expect(res.body.passages).toHaveLength(2);
    expect(res.body.passages.map((p) => p.translation.id)).toEqual(['kjv', 'web']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('function routes - premium translations', () => {
  let app;
  const GETBIBLE = {
    akjv: { translation: 'American King James Version', abbreviation: 'akjv', lang: 'en', language: 'English', direction: 'LTR' },
    arabicsv: { translation: 'Smith Van Dyke', abbreviation: 'arabicsv', lang: 'ar', language: 'Arabic', direction: 'RTL' },
  };

  beforeEach(() => {
    delete process.env.DISABLE_PREMIUM_TRANSLATIONS;
    delete process.env.API_BIBLE_KEY;
    _resetPremiumCatalogCache();
    prisma._reset();
    app = buildApp();
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/translations.json')) {
        return { ok: true, status: 200, json: async () => GETBIBLE };
      }
      if (u.includes('/akjv/43/3.json')) {
        return { ok: true, status: 200, json: async () => ({ verses: [{ verse: 16, text: 'For God so loved the world' }] }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _resetPremiumCatalogCache();
  });

  it('merges the premium catalogue as locked entries for non-premium users', async () => {
    const res = await request(app).post('/api/functions/listAvailableTranslations').send({});
    expect(res.status).toBe(200);
    expect(res.body.external_enabled).toBe(true);
    const gb = res.body.translations.find((t) => t.id === 'gb:akjv');
    expect(gb).toBeTruthy();
    expect(gb.available).toBe(false); // not premium → locked
    expect(gb).toMatchObject({ language: 'English', region: expect.any(String) });
    // Free public-domain bibles remain available.
    expect(res.body.translations.some((t) => t.id === 'kjv' && t.available === true)).toBe(true);
  });

  it('blocks a premium translation passage for non-premium users (402)', async () => {
    const res = await request(app)
      .post('/api/functions/biblePassage')
      .send({ book: 'John', chapter: 3, translationId: 'gb:akjv' });
    expect(res.status).toBe(402);
  });
});
