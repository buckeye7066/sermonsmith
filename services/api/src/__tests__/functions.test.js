import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';
import { BOOKS, _resetPremiumCatalogCache } from '../services/premiumTranslations.js';
import { chaptersInBook } from '@sermonsmith/shared/scripture';

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
  app.use(cookieParser());
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

  it('loads and caches Genesis 2 from the static chapter source without duplicate verses', async () => {
    const fetchMock = vi.fn(async (url) => {
      expect(String(url)).toContain('/en-kjv/books/genesis/chapters/2.json');
      return {
        ok: true,
        json: async () => ({
          data: [
            { book: 'Genesis', chapter: '2', verse: '1', text: 'Thus the heavens and the earth were finished.' },
            { book: 'Genesis', chapter: '2', verse: '2', text: 'And on the seventh day God ended his work.' },
            // The upstream file currently contains duplicate verse rows. The
            // Reader contract is one row per verse, so normalize at ingress.
            { book: 'Genesis', chapter: '2', verse: '1', text: 'duplicate' },
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const payload = { bookCode: 'GEN', chapter: 2, translationId: 'kjv' };
    const first = await request(app).post('/api/functions/biblePassage').send(payload);
    const second = await request(app).post('/api/functions/biblePassage').send(payload);

    expect(first.status).toBe(200);
    expect(first.body.reference).toBe('Genesis 2');
    expect(first.body.verses.map((row) => row.verse)).toEqual([1, 2]);
    expect(first.body.cacheHit).toBe(false);
    expect(second.status).toBe(200);
    expect(second.body.cacheHit).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves all 1,189 chapters in all 66 Reader books from every pinned static dataset without fallback', async () => {
    const translations = ['kjv', 'web', 'asv'];
    const namesBySlug = new Map(
      BOOKS.map((book) => [book.name.toLowerCase().replace(/[^a-z0-9]+/g, ''), book.name]),
    );
    const chaptersPerTranslation = BOOKS.reduce(
      (total, book) => total + chaptersInBook(book.name),
      0,
    );

    expect(BOOKS).toHaveLength(66);
    expect(chaptersPerTranslation).toBe(1189);

    const fetchMock = vi.fn(async (url) => {
      const value = String(url);
      if (value.includes('bible-api.com')) {
        throw new Error(`Unexpected fallback request: ${value}`);
      }
      const match = value.match(/\/bibles\/en-(kjv|web|asv)\/books\/([^/]+)\/chapters\/(\d+)\.json$/);
      if (!match || !namesBySlug.has(match[2])) {
        throw new Error(`Unexpected static Bible URL: ${value}`);
      }
      const [, translation, slug, chapter] = match;
      return {
        ok: true,
        json: async () => ({
          data: [{
            book: namesBySlug.get(slug),
            chapter,
            verse: '1',
            text: `${translation} ${slug} ${chapter}`,
          }],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    for (const translation of translations) {
      for (const book of BOOKS) {
        const chapterCount = chaptersInBook(book.name);
        for (let chapter = 1; chapter <= chapterCount; chapter += 1) {
          const res = await request(app)
            .post('/api/functions/biblePassage')
            // Reader.jsx sends OSIS identifiers, so the exhaustive contract
            // intentionally exercises that exact input rather than full names.
            .send({ bookCode: book.osis, chapter, translation });
          expect(res.status, `${translation} ${book.name} ${chapter}`).toBe(200);
          expect(res.body).toMatchObject({
            reference: `${book.name} ${chapter}`,
            cacheHit: false,
          });
        }
      }
    }

    expect(fetchMock).toHaveBeenCalledTimes(chaptersPerTranslation * translations.length);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('bible-api.com'))).toBe(true);
  }, 60_000);

  it('rejects unknown books and book-specific chapter overflow before contacting a provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const unknown = await request(app)
      .post('/api/functions/biblePassage')
      .send({ bookCode: 'XYZ', chapter: 1, translationId: 'kjv' });
    const overflow = await request(app)
      .post('/api/functions/biblePassage')
      .send({ bookCode: 'JHN', chapter: 22, translationId: 'kjv' });

    expect(unknown.status).toBe(400);
    expect(unknown.body.message).toMatch(/Unknown Bible book/i);
    expect(overflow.status).toBe(400);
    expect(overflow.body.message).toMatch(/John has chapters 1–21/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still serves a chapter when the durable chapter-cache table is unavailable', async () => {
    prisma.bibleChapterCache.findUnique.mockRejectedValueOnce(new Error('table missing'));
    prisma.bibleChapterCache.upsert.mockRejectedValueOnce(new Error('table missing'));
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [{ book: 'John', chapter: '3', verse: '16', text: 'For God so loved the world.' }],
      }),
    })));

    const res = await request(app)
      .post('/api/functions/biblePassage')
      .send({ bookCode: 'JHN', chapter: 3, translationId: 'kjv' });

    expect(res.status).toBe(200);
    expect(res.body.verses).toEqual([
      expect.objectContaining({ book_name: 'John', chapter: 3, verse: 16 }),
    ]);
    expect(res.body.cacheHit).toBe(false);
  });

  it('rejects quoted wording that does not match provider text for a valid reference', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        reference: 'John 3:16',
        text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
        verses: [{ book_name: 'John', chapter: 3, verse: 16, text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' }],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/api/functions/verifyVerseWording')
      .send({
        reference: 'John 3:16',
        translation: 'kjv',
        quotedText: 'God is love and nothing else matters.',
      });

    expect(res.status).toBe(200);
    expect(res.body.reference).toBe('John 3:16');
    expect(res.body.status).toBe('mismatch');
    expect(res.body.message).toMatch(/does not match the registered provider text/i);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('accepts quoted wording that matches the registered provider text', async () => {
    const provider =
      'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        reference: 'John 3:16',
        text: provider,
        verses: [{ book_name: 'John', chapter: 3, verse: 16, text: provider }],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/api/functions/verifyVerseWording')
      .send({
        reference: 'John 3:16',
        translation: 'kjv',
        quotedText: 'For God so loved the world, that he gave his only begotten Son',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('verified_excerpt');
    expect(res.body.verified).toBe(true);
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

describe('function routes - developer tools gating', () => {
  let app;

  beforeEach(() => {
    prisma._reset();
    app = buildApp();
    prisma._store.user.push({ id: 'u-admin', email: 'admin@x', role: 'admin', premium: true });
  });

  afterEach(() => {
    delete process.env.ENABLE_DEV_TOOLS;
  });

  const adminCookie = () => [`ss_token=${jwt.sign({ userId: 'u-admin' }, SECRET, { algorithm: 'HS256', expiresIn: '1h' })}`];

  it('blocks the source-exposure tools in production without ENABLE_DEV_TOOLS', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_DEV_TOOLS;
    const res = await request(app)
      .post('/api/functions/discoverFunctions')
      .set('Cookie', adminCookie())
      .send({});
    process.env.NODE_ENV = prev;
    expect(res.status).toBe(403);
  });

  it('allows the tools when ENABLE_DEV_TOOLS=true', async () => {
    process.env.ENABLE_DEV_TOOLS = 'true';
    const res = await request(app)
      .post('/api/functions/discoverFunctions')
      .set('Cookie', adminCookie())
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
