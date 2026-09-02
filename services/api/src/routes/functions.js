import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma, authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth.js';
import { FREE_PERIOD_DAYS, grantFreePeriodToUser } from '../lib/premiumGrant.js';
import { assertGatedResourceExposable } from '../services/scriptureGate.js';
import {
  BIBLE_TRANSLATIONS,
  BIBLE_TRANSLATION_IDS,
  normalizeBibleTranslation,
  requireBibleTranslation,
  translationMetadata,
} from '../services/bibleSources.js';
import {
  premiumProvider,
  isPremiumTranslationId,
  listPremiumTranslationsDetailed,
  fetchPremiumChapter,
  sliceVerses,
  bookByName,
} from '../services/premiumTranslations.js';
import { buildVerseWordingResult } from '../services/verseWording.js';
import { chaptersInBook, versesInChapter } from '@sermonsmith/shared/scripture';
import { ACCOUNT_TIERS, accountTierFor } from '../lib/entitlements.js';

const router = Router();

// ---------------------------------------------------------------------------
// Public Bible proxy validation.
//
// The bible-api.com proxy used to accept whatever the client sent. A
// malformed payload threw inside the fetch and bubbled up as a generic
// 500 — bad UX and bad observability. Zod gives us a 400 with a
// structured `issues` list and stops obviously-invalid requests from
// hitting the upstream at all.
//
// The Bible source registry keeps `getPassageMultiSource` from being a
// generic translation enumerator that fans out to any string the client
// sends; we cap to the ones our app can display/export with attribution.
// ---------------------------------------------------------------------------
const passageSchema = z.object({
  book: z.string().min(1).max(40).optional(),
  bookCode: z.string().min(1).max(40).optional(),
  chapter: z.coerce.number().int().min(1).max(150),
  verse: z.union([z.string().max(30), z.number()]).optional(),
  verses: z.union([z.string().max(30), z.number()]).optional(),
  translation: z.string().min(1).max(20).optional(),
  translationId: z.string().min(1).max(20).optional(),
  translations: z.array(z.string().min(1).max(20)).max(5).optional(),
}).refine((d) => d.book || d.bookCode, { message: 'book or bookCode is required' });

// ---------------------------------------------------------------------------
// Bible chapter cache.
//
// bible-api.com upstream is rate-limited and adds 200-400ms of latency to
// every Reader page view. Bible text is effectively immutable, so we cache
// each (translation, book, chapter) JSON payload in Postgres for
// BIBLE_CACHE_TTL_MS (default 30 days). A single chapter is the smallest
// unit the Reader UI requests, so caching at chapter granularity gives us
// near-zero upstream traffic for the most common navigation pattern
// (Genesis 1, Genesis 2, …) without cluttering the cache with thousands of
// per-verse rows.
//
// We deliberately do NOT cache failed responses — a 5xx from upstream
// must trigger a real refetch next time, not be remembered as truth.
// ---------------------------------------------------------------------------
const BIBLE_CACHE_TTL_MS = Number(process.env.BIBLE_CACHE_TTL_MS || 30 * 24 * 60 * 60 * 1000);

function bibleCacheFresh(row) {
  return row && Date.now() - new Date(row.updatedAt || row.fetchedAt).getTime() < BIBLE_CACHE_TTL_MS;
}

async function fetchBibleApiJson(ref, translationId, timeoutMs = 10000) {
  const query = new URLSearchParams({
    translation: translationId,
    // Without this setting the provider interprets Jude 1, Obadiah 1,
    // Philemon 1, 2 John 1, and 3 John 1 as a single verse instead of the
    // requested whole chapter.
    single_chapter_book_matching: 'indifferent',
  });
  const url = `https://bible-api.com/${encodeURIComponent(ref)}?${query}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const err = new Error(`Bible API returned ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeBibleApiChapter(payload, book, chapter, translationId) {
  const unique = new Map();
  for (const row of Array.isArray(payload?.verses) ? payload.verses : []) {
    const verse = Number(row?.verse);
    const text = typeof row?.text === 'string' ? row.text.trim() : '';
    if (!Number.isInteger(verse) || verse < 1 || !text || unique.has(verse)) continue;
    unique.set(verse, {
      book_name: row.book || row.book_name || book.name,
      chapter: Number(row.chapter) || Number(chapter),
      verse,
      text,
    });
  }
  if (!unique.size) {
    throw Object.assign(new Error(`Bible source returned no verses for ${book.name} ${chapter}`), { status: 502 });
  }
  const verses = [...unique.values()].sort((a, b) => a.verse - b.verse);
  return {
    reference: `${book.name} ${chapter}`,
    translation_id: translationId,
    translation_name: payload?.translation?.name || translationId.toUpperCase(),
    verses,
    text: verses.map((row) => row.text).join('\n'),
    source: 'bible-api-parameterized',
  };
}

function expectedVerseCountForCompleteness(book, chapter, translationId) {
  // Exact translation-aware bounds exist for the audited static datasets.
  // Single-chapter books also use the canonical bound for every supported
  // public-domain translation; this is the ambiguity that historically made
  // the provider/import path return only verse 1 for an entire book.
  return versesInChapter(book.name, Number(chapter), translationId)
    ?? (chaptersInBook(book.name) === 1
      ? versesInChapter(book.name, Number(chapter))
      : null);
}

function hasEveryExpectedVerse(chapterData, expected) {
  if (!expected) return true;
  const verseNumbers = new Set((chapterData?.verses || []).map((row) => Number(row.verse)));
  if (verseNumbers.size !== expected) return false;
  for (let verse = 1; verse <= expected; verse += 1) {
    if (!verseNumbers.has(verse)) return false;
  }
  return true;
}

async function fetchBibleApiChapter(bookInput, chapter, translationId, timeoutMs = 10000) {
  const book = bookByName(bookInput);
  if (!book) throw Object.assign(new Error(`Unknown book: ${bookInput}`), { status: 400 });
  const url = `https://bible-api.com/data/${encodeURIComponent(translationId)}/${encodeURIComponent(book.osis)}/${chapter}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw Object.assign(new Error(`Bible API returned ${response.status}`), { status: response.status });
    }
    const normalized = normalizeBibleApiChapter(await response.json(), book, chapter, translationId);
    const expected = expectedVerseCountForCompleteness(book, chapter, translationId);
    if (!hasEveryExpectedVerse(normalized, expected)) {
      throw Object.assign(new Error(`Bible source returned an incomplete chapter for ${book.name} ${chapter}`), { status: 502 });
    }
    return { ...normalized, source: 'bible-api-data', chapter_complete: true };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchImportedBibleChapter(book, chapter, translationId) {
  try {
    const rows = await prisma.entity.findMany({
      where: {
        type: 'Verse',
        AND: [
          { data: { path: ['translation'], equals: translationId } },
          { data: { path: ['book_name'], equals: book.name } },
          { data: { path: ['chapter'], equals: Number(chapter) } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: { data: true },
    });
    if (!rows.length) return null;
    const normalized = normalizeBibleApiChapter(
      { verses: rows.map((row) => row.data), translation: { name: translationId.toUpperCase() } },
      book,
      chapter,
      translationId,
    );
    const expected = expectedVerseCountForCompleteness(book, chapter, translationId);
    const markedComplete = rows.every((row) => (
      row.data?.chapter_complete === true
      && Number(row.data?.import_format_version) >= 2
      && Number(row.data?.chapter_verse_count) === normalized.verses.length
    ));
    if ((expected && !hasEveryExpectedVerse(normalized, expected)) || (!expected && !markedComplete)) {
      console.warn(`[Bible Reader] ignoring incomplete legacy import for ${book.name} ${chapter} (${translationId})`);
      return null;
    }
    return { ...normalized, source: 'database-import', chapter_complete: true };
  } catch (error) {
    console.warn('[Bible Reader] imported verse lookup unavailable; trying external source:', error?.message || error);
    return null;
  }
}

// Immutable public-domain chapter files provide a second, CDN-backed source
// for the Reader's most-used free translations. This avoids making every new
// chapter depend on one hobby API's uptime/rate limit. The remaining registry
// translations keep using bible-api.com until an equivalently licensed static
// dataset is configured for them.
const STATIC_BIBLE_DATASETS = Object.freeze({
  kjv: 'en-kjv',
  web: 'en-web',
  asv: 'en-asv',
});
// Pin the reviewed dataset revision so Scripture text cannot change merely
// because the upstream repository's default branch moves.
const STATIC_BIBLE_REVISION = '1d6987e268fcadb1e96ceb487e3d365a5e837f4a';
const STATIC_BIBLE_BASE = `https://cdn.jsdelivr.net/gh/wldeh/bible-api@${STATIC_BIBLE_REVISION}/bibles`;

function normalizeStaticChapter(payload, book, chapter, translationId) {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const unique = new Map();
  for (const row of rows) {
    const verse = Number(row?.verse);
    const text = typeof row?.text === 'string' ? row.text.trim() : '';
    if (!Number.isInteger(verse) || verse < 1 || !text || unique.has(verse)) continue;
    unique.set(verse, {
      book_name: row.book || book.name,
      chapter: Number(row.chapter) || Number(chapter),
      verse,
      text,
    });
  }
  if (!unique.size) {
    throw Object.assign(new Error(`Static Bible source returned no verses for ${book.name} ${chapter}`), { status: 502 });
  }
  const verses = [...unique.values()].sort((a, b) => a.verse - b.verse);
  return {
    reference: `${book.name} ${chapter}`,
    translation_id: translationId,
    translation_name: translationId.toUpperCase(),
    verses,
    text: verses.map((row) => row.text).join('\n'),
    source: 'wldeh-bible-api-static',
  };
}

async function fetchStaticBibleChapter(bookInput, chapter, translationId, timeoutMs = 10000) {
  const dataset = STATIC_BIBLE_DATASETS[translationId];
  const book = bookByName(bookInput);
  if (!dataset || !book) return null;
  // wldeh/bible-api stores multi-word and numbered book directories as one
  // lowercase alphanumeric token (for example `1samuel` and
  // `songofsolomon`). Kebab-casing those names made all 237 chapters across
  // the 18 affected books miss the pinned static dataset and silently fall
  // back to bible-api.com.
  const slug = book.name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const url = `${STATIC_BIBLE_BASE}/${dataset}/books/${slug}/chapters/${chapter}.json`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw Object.assign(new Error(`Static Bible source returned ${response.status}`), { status: response.status });
    }
    const normalized = normalizeStaticChapter(await response.json(), book, chapter, translationId);
    const expected = expectedVerseCountForCompleteness(book, chapter, translationId);
    if (!hasEveryExpectedVerse(normalized, expected)) {
      throw Object.assign(new Error(`Static Bible source returned an incomplete chapter for ${book.name} ${chapter}`), { status: 502 });
    }
    return { ...normalized, chapter_complete: true };
  } finally {
    clearTimeout(timeout);
  }
}

async function getCachedBibleChapter({ book, chapter, translationId }) {
  const resolvedBook = bookByName(book);
  if (!resolvedBook) throw Object.assign(new Error(`Unknown book: ${book}`), { status: 400 });
  const maxChapter = chaptersInBook(resolvedBook.name);
  if (maxChapter && Number(chapter) > maxChapter) {
    throw Object.assign(new Error(`${resolvedBook.name} has ${maxChapter} chapter${maxChapter === 1 ? '' : 's'}`), { status: 400 });
  }
  // Use one canonical cache key regardless of whether the client sent GEN,
  // Genesis, or book number 1.
  const cacheKey = { translation: translationId, book: resolvedBook.osis, chapter: Number(chapter) };

  let cached = null;
  try {
    cached = await prisma.bibleChapterCache.findUnique({
      where: { translation_book_chapter: cacheKey },
    });
  } catch (error) {
    // A missed production migration must degrade to a live read, not turn the
    // Bible Reader into a one-cached-chapter application.
    console.warn('[Bible Reader] chapter cache read unavailable; serving from source:', error?.message || error);
  }

  const cachedExpected = expectedVerseCountForCompleteness(resolvedBook, chapter, translationId);
  const cacheIsComplete = cached?.payload?.source !== 'bible-api-parameterized'
    && (cached?.payload?.source !== 'database-import' || cached?.payload?.chapter_complete === true)
    && hasEveryExpectedVerse(cached?.payload, cachedExpected);
  if (bibleCacheFresh(cached) && cacheIsComplete) {
    return { ...cached.payload, cacheHit: true };
  }

  let data = await fetchImportedBibleChapter(resolvedBook, chapter, translationId);
  if (!data) {
    try {
      data = await fetchStaticBibleChapter(resolvedBook.name, chapter, translationId);
    } catch (staticError) {
      console.warn('[Bible Reader] static chapter source unavailable; trying bible-api.com:', staticError?.message || staticError);
    }
  }
  if (!data) data = await fetchBibleApiChapter(resolvedBook.name, chapter, translationId);

  try {
    await prisma.bibleChapterCache.upsert({
      where: { translation_book_chapter: cacheKey },
      create: {
        ...cacheKey,
        payload: data,
      },
      update: {
        payload: data,
        fetchedAt: new Date(),
      },
    });
  } catch (error) {
    console.warn('[Bible Reader] chapter cache write unavailable; returning uncached text:', error?.message || error);
  }

  return { ...data, cacheHit: false };
}

// Premium translations are fetched a whole chapter at a time from the external
// provider and cached in the same durable bibleChapterCache (keyed by the
// namespaced translation id, e.g. "gb:akjv"), so a verse request slices the
// cached chapter instead of making a second upstream call.
async function getCachedPremiumChapter({ id, book, chapter }) {
  const cacheKey = { translation: id, book, chapter: Number(chapter) };

  let cached = null;
  try {
    cached = await prisma.bibleChapterCache.findUnique({
      where: { translation_book_chapter: cacheKey },
    });
  } catch (error) {
    console.warn('[Bible Reader] premium chapter cache read unavailable; serving from source:', error?.message || error);
  }
  if (bibleCacheFresh(cached)) {
    return { ...cached.payload, cacheHit: true };
  }

  const data = await fetchPremiumChapter({ id, book, chapter });

  try {
    await prisma.bibleChapterCache.upsert({
      where: { translation_book_chapter: cacheKey },
      create: { ...cacheKey, payload: data },
      update: { payload: data, fetchedAt: new Date() },
    });
  } catch (error) {
    console.warn('[Bible Reader] premium chapter cache write unavailable; returning uncached text:', error?.message || error);
  }

  return { ...data, cacheHit: false };
}

// Resolve effective premium access for the caller. `optionalAuth` only sets
// req.userId (no role/premium), so on those routes we look the user up. Admins
// and devs always count as premium.
async function userHasPremium(req) {
  if (req.userPremium || req.userRole === 'admin' || req.userRole === 'dev') return true;
  if (!req.userId) return false;
  const u = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { role: true, premium: true, premium_until: true, promotionalEmail: true, promotionalPhone: true, email: true, profile: true },
  });
  if (!u) return false;
  return accountTierFor(u) === ACCOUNT_TIERS.PREMIUM;
}

// Developer-tools gate. The Function Reviewer surface (source/metadata
// exposure + "Sync All to GitHub") is powerful internal tooling. It is already
// admin-gated, but defense-in-depth says it should not even be reachable in a
// production deployment unless explicitly turned on. Enabled when
// ENABLE_DEV_TOOLS=true, or in any non-production environment; off by default
// in production. Set ENABLE_DEV_TOOLS=true on the host to use it in prod.
function devToolsEnabled() {
  if (process.env.ENABLE_DEV_TOOLS === 'true') return true;
  if (process.env.ENABLE_DEV_TOOLS === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

function requireDevTools(req, res, next) {
  if (!devToolsEnabled()) {
    return res.status(403).json({ message: 'Developer tools are disabled in this environment.' });
  }
  next();
}

function normalizePassageRef(ref) {
  return String(ref || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function getCachedBiblePassage({ ref, translationId }) {
  const normalizedRef = normalizePassageRef(ref);
  const cacheKey = { translationId, normalizedRef };

  let cached = null;
  try {
    cached = await prisma.biblePassageCache.findUnique({
      where: { translationId_normalizedRef: cacheKey },
    });
  } catch (error) {
    console.warn('[Bible Reader] passage cache read unavailable; serving from source:', error?.message || error);
  }

  if (bibleCacheFresh(cached)) {
    return { ...cached.payload, cacheHit: true };
  }

  const data = await fetchBibleApiJson(ref, translationId);

  try {
    await prisma.biblePassageCache.upsert({
      where: { translationId_normalizedRef: cacheKey },
      create: {
        translationId,
        reference: ref,
        normalizedRef,
        payload: data,
      },
      update: {
        reference: ref,
        payload: data,
        fetchedAt: new Date(),
      },
    });
  } catch (error) {
    console.warn('[Bible Reader] passage cache write unavailable; returning uncached text:', error?.message || error);
  }

  return { ...data, cacheHit: false };
}

// Stripe SDK is lazy-loaded — see getStripe() below. The previous
// top-level await meant the API would crash at import time if the SDK was
// missing or the key was unset; now booting works in test/dev without
// Stripe credentials.
let _stripe = null;
async function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY || process.env.DISABLE_BILLING === '1') return null;
  if (!_stripe) {
    const { default: Stripe } = await import('stripe');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

function serviceUnavailable(message) {
  const err = new Error(message);
  err.status = 503;
  return err;
}

function isLocalHost(hostname) {
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(String(hostname || '').toLowerCase());
}

function frontendBaseUrl() {
  const raw = process.env.FRONTEND_URL || String(process.env.CORS_ORIGIN || '').split(',')[0]?.trim();
  if (!raw) {
    throw serviceUnavailable('Frontend URL not configured. Set FRONTEND_URL or CORS_ORIGIN.');
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw serviceUnavailable('Frontend URL is not a valid URL.');
  }
  if (process.env.NODE_ENV === 'production' && (url.protocol !== 'https:' || isLocalHost(url.hostname))) {
    throw serviceUnavailable('Production Stripe redirects must use a public https FRONTEND_URL.');
  }
  return url.origin;
}

// Bible passage — accepts both frontend naming (translationId/bookCode) and direct naming (book/translation)
router.post('/biblePassage', optionalAuth, async (req, res, next) => {
  try {
    const parsed = passageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid passage request',
        issues: parsed.error.issues,
      });
    }
    const body = parsed.data;
    const requestedBook = body.bookCode || body.book;
    const resolvedBook = bookByName(requestedBook);
    if (!resolvedBook) return res.status(400).json({ message: `Unknown book: ${requestedBook}` });
    const book = resolvedBook.name;
    const chapter = body.chapter;
    const maxChapter = chaptersInBook(book);
    if (maxChapter && chapter > maxChapter) {
      return res.status(400).json({ message: `${book} has ${maxChapter} chapter${maxChapter === 1 ? '' : 's'}` });
    }
    const translationRaw = body.translationId || body.translation || 'kjv';
    const verses = body.verses ?? body.verse;

    // Premium (external) translations are namespaced (gb:/ab:), gated to paying
    // accounts, and served from the external provider instead of bible-api.com.
    if (isPremiumTranslationId(translationRaw)) {
      if (!(await userHasPremium(req))) {
        return res.status(402).json({ message: 'This translation requires Premium. Upgrade to read it.' });
      }
      const chapterData = await getCachedPremiumChapter({ id: translationRaw, book, chapter });
      const sliced = sliceVerses(chapterData, verses);
      return res.json({
        reference: sliced.reference,
        translation: { id: translationRaw },
        translationLabel: translationRaw,
        verses: sliced.verses || [],
        text: sliced.text || '',
        cacheHit: !!chapterData.cacheHit,
      });
    }

    const translation = requireBibleTranslation(translationRaw);
    const translationId = translation.id;

    const ref = verses ? `${book} ${chapter}:${verses}` : `${book} ${chapter}`;

    // Whole chapters and verse/range requests both go through durable
    // caches so common references do not repeatedly hit bible-api.com.
    let data;
    let cacheHit = false;
    if (verses === undefined || verses === null || verses === '') {
      const cached = await getCachedBibleChapter({ book, chapter, translationId });
      cacheHit = !!cached.cacheHit;
      data = cached;
    } else {
      const cached = await getCachedBiblePassage({ ref, translationId });
      cacheHit = !!cached.cacheHit;
      data = cached;
    }

    res.json({
      reference: data.reference || ref,
      translation: translationMetadata(translationId),
      translationLabel: translation.name,
      verses: data.verses || [],
      text: data.text || '',
      source: data.source || null,
      cacheHit,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ message: 'Bible API request timed out' });
    }
    if (err.status && err.status >= 400 && err.status < 600) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  }
});

// Exact wording check: a reference can be canon-valid while the quoted string
// is wrong. Fetch provider text for the registered translation and compare.
const verseWordingSchema = z.object({
  reference: z.string().min(3).max(80),
  quotedText: z.string().min(1).max(4000),
  translation: z.string().min(1).max(20).optional(),
  translationId: z.string().min(1).max(20).optional(),
});

router.post('/verifyVerseWording', optionalAuth, async (req, res, next) => {
  try {
    const parsed = verseWordingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid verse wording request',
        issues: parsed.error.issues,
      });
    }

    const translationRaw = parsed.data.translationId || parsed.data.translation || 'kjv';
    if (isPremiumTranslationId(translationRaw)) {
      return res.status(400).json({
        message: 'Wording verification for premium translations is not available on this endpoint; use a registered public-domain translation id.',
      });
    }

    const translation = requireBibleTranslation(translationRaw);
    const translationId = translation.id;
    const reference = parsed.data.reference.trim();

    let data;
    try {
      data = await getCachedBiblePassage({ ref: reference, translationId });
    } catch (err) {
      if (err.name === 'AbortError') {
        return res.status(504).json({ message: 'Bible API request timed out' });
      }
      throw err;
    }

    const result = buildVerseWordingResult({
      reference: data.reference || reference,
      quotedText: parsed.data.quotedText,
      translationId,
      providerText: data.text || '',
      translation: translationMetadata(translationId),
    });

    return res.json({
      ...result,
      cacheHit: !!data.cacheHit,
    });
  } catch (err) {
    if (err.status && err.status >= 400 && err.status < 600) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  }
});

// List available translations.
//
// Built from the shared `BIBLE_TRANSLATIONS` registry (single source of truth
// for which translations exist + their license), enriched with the
// presentation metadata the client reads: `available`, `shortName`, a full
// `language` NAME, `languageCode`, `region`, `isComplete`, plus top-level
// `byRegion` / `stats` / `is_premium`. The bare registry metadata left
// `available` undefined (falsy), so the Reader's picker walled EVERY
// translation — including genuinely public-domain ones (WEB/ASV/BBE/YLT/
// Darby) — behind a bogus "Premium Required", and the count badge read
// "8+ translations • 1+ languages". Every registry translation here is
// public domain, so all are free for every account.
const TRANSLATION_UI_META = {
  kjv:        { shortName: 'KJV',     languageName: 'English',    languageCode: 'en', region: 'europe',   nativeName: 'King James Version' },
  web:        { shortName: 'WEB',     languageName: 'English',    languageCode: 'en', region: 'americas', nativeName: 'World English Bible' },
  bbe:        { shortName: 'BBE',     languageName: 'English',    languageCode: 'en', region: 'europe',   nativeName: 'Bible in Basic English' },
  asv:        { shortName: 'ASV',     languageName: 'English',    languageCode: 'en', region: 'americas', nativeName: 'American Standard Version' },
  ylt:        { shortName: 'YLT',     languageName: 'English',    languageCode: 'en', region: 'europe',   nativeName: "Young's Literal Translation" },
  darby:      { shortName: 'DARBY',   languageName: 'English',    languageCode: 'en', region: 'europe',   nativeName: 'Darby Bible' },
  clementine: { shortName: 'VULGATE', languageName: 'Latin',      languageCode: 'la', region: 'europe',   nativeName: 'Vulgata Clementina' },
  almeida:    { shortName: 'ALMEIDA', languageName: 'Portuguese', languageCode: 'pt', region: 'americas', nativeName: 'João Ferreira de Almeida' },
};

const REGION_NAMES = {
  europe: 'Europe', americas: 'Americas', middle_east: 'Middle East',
  asia: 'Asia', africa: 'Africa', oceania: 'Oceania', other: 'Other',
};

router.post('/listAvailableTranslations', optionalAuth, async (req, res) => {
  // optionalAuth only sets req.userId; look up the flags the UI reads.
  let isPremium = false;
  let isDeveloper = false;
  if (req.userId) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true, premium: true, premium_until: true, promotionalEmail: true, promotionalPhone: true, email: true, profile: true },
      });
      if (u) {
        isPremium = accountTierFor(u) === ACCOUNT_TIERS.PREMIUM;
        isDeveloper = u.role === 'admin' || u.role === 'dev';
      }
    } catch {
      // Non-fatal — fall back to free/non-developer view.
    }
  }

  const translations = BIBLE_TRANSLATIONS.map((t) => {
    const ui = TRANSLATION_UI_META[t.id] || {};
    return {
      id: t.id,
      name: t.name,
      shortName: ui.shortName || t.id.toUpperCase(),
      nativeName: ui.nativeName || t.name,
      language: ui.languageName || t.language,   // full name for UI grouping
      languageCode: ui.languageCode || t.language,
      region: ui.region || 'other',
      // Public-domain + display-licensed translations are free for everyone.
      available: !!(t.publicDomain && t.displayAllowed),
      isComplete: true,
      textDirection: 'ltr',
      // License/attribution metadata from the registry (the source of truth).
      license: t.license,
      attribution: t.attribution,
      copyrightNotice: t.copyrightNotice,
      sourceUrl: t.sourceUrl,
      publicDomain: t.publicDomain,
      displayAllowed: t.displayAllowed,
      exportAllowed: t.exportAllowed,
    };
  });

  // Append the premium (external) catalogue — getBible.net by default, or
  // API.Bible's full 1000+/200+ catalogue when API_BIBLE_KEY is set. These are
  // available only to premium accounts; everyone else sees them locked in the
  // picker. A flaky upstream degrades to the free catalogue, never an error.
  let externalEnabled = false;
  let premiumCatalog = { degraded: false, stale: false };
  try {
    const premium = await listPremiumTranslationsDetailed();
    externalEnabled = premium.list.length > 0;
    premiumCatalog = { degraded: premium.degraded, stale: premium.stale };
    for (const p of premium.list) {
      translations.push({ ...p, available: isPremium, publicDomain: false });
    }
  } catch {
    // Non-fatal — degrade to the free catalogue only, but report it below.
    premiumCatalog = { degraded: true, stale: false };
  }

  const byRegion = {};
  for (const t of translations) {
    const key = t.region || 'other';
    if (!byRegion[key]) byRegion[key] = { name: REGION_NAMES[key] || 'Other', translations: [] };
    byRegion[key].translations.push(t);
  }

  const stats = {
    total: translations.length,
    languages: new Set(translations.map((t) => t.languageCode)).size,
    complete: translations.filter((t) => t.isComplete).length,
    available: translations.filter((t) => t.available).length,
  };

  res.json({
    translations,
    byRegion,
    stats,
    is_premium: isPremium,
    is_developer: isDeveloper,
    // Drives honest upsell copy on the client: only claim a large premium
    // catalogue when one is actually being served.
    external_enabled: externalEnabled,
    premium_provider: premiumProvider(),
    // Honest degradation state: when the external catalogue is unreachable
    // the picker silently showing free-only misleads premium users. The UI
    // can use these to show "premium catalogue temporarily unavailable".
    premium_catalog_degraded: premiumCatalog.degraded,
    premium_catalog_stale: premiumCatalog.stale,
  });
});

// Multi-source passage
const MAX_TRANSLATIONS = 5;

router.post('/getPassageMultiSource', optionalAuth, async (req, res, next) => {
  try {
    const parsed = passageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid passage request',
        issues: parsed.error.issues,
      });
    }
    const data = parsed.data;
    const requestedBook = data.bookCode || data.book;
    const resolvedBook = bookByName(requestedBook);
    if (!resolvedBook) return res.status(400).json({ message: `Unknown book: ${requestedBook}` });
    const book = resolvedBook.name;
    const { chapter } = data;
    const maxChapter = chaptersInBook(book);
    if (maxChapter && chapter > maxChapter) {
      return res.status(400).json({ message: `${book} has ${maxChapter} chapter${maxChapter === 1 ? '' : 's'}` });
    }
    const verse = data.verse ?? data.verses;

    // Split requested translations into public-domain (free, bible-api.com) and
    // premium (external provider) buckets, de-duped and capped. Unknown
    // public-domain codes are dropped silently (UI migrations pass a mix).
    const requested = data.translations || ['kjv', 'web', 'bbe'];
    const seen = new Set();
    const ordered = [];
    for (const raw of requested) {
      if (isPremiumTranslationId(raw)) {
        if (!seen.has(raw)) { seen.add(raw); ordered.push(raw); }
      } else {
        const norm = normalizeBibleTranslation(raw);
        if (BIBLE_TRANSLATION_IDS.has(norm) && !seen.has(norm)) { seen.add(norm); ordered.push(norm); }
      }
    }
    const translations = ordered.slice(0, MAX_TRANSLATIONS);
    if (translations.length === 0) {
      return res.status(400).json({ message: 'No supported translations requested' });
    }

    // Resolve premium access once if any premium translation was requested.
    const allowPremium = translations.some(isPremiumTranslationId) ? await userHasPremium(req) : false;
    const wholeChapter = verse === undefined || verse === null || verse === '';

    const results = await Promise.allSettled(
      translations.map(async (translationId) => {
        const meta = isPremiumTranslationId(translationId)
          ? { id: translationId }
          : translationMetadata(translationId);
        try {
          if (isPremiumTranslationId(translationId)) {
            if (!allowPremium) return { translation: meta, error: 'Premium required' };
            const chapterData = await getCachedPremiumChapter({ id: translationId, book, chapter });
            return { translation: meta, ...(wholeChapter ? chapterData : sliceVerses(chapterData, verse)) };
          }
          if (wholeChapter) {
            const cached = await getCachedBibleChapter({ book, chapter, translationId });
            return { translation: meta, ...cached };
          }
          const ref = `${book} ${chapter}:${verse}`;
          const json = await getCachedBiblePassage({ ref, translationId });
          return { translation: meta, ...json };
        } catch (err) {
          return { translation: meta, error: err.message || 'Upstream error' };
        }
      })
    );

    res.json({
      passages: results.map((r) =>
        r.status === 'fulfilled' ? r.value : { error: r.reason?.message }
      ),
    });
  } catch (err) {
    next(err);
  }
});

// Stripe checkout
router.post('/createCheckoutSession', authenticateToken, async (req, res, next) => {
  try {
    const stripe = await getStripe();
    if (!stripe) return res.status(503).json({ message: 'Stripe not configured. Set STRIPE_SECRET_KEY.' });
    if (!process.env.STRIPE_PRICE_ID) return res.status(503).json({ message: 'Stripe price not configured.' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const frontendUrl = frontendBaseUrl();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: user.stripeCustomerId || undefined,
      customer_email: user.stripeCustomerId ? undefined : user.email,
      client_reference_id: req.userId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${frontendUrl}/Settings?payment=success`,
      cancel_url: `${frontendUrl}/Pricing?payment=cancelled`,
      metadata: { userId: req.userId },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    next(err);
  }
});

// Stripe webhook — mounted at app level with express.raw() for signature verification.
// The router-level route is kept as a no-op fallback (requests are handled in index.js).
router.post('/stripeWebhook', (_req, res) => {
  res.status(400).json({ message: 'Webhook must be processed at the app level' });
});

// Stripe billing portal — lets users manage their subscription, update payment, cancel, etc.
router.post('/createBillingPortal', authenticateToken, async (req, res, next) => {
  try {
    const stripe = await getStripe();
    if (!stripe) return res.status(503).json({ message: 'Stripe not configured. Set STRIPE_SECRET_KEY.' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const frontendUrl = frontendBaseUrl();

    // Prefer the customer id captured at checkout (survives email changes).
    // Fall back to an email lookup for accounts created before that column
    // existed, and backfill the id so subsequent calls skip the lookup.
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length === 0) {
        return res.status(404).json({ message: 'No billing account found. Have you subscribed to Premium?' });
      }
      customerId = customers.data[0].id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${frontendUrl}/Settings`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

// Grant premium (admin/dev only)
router.post('/grantMePremium', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { premium: true },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Grant a free trial period — the SermonSmith equivalent of GrantFlow's owner
// "free week / free month" comp. Admin/owner only. The timer starts now and we
// set ONLY `premium_until` (never the `premium` flag), so access auto-expires at
// that date with no scheduler and a real paying subscriber is never affected.
//
// Body: { period: 'week' | 'month', ...target }
//   target = { userId } | { email } | { scope: 'all' }   (all = every active user)
// If the user already has a longer free window we keep the later date so a grant
// never shortens an existing trial. The single-user grant path shares this
// MAX/extend logic with the always-on signup trial via lib/premiumGrant.js —
// see grantFreePeriodToUser.
// Persisted state for the GLOBAL "free premium for all users" toggle, so the
// admin switch reflects on/off across sessions. Stored as a singleton row in
// the entity table (admin-only reads/writes via the routes below — never the
// tenant-scoped entity API). Revoking only clears trial windows (premium_until);
// it never touches a paid `premium` subscription.
const GLOBAL_FREE_PREMIUM_ID = 'app-setting-global-free-premium';

async function readGlobalFreePremium() {
  const row = await prisma.entity.findUnique({ where: { id: GLOBAL_FREE_PREMIUM_ID } }).catch(() => null);
  const data = row?.data || {};
  const active = data.active === true && data.expires_at && new Date(data.expires_at) > new Date();
  return { active: !!active, period: data.period || null, expires_at: data.expires_at || null, granted_at: data.granted_at || null };
}

async function writeGlobalFreePremium(data, adminUserId) {
  await prisma.entity.upsert({
    where: { id: GLOBAL_FREE_PREMIUM_ID },
    create: { id: GLOBAL_FREE_PREMIUM_ID, type: 'AppSetting', userId: adminUserId, data: { key: 'global_free_premium', ...data } },
    update: { data: { key: 'global_free_premium', ...data } },
  }).catch(() => null);
}

router.post('/grantFreePeriod', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const isAll = req.body?.scope === 'all';
    const isRevoke = req.body?.revoke === true;

    // ---- Revoke (turn the toggle OFF) ----------------------------------------
    // Clears the comp window only; a paid `premium` subscription is untouched.
    if (isRevoke) {
      if (isAll) {
        const result = await prisma.user.updateMany({
          where: { deletedAt: null, premium_until: { not: null } },
          data: { premium_until: null },
        });
        await writeGlobalFreePremium({ active: false, period: null, expires_at: null }, req.userId);
        return res.json({ scope: 'all', revoked: result.count });
      }
      const where = req.body?.userId ? { id: String(req.body.userId) }
        : req.body?.email ? { email: String(req.body.email).toLowerCase() } : null;
      if (!where) return res.status(400).json({ message: 'Provide userId, email, or scope:"all"' });
      const target = await prisma.user.findUnique({ where });
      if (!target) return res.status(404).json({ message: 'User not found' });
      const updated = await prisma.user.update({ where: { id: target.id }, data: { premium_until: null } });
      return res.json({ userId: updated.id, email: updated.email, revoked: true });
    }

    // ---- Grant (turn the toggle ON) ------------------------------------------
    const period = req.body?.period;
    const days = FREE_PERIOD_DAYS[period];
    if (!days) {
      return res.status(400).json({ message: "period must be 'week' or 'month'" });
    }
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    if (isAll) {
      // Don't shorten anyone's existing longer trial: only push out accounts
      // whose window is null or earlier than the new one.
      const result = await prisma.user.updateMany({
        where: { deletedAt: null, OR: [{ premium_until: null }, { premium_until: { lt: until } }] },
        data: { premium_until: until },
      });
      await writeGlobalFreePremium(
        { active: true, period, granted_at: new Date().toISOString(), expires_at: until.toISOString() },
        req.userId,
      );
      return res.json({ scope: 'all', period, granted: result.count, premium_until: until });
    }

    const { userId, email } = req.body || {};
    const where = userId ? { id: String(userId) } : email ? { email: String(email).toLowerCase() } : null;
    if (!where) {
      return res.status(400).json({ message: 'Provide userId, email, or scope:"all"' });
    }
    const target = await prisma.user.findUnique({ where });
    if (!target || target.deletedAt) {
      return res.status(404).json({ message: 'User not found' });
    }
    const updated = await grantFreePeriodToUser(prisma, target.id, period);
    res.json({ userId: updated.id, email: updated.email, period, premium_until: updated.premium_until });
  } catch (err) {
    next(err);
  }
});

// Current state of the global free-premium toggle (drives the admin switch).
router.post('/getGlobalFreePremium', authenticateToken, requireAdmin, async (_req, res, next) => {
  try {
    res.json(await readGlobalFreePremium());
  } catch (err) {
    next(err);
  }
});

// List users (admin)
router.post('/listUsers', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    // Bound the result set (see GET /auth/users). Accepts limit/offset from the
    // body since this is a POST-style function call.
    const limit = Math.min(Math.max(parseInt(req.body?.limit, 10) || 100, 1), 500);
    const offset = Math.max(parseInt(req.body?.offset, 10) || 0, 0);
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true, email: true, name: true, full_name: true,
        role: true, premium: true, premium_until: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Import status
// ---------------------------------------------------------------------------
// Background Bible-import jobs.
//
// A full-Bible walk is 1,189 chapters with per-chapter fetch + a throttle
// sleep — several MINUTES, far longer than any HTTP/proxy timeout. Holding the
// request open meant the admin always saw a 502 even though the import kept
// running server-side (the exact thing that invited a re-click → duplicates).
// We now run the walk DETACHED and report progress via getImportStatus.
// ---------------------------------------------------------------------------
const _importJobs = new Map(); // translation -> progress record

function importJobView(translation) {
  const job = _importJobs.get(translation);
  return job ? { translation, ...job } : null;
}

// Start a detached import. The worker mutates the shared job record as it goes;
// it never throws into the request and never blocks the response.
function startImportJob(translation, total, worker) {
  const job = {
    status: 'running', imported: 0, errors: 0, total,
    startedAt: new Date().toISOString(), finishedAt: null, message: null,
  };
  _importJobs.set(translation, job);
  Promise.resolve()
    .then(() => worker(job))
    .then(() => { job.status = 'complete'; job.message = `Imported ${job.imported} verses (${job.errors} chapter errors)`; })
    .catch((err) => { job.status = 'failed'; job.message = err?.message || 'Import failed'; })
    .finally(() => { job.finishedAt = new Date().toISOString(); });
  return job;
}

router.post('/getImportStatus', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const translation = req.body?.translation
      ? String(req.body.translation).trim().toLowerCase()
      : null;
    const where = translation
      ? { type: 'Verse', data: { path: ['translation'], equals: translation } }
      : { type: 'Verse' };
    const count = await prisma.entity.count({ where });
    const job = translation ? importJobView(translation) : null;
    res.json({
      totalVerses: count,
      status: job?.status || (count > 0 ? 'complete' : 'pending'),
      job,
    });
  } catch (err) {
    next(err);
  }
});

// Latest activity timestamp per user, in ONE aggregate query. The admin Users
// page previously fetched this per-user in a sequential loop (an N+1 — up to
// 1000 round-trips on page load); this collapses it to a single GROUP BY.
router.post('/getUsersLastActivity', authenticateToken, requireAdmin, async (_req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT data->>'user_id' AS user_id, MAX(created_at) AS last_at
      FROM entities
      WHERE type = 'UserActivity' AND data->>'user_id' IS NOT NULL
      GROUP BY data->>'user_id'`;
    const map = {};
    for (const row of rows) {
      if (row.user_id) map[row.user_id] = row.last_at;
    }
    res.json(map);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Shareable links — create a SharedLink entity with a unique slug
// ---------------------------------------------------------------------------
const shareLinkCreateSchema = z.object({
  resourceType: z.string().trim().min(1).max(80),
  resourceId: z.string().trim().min(1).max(200),
  title: z.string().trim().max(200).optional().default(''),
  description: z.string().trim().max(2000).optional().default(''),
  // Public share pages are intentionally read-only. Do not advertise or store
  // an unenforced "copy/edit" permission.
  accessLevel: z.literal('view').optional().default('view'),
  expiresInDays: z.coerce.number().int().min(1).max(365).nullable().optional(),
}).strict();

function shareUrlForSlug(slug) {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${frontendUrl}/SharedContent?link=${encodeURIComponent(slug)}`;
}

function formatOwnedShareLink(row) {
  return {
    id: row.id,
    slug: row.data?.slug,
    resourceType: row.data?.resourceType,
    resourceId: row.data?.resourceId,
    title: row.data?.title || '',
    description: row.data?.description || '',
    accessLevel: 'view',
    expiresAt: row.data?.expiresAt || null,
    views: Number(row.data?.views || 0),
    shareUrl: shareUrlForSlug(row.data?.slug || ''),
    createdAt: row.createdAt,
  };
}

router.post('/createShareableLink', authenticateToken, async (req, res, next) => {
  try {
    const parsed = shareLinkCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid share-link request', issues: parsed.error.issues });
    }
    const { resourceType, resourceId, title, description, accessLevel, expiresInDays } = parsed.data;

    // Verify the resource exists and belongs to the user
    const resource = await prisma.entity.findUnique({ where: { id: resourceId } });
    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }
    if (resource.userId !== req.userId) {
      return res.status(403).json({ message: 'You can only share your own content' });
    }
    // The stored type is authoritative — a client-supplied resourceType that
    // disagrees with it must not decide how (or whether) the resource is gated.
    if (resourceType !== resource.type) {
      return res.status(400).json({ message: 'resourceType does not match the resource.' });
    }

    // Scripture gate for the exposure surface: a share link makes the resource
    // publicly readable via /api/community/share/:slug WITHOUT going through the
    // entity save gate. Re-validate the resource's CURRENT stored content and
    // refuse to mint a link for a gated resource whose references do not all
    // verify (the serve path re-checks too, so an edit-to-invalid after link
    // creation is also caught). Owner denomination drives the canon.
    const shareDenomination = resource.data?.denomination
      || (await prisma.user.findUnique({ where: { id: resource.userId }, select: { profile: true } }))?.profile?.denomination
      || '';
    assertGatedResourceExposable({ type: resource.type, resourceData: resource.data, denomination: shareDenomination });

    // 144 random bits makes an unlisted link infeasible to guess. The previous
    // timestamp + Math.random suffix was both predictable and too short for a
    // URL that grants anonymous access to otherwise private content.
    const slug = `${resourceType.toLowerCase()}-${crypto.randomBytes(18).toString('base64url')}`;
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;

    const link = await prisma.entity.create({
      data: {
        type: 'SharedLink',
        userId: req.userId,
        data: {
          slug,
          resourceType,
          resourceId,
          title: title || '',
          description: description || '',
          accessLevel: accessLevel || 'view',
          expiresAt,
          views: 0,
          user_id: req.userId,
          created_date: new Date().toISOString(),
        },
      },
    });

    res.json({ ...formatOwnedShareLink(link), shareUrl: shareUrlForSlug(slug) });
  } catch (err) {
    next(err);
  }
});

// Owners can enumerate and revoke every link for one of their resources. This
// remains available after a subscription/promotion expires because revoking
// anonymous access is a privacy control, not a Premium benefit.
router.get('/share-links', authenticateToken, async (req, res, next) => {
  try {
    const resourceId = String(req.query.resourceId || '').trim();
    if (!resourceId || resourceId.length > 200) {
      return res.status(400).json({ message: 'A valid resourceId is required' });
    }
    const resource = await prisma.entity.findUnique({ where: { id: resourceId } });
    if (!resource || resource.userId !== req.userId) {
      return res.status(404).json({ message: 'Owned resource not found' });
    }
    const rows = await prisma.entity.findMany({
      where: {
        type: 'SharedLink',
        userId: req.userId,
        data: { path: ['resourceId'], equals: resourceId },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ links: rows.map(formatOwnedShareLink) });
  } catch (err) {
    next(err);
  }
});

router.delete('/share-links/:id', authenticateToken, async (req, res, next) => {
  try {
    const link = await prisma.entity.findUnique({ where: { id: req.params.id } });
    // Return one not-found shape for missing and foreign links so ids cannot be
    // used as an ownership oracle.
    if (!link || link.type !== 'SharedLink' || link.userId !== req.userId) {
      return res.status(404).json({ message: 'Owned share link not found' });
    }
    await prisma.entity.delete({ where: { id: link.id } });
    await prisma.auditLog?.create({
      data: {
        userId: req.userId,
        action: 'sharing.link_revoke',
        targetType: 'SharedLink',
        targetId: link.id,
        metadata: { resourceId: link.data?.resourceId, slug: link.data?.slug },
      },
    }).catch(() => null);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// API diagnostics — replaces Base44-era "discoverFunctions" for the
// FunctionReviewer admin page. Returns a map of all backend routes/endpoints.
// ---------------------------------------------------------------------------
router.post('/discoverFunctions', authenticateToken, requireAdmin, requireDevTools, async (req, res) => {
  const functions = [
    { id: 'biblePassage', name: 'Bible Passage', description: 'Fetch a Bible passage from bible-api.com', category: 'bible', path: 'routes/functions.js' },
    { id: 'verifyVerseWording', name: 'Verify Verse Wording', description: 'Compare quoted wording to registered provider text', category: 'bible', path: 'routes/functions.js' },
    { id: 'listAvailableTranslations', name: 'List Translations', description: 'Return available Bible translations', category: 'bible', path: 'routes/functions.js' },
    { id: 'getPassageMultiSource', name: 'Multi-Source Passage', description: 'Fetch a passage across multiple translations', category: 'bible', path: 'routes/functions.js' },
    { id: 'createCheckoutSession', name: 'Stripe Checkout', description: 'Create a Stripe checkout session for Premium', category: 'billing', path: 'routes/functions.js' },
    { id: 'createBillingPortal', name: 'Billing Portal', description: 'Open Stripe billing portal for subscription management', category: 'billing', path: 'routes/functions.js' },
    { id: 'grantMePremium', name: 'Grant Premium', description: 'Admin: grant premium status to current user', category: 'admin', path: 'routes/functions.js' },
    { id: 'listUsers', name: 'List Users', description: 'Admin: list all registered users', category: 'admin', path: 'routes/functions.js' },
    { id: 'getImportStatus', name: 'Import Status', description: 'Check how many verses are imported', category: 'bible', path: 'routes/functions.js' },
    { id: 'importFullBible', name: 'Import Full Bible', description: 'Bulk-import KJV from bible-api.com', category: 'bible', path: 'routes/functions.js' },
    { id: 'createShareableLink', name: 'Create Share Link', description: 'Generate a shareable link for a resource', category: 'sharing', path: 'routes/functions.js' },
    { id: 'testAllFunctions', name: 'Test All Functions', description: 'Run health checks on all endpoints', category: 'admin', path: 'routes/functions.js' },
  ];

  const pages = [
    { id: 'Home', name: 'Home', path: 'pages/Home.jsx' },
    { id: 'SermonBuilder', name: 'Sermon Builder', path: 'pages/SermonBuilder.jsx' },
    { id: 'SermonLibrary', name: 'Sermon Library', path: 'pages/SermonLibrary.jsx' },
    { id: 'BibleStudy', name: 'Bible Study', path: 'pages/BibleStudy.jsx' },
    { id: 'Reader', name: 'Bible Reader', path: 'pages/Reader.jsx' },
    { id: 'BibleMaps', name: 'Bible Maps', path: 'pages/BibleMaps.jsx' },
    { id: 'ChristianEthics', name: 'Christian Ethics', path: 'pages/ChristianEthics.jsx' },
    { id: 'WorldviewExplorer', name: 'Worldview Explorer', path: 'pages/WorldviewExplorer.jsx' },
    { id: 'PrayerGenerator', name: 'Prayer Generator', path: 'pages/PrayerGenerator.jsx' },
    { id: 'QuizBuilder', name: 'Quiz Builder', path: 'pages/QuizBuilder.jsx' },
    { id: 'Forum', name: 'Forum', path: 'pages/Forum.jsx' },
    { id: 'StudyGroups', name: 'Study Groups', path: 'pages/StudyGroups.jsx' },
    { id: 'Settings', name: 'Settings', path: 'pages/Settings.jsx' },
    { id: 'Pricing', name: 'Pricing', path: 'pages/Pricing.jsx' },
    { id: 'ContactSupport', name: 'Contact Support', path: 'pages/ContactSupport.jsx' },
  ];

  const entities = [
    { id: 'Sermon', name: 'Sermon', path: 'entities/Sermon' },
    { id: 'Series', name: 'Series', path: 'entities/Series' },
    { id: 'StudyNote', name: 'Study Note', path: 'entities/StudyNote' },
    { id: 'Quiz', name: 'Quiz', path: 'entities/Quiz' },
    { id: 'Message', name: 'Support Message', path: 'entities/Message' },
    { id: 'SharedContent', name: 'Shared Content', path: 'entities/SharedContent' },
    { id: 'SharedLink', name: 'Shared Link', path: 'entities/SharedLink' },
    { id: 'ForumPost', name: 'Forum Post', path: 'entities/ForumPost' },
    { id: 'StudyGroup', name: 'Study Group', path: 'entities/StudyGroup' },
    { id: 'ActivityLog', name: 'Activity Log', path: 'entities/ActivityLog' },
  ];

  res.json({
    ok: true,
    data: {
      functions,
      pages,
      components: [],
      entities,
      other: [],
      totals: {
        functions: functions.length,
        pages: pages.length,
        entities: entities.length,
        all: functions.length + pages.length + entities.length,
      },
    },
  });
});

// ---------------------------------------------------------------------------
// Get function details — returns metadata for a specific function/route
// ---------------------------------------------------------------------------
router.post('/getFunctionDetails', authenticateToken, requireAdmin, requireDevTools, async (req, res) => {
  const { functionId } = req.body;
  if (!functionId) {
    return res.status(400).json({ message: 'functionId is required' });
  }

  // Simple metadata lookup — in a serverless architecture this would read the
  // source file; for a self-hosted Express app we return route documentation.
  const details = {
    biblePassage: { code: '// Proxies bible-api.com — see routes/functions.js:13', method: 'POST', auth: 'optional' },
    verifyVerseWording: { code: '// Provider wording compare — see routes/functions.js', method: 'POST', auth: 'optional' },
    listAvailableTranslations: { code: '// Returns Bible source registry metadata — see routes/functions.js', method: 'POST', auth: 'optional' },
    getPassageMultiSource: { code: '// Parallel multi-translation fetch — see routes/functions.js:74', method: 'POST', auth: 'optional' },
    createCheckoutSession: { code: '// Stripe checkout — see routes/functions.js:107', method: 'POST', auth: 'required' },
    createBillingPortal: { code: '// Stripe billing portal — see routes/functions.js:137', method: 'POST', auth: 'required' },
    grantMePremium: { code: '// Admin premium grant — see routes/functions.js:162', method: 'POST', auth: 'admin' },
    importFullBible: { code: '// Bulk Bible import — see routes/functions.js', method: 'POST', auth: 'required' },
    createShareableLink: { code: '// Share link generator — see routes/functions.js', method: 'POST', auth: 'required' },
    testAllFunctions: { code: '// Health check runner — see routes/functions.js', method: 'POST', auth: 'admin' },
  };

  const meta = details[functionId];
  if (!meta) {
    return res.json({ ok: true, data: { id: functionId, code: '// No source available for this function', method: 'POST', auth: 'unknown' } });
  }

  res.json({ ok: true, data: { id: functionId, ...meta } });
});

// ---------------------------------------------------------------------------
// Test all functions — lightweight health check for admin diagnostics
// ---------------------------------------------------------------------------
router.post('/testAllFunctions', authenticateToken, requireAdmin, async (_req, res) => {
  const checks = [];

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: 'Database', status: 'pass' });
  } catch {
    checks.push({ name: 'Database', status: 'fail', error: 'Cannot reach PostgreSQL' });
  }

  // Check Bible API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch('https://bible-api.com/john 3:16', { signal: controller.signal });
    clearTimeout(timeout);
    checks.push({ name: 'Bible API', status: resp.ok ? 'pass' : 'fail' });
  } catch {
    checks.push({ name: 'Bible API', status: 'fail', error: 'Unreachable' });
  }

  // Check OpenAI
  checks.push({
    name: 'OpenAI API Key',
    status: process.env.OPENAI_API_KEY ? 'pass' : 'warn',
    ...(process.env.OPENAI_API_KEY ? {} : { error: 'Not configured' }),
  });

  // Check Stripe — does NOT instantiate the SDK; just inspects the env.
  const billingConfigured = Boolean(process.env.STRIPE_SECRET_KEY) && process.env.DISABLE_BILLING !== '1';
  checks.push({
    name: 'Stripe',
    status: billingConfigured ? 'pass' : 'warn',
    ...(billingConfigured ? {} : { error: 'Not configured' }),
  });

  // LIVE OpenAI checks. The old suite only checked that a key STRING existed —
  // it reported "all passed" even while real AI calls were 502-ing and image
  // generation was failing with "model 'dall-e-3' does not exist". These two
  // checks actually hit OpenAI (cheaply) so the suite reflects real health.
  if (process.env.OPENAI_API_KEY && process.env.DISABLE_AI !== '1') {
    // (1) A tiny live completion confirms the key works (catches 401/quota).
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Reply with the word OK.' }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      checks.push({ name: 'OpenAI Chat (live)', status: resp.ok ? 'pass' : 'fail', ...(resp.ok ? {} : { error: `HTTP ${resp.status}` }) });
    } catch (e) {
      checks.push({ name: 'OpenAI Chat (live)', status: 'fail', error: e.name === 'AbortError' ? 'Timed out' : 'Unreachable' });
    }

    // (2) Confirm the configured image model actually exists for this account.
    const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(imageModel)}`, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      checks.push({
        name: `Image model (${imageModel})`,
        status: resp.ok ? 'pass' : 'fail',
        ...(resp.ok ? {} : { error: resp.status === 404 ? 'Not available to this account' : `HTTP ${resp.status}` }),
      });
    } catch (e) {
      checks.push({ name: `Image model (${imageModel})`, status: 'fail', error: e.name === 'AbortError' ? 'Timed out' : 'Unreachable' });
    }
  }

  // Premium translation catalogue (external provider).
  try {
    const premium = await listPremiumTranslationsDetailed();
    const status = premium.degraded ? 'warn' : premium.list.length > 0 ? 'pass' : 'warn';
    checks.push({
      name: 'Premium translations',
      status,
      ...(premium.degraded
        ? { error: 'External catalogue unreachable (degraded to free-only)' }
        : premium.stale
          ? { error: 'Serving stale cached catalogue (upstream unreachable)' }
          : premium.list.length > 0
            ? {}
            : { error: 'No external catalogue (free tier only)' }),
    });
  } catch {
    checks.push({ name: 'Premium translations', status: 'warn', error: 'Catalogue fetch failed' });
  }

  const passed = checks.filter(c => c.status === 'pass').length;
  const failed = checks.filter(c => c.status === 'fail').length;

  res.json({
    ok: failed === 0,
    data: { checked: checks.length, passed, failed, results: checks },
  });
});

// ---------------------------------------------------------------------------
// Import full Bible from bible-api.com — fetches all 66 books chapter by
// chapter and stores them as Verse entities.
// ---------------------------------------------------------------------------
const BIBLE_BOOKS = [
  { name: 'Genesis', chapters: 50 }, { name: 'Exodus', chapters: 40 }, { name: 'Leviticus', chapters: 27 },
  { name: 'Numbers', chapters: 36 }, { name: 'Deuteronomy', chapters: 34 }, { name: 'Joshua', chapters: 24 },
  { name: 'Judges', chapters: 21 }, { name: 'Ruth', chapters: 4 }, { name: '1 Samuel', chapters: 31 },
  { name: '2 Samuel', chapters: 24 }, { name: '1 Kings', chapters: 22 }, { name: '2 Kings', chapters: 25 },
  { name: '1 Chronicles', chapters: 29 }, { name: '2 Chronicles', chapters: 36 }, { name: 'Ezra', chapters: 10 },
  { name: 'Nehemiah', chapters: 13 }, { name: 'Esther', chapters: 10 }, { name: 'Job', chapters: 42 },
  { name: 'Psalms', chapters: 150 }, { name: 'Proverbs', chapters: 31 }, { name: 'Ecclesiastes', chapters: 12 },
  { name: 'Song of Solomon', chapters: 8 }, { name: 'Isaiah', chapters: 66 }, { name: 'Jeremiah', chapters: 52 },
  { name: 'Lamentations', chapters: 5 }, { name: 'Ezekiel', chapters: 48 }, { name: 'Daniel', chapters: 12 },
  { name: 'Hosea', chapters: 14 }, { name: 'Joel', chapters: 3 }, { name: 'Amos', chapters: 9 },
  { name: 'Obadiah', chapters: 1 }, { name: 'Jonah', chapters: 4 }, { name: 'Micah', chapters: 7 },
  { name: 'Nahum', chapters: 3 }, { name: 'Habakkuk', chapters: 3 }, { name: 'Zephaniah', chapters: 3 },
  { name: 'Haggai', chapters: 2 }, { name: 'Zechariah', chapters: 14 }, { name: 'Malachi', chapters: 4 },
  { name: 'Matthew', chapters: 28 }, { name: 'Mark', chapters: 16 }, { name: 'Luke', chapters: 24 },
  { name: 'John', chapters: 21 }, { name: 'Acts', chapters: 28 }, { name: 'Romans', chapters: 16 },
  { name: '1 Corinthians', chapters: 16 }, { name: '2 Corinthians', chapters: 13 }, { name: 'Galatians', chapters: 6 },
  { name: 'Ephesians', chapters: 6 }, { name: 'Philippians', chapters: 4 }, { name: 'Colossians', chapters: 4 },
  { name: '1 Thessalonians', chapters: 5 }, { name: '2 Thessalonians', chapters: 3 }, { name: '1 Timothy', chapters: 6 },
  { name: '2 Timothy', chapters: 4 }, { name: 'Titus', chapters: 3 }, { name: 'Philemon', chapters: 1 },
  { name: 'Hebrews', chapters: 13 }, { name: 'James', chapters: 5 }, { name: '1 Peter', chapters: 5 },
  { name: '2 Peter', chapters: 3 }, { name: '1 John', chapters: 5 }, { name: '2 John', chapters: 1 },
  { name: '3 John', chapters: 1 }, { name: 'Jude', chapters: 1 }, { name: 'Revelation', chapters: 22 },
];

router.post('/importFullBible', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const translation = requireBibleTranslation(req.body.translation || 'kjv').id;

    // Idempotency guard. `Verse` is a world-readable (PUBLIC_TYPES) entity and
    // these inserts use create (not upsert), so re-running — e.g. an impatient
    // admin re-clicking after the request appears to hang — would insert a
    // SECOND full copy (~31k rows) that every user then sees doubled. Refuse if
    // this translation is already imported unless `force: true` is passed.
    const existingCount = await prisma.entity.count({
      where: { type: 'Verse', data: { path: ['translation'], equals: translation } },
    });
    if (existingCount > 0 && req.body.force !== true) {
      return res.status(409).json({
        message: `'${translation}' already has ${existingCount} imported verses. Pass { force: true } to re-import (this will create duplicates unless you clear the existing rows first).`,
        translation,
        existingCount,
      });
    }

    // Don't run two imports for the same translation at once.
    if (_importJobs.get(translation)?.status === 'running') {
      return res.status(409).json({ message: `An import for '${translation}' is already running.`, job: importJobView(translation) });
    }

    const total = BIBLE_BOOKS.reduce((sum, b) => sum + b.chapters, 0);
    const userId = req.userId;
    startImportJob(translation, total, async (job) => {
      for (const book of BIBLE_BOOKS) {
        for (let ch = 1; ch <= book.chapters; ch++) {
          try {
            const ref = `${book.name} ${ch}`;
            // Reuse the unambiguous provider helper so single-chapter books
            // cannot be imported as verse 1 only.
            const data = await fetchBibleApiJson(ref, translation, 15000);
            const resolvedBook = bookByName(book.name);
            const normalized = normalizeBibleApiChapter(data, resolvedBook, ch, translation);
            const expected = expectedVerseCountForCompleteness(resolvedBook, ch, translation);
            if (expected && !hasEveryExpectedVerse(normalized, expected)) {
              job.errors++;
              continue;
            }

            if (normalized.verses.length > 0) {
              const chapterVerseCount = normalized.verses.length;
              await prisma.$transaction(
                normalized.verses.map(v =>
                  prisma.entity.create({
                    data: {
                      type: 'Verse',
                      userId,
                      data: {
                        book_name: book.name,
                        chapter: ch,
                        verse: v.verse,
                        text: v.text,
                        translation,
                        chapter_complete: true,
                        chapter_verse_count: chapterVerseCount,
                        import_format_version: 2,
                        user_id: userId,
                        created_date: new Date().toISOString(),
                      },
                    },
                  })
                )
              );
              job.imported += normalized.verses.length;
            }

            // Small delay to avoid hammering the API
            await new Promise(r => setTimeout(r, 200));
          } catch {
            job.errors++;
          }
        }
      }
    });

    // 202 Accepted — the walk runs in the background; the admin UI polls
    // getImportStatus({ translation }) for progress instead of waiting here.
    res.status(202).json({
      message: `Import started for '${translation}'. Poll getImportStatus for progress.`,
      translation,
      job: importJobView(translation),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Import from Scripture API (api.scripture.api.bible)
// ---------------------------------------------------------------------------
router.post('/importFromScriptureAPI', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const apiKey = process.env.SCRIPTURE_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ message: 'SCRIPTURE_API_KEY not configured. Get a free key at scripture.api.bible' });
    }

    const bibleId = req.body.bibleId || 'de4e12af7f28f599-02'; // KJV
    // Label rows by the actual Bible being imported, not a hardcoded 'kjv'
    // (which mislabeled every non-KJV import and let them collide).
    const translation = String(req.body.translation || bibleId).toLowerCase();
    const baseUrl = `https://api.scripture.api.bible/v1/bibles/${bibleId}`;
    const headers = { 'api-key': apiKey };

    // Idempotency guard — see importFullBible. Prevents a re-run from inserting
    // a second full copy of world-readable Verse rows.
    const existingCount = await prisma.entity.count({
      where: { type: 'Verse', data: { path: ['translation'], equals: translation } },
    });
    if (existingCount > 0 && req.body.force !== true) {
      return res.status(409).json({
        message: `'${translation}' already has ${existingCount} imported verses. Pass { force: true } to re-import.`,
        translation,
        existingCount,
      });
    }
    if (_importJobs.get(translation)?.status === 'running') {
      return res.status(409).json({ message: `An import for '${translation}' is already running.`, job: importJobView(translation) });
    }

    // Fetch the book list synchronously so we can fail fast on a bad key/bibleId
    // (502) before backgrounding the long per-chapter walk.
    const booksResp = await fetch(`${baseUrl}/books`, { headers });
    if (!booksResp.ok) {
      return res.status(502).json({ message: `Scripture API returned ${booksResp.status}` });
    }
    const { data: books } = await booksResp.json();
    const userId = req.userId;

    startImportJob(translation, books.length, async (job) => {
      for (const book of books) {
        try {
          const chaptersResp = await fetch(`${baseUrl}/books/${book.id}/chapters`, { headers });
          if (!chaptersResp.ok) { job.errors++; continue; }
          const { data: chapters } = await chaptersResp.json();

          for (const chapter of chapters) {
            if (chapter.id === `${book.id}.intro`) continue; // skip intro sections
            try {
              const verseResp = await fetch(`${baseUrl}/chapters/${chapter.id}/verses`, { headers });
              if (!verseResp.ok) { job.errors++; continue; }
              const { data: verses } = await verseResp.json();

              if (verses && verses.length > 0) {
                await prisma.$transaction(
                  verses.map(v =>
                    prisma.entity.create({
                      data: {
                        type: 'Verse',
                        userId,
                        data: {
                          book_name: book.name,
                          chapter: parseInt(chapter.number) || 0,
                          verse: parseInt(v.reference?.split(':')[1]) || 0,
                          text: v.text || '',
                          translation,
                          scripture_api_id: v.id,
                          user_id: userId,
                          created_date: new Date().toISOString(),
                        },
                      },
                    })
                  )
                );
                job.imported += verses.length;
              }

              await new Promise(r => setTimeout(r, 100));
            } catch {
              job.errors++;
            }
          }
        } catch {
          job.errors++;
        }
      }
    });

    res.status(202).json({
      message: `Import started for '${translation}'. Poll getImportStatus for progress.`,
      translation,
      job: importJobView(translation),
    });
  } catch (err) {
    next(err);
  }
});

// Sets premium on/off for the account behind a Stripe customer id. Prefers the
// stored stripeCustomerId (stable across email changes); falls back to an email
// match for accounts that subscribed before that column was captured.
async function setPremiumForCustomer(stripe, customerId, premium) {
  if (!customerId) return;
  const byCustomer = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } }).catch(() => null);
  if (byCustomer) {
    await prisma.user.update({ where: { id: byCustomer.id }, data: { premium } });
    return;
  }
  const customer = await stripe.customers.retrieve(customerId).catch(() => null);
  if (customer?.email) {
    await prisma.user.updateMany({ where: { email: customer.email.toLowerCase() }, data: { premium } });
  }
}

// Exported so index.js can mount it with express.raw() for signature verification
export async function handleStripeWebhook(req, res) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ message: 'Stripe webhooks not configured' });
  }
  const stripe = await getStripe();
  if (!stripe) {
    return res.status(503).json({ message: 'Stripe webhooks not configured' });
  }

  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // Never log the body — Stripe payloads carry customer email and PII.
    console.error('[Stripe Webhook] signature verification failed:', err.message);
    return res.status(400).json({ message: 'Invalid signature' });
  }

  // Idempotency: short-circuit duplicate deliveries. Stripe will retry on
  // any non-2xx, so we must record `processed` AFTER the side effect
  // succeeds — recording before-the-fact would mean a transient downstream
  // failure leaves the event "seen but never applied".
  const existing = await prisma.stripeEvent.findUnique({ where: { stripeEventId: event.id } }).catch(() => null);
  if (existing) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data?.object;
        const userId = session?.metadata?.userId;
        if (userId) {
          // Capture the Stripe customer id (set server-side at session creation
          // via metadata.userId, so this is trusted) so cancellation can later
          // downgrade this exact account by id rather than by email.
          await prisma.user.update({
            where: { id: userId },
            data: { premium: true, ...(session.customer ? { stripeCustomerId: session.customer } : {}) },
          });
        }
        break;
      }
      case 'customer.subscription.updated': {
        // Fires on any subscription change: renewal, plan switch, entering a
        // dunning state, or a scheduled cancel taking effect. Keep premium in
        // sync with the live status rather than waiting for the delete event —
        // 'active'/'trialing'/'past_due' (grace period) keep access; anything
        // else (canceled, unpaid, paused, incomplete_expired) revokes it.
        const sub = event.data?.object;
        const grantsAccess = ['active', 'trialing', 'past_due'].includes(sub?.status);
        await setPremiumForCustomer(stripe, sub?.customer, grantsAccess);
        break;
      }
      case 'customer.subscription.deleted':
      case 'customer.subscription.canceled': {
        const sub = event.data?.object;
        await setPremiumForCustomer(stripe, sub?.customer, false);
        break;
      }
      default:
        // Unknown event types are accepted (Stripe expects 2xx) but not acted on.
        break;
    }
  } catch (err) {
    console.error('[Stripe Webhook] processing failed:', err.message);
    // Returning 500 here lets Stripe retry. We deliberately do NOT mark
    // the event processed.
    return res.status(500).json({ message: 'Webhook processing failed' });
  }

  // Mark processed only after success.
  try {
    await prisma.stripeEvent.create({ data: { stripeEventId: event.id, type: event.type } });
  } catch (e) {
    if (e.code !== 'P2002') {
      console.error('[Stripe Webhook] failed to record processed event:', e.message);
    }
  }

  res.json({ received: true });
}

// Test-only export so unit tests can drive the SDK lookup.
export const __test = { getStripe };

export default router;
