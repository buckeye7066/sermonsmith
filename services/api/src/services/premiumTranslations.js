// Premium (external) Bible translation catalogue + passage fetching.
//
// The free tier is the 8 public-domain bibles in bibleSources.js (served from
// bible-api.com). The PREMIUM tier is a much larger multilingual catalogue
// pulled from an external provider, gated to paying accounts:
//
//   - API.Bible (api.scripture.api.bible) when `API_BIBLE_KEY` is set →
//     ~2,500 versions across 1,600+ languages (the "1000+ translations in
//     200+ languages" the marketing promises).
//   - getBible.net otherwise (no API key required) → ~70 translations across
//     ~50 languages. This means premium is a REAL, working feature out of the
//     box without any owner configuration; setting the key upgrades it to the
//     full catalogue.
//
// Everything is normalized to the exact shape the Reader consumes, and premium
// translation ids are namespaced (`gb:` / `ab:`) so they can never collide
// with the bare public-domain ids (e.g. getBible also has a "kjv").
//
// Set `DISABLE_PREMIUM_TRANSLATIONS=1` to turn the premium tier off entirely
// (then only the 8 free bibles are offered and the upsell hides).

const PREMIUM_CACHE_TTL_MS = Number(process.env.PREMIUM_TRANSLATIONS_TTL_MS || 6 * 60 * 60 * 1000);
const GETBIBLE_BASE = 'https://api.getbible.net/v2';
const API_BIBLE_BASE = 'https://api.scripture.api.bible/v1';

// 66-book Protestant canon. `number` is getBible's 1-based book index;
// `osis` is the API.Bible / OSIS book code.
export const BOOKS = [
  { name: 'Genesis', number: 1, osis: 'GEN' },
  { name: 'Exodus', number: 2, osis: 'EXO' },
  { name: 'Leviticus', number: 3, osis: 'LEV' },
  { name: 'Numbers', number: 4, osis: 'NUM' },
  { name: 'Deuteronomy', number: 5, osis: 'DEU' },
  { name: 'Joshua', number: 6, osis: 'JOS' },
  { name: 'Judges', number: 7, osis: 'JDG' },
  { name: 'Ruth', number: 8, osis: 'RUT' },
  { name: '1 Samuel', number: 9, osis: '1SA' },
  { name: '2 Samuel', number: 10, osis: '2SA' },
  { name: '1 Kings', number: 11, osis: '1KI' },
  { name: '2 Kings', number: 12, osis: '2KI' },
  { name: '1 Chronicles', number: 13, osis: '1CH' },
  { name: '2 Chronicles', number: 14, osis: '2CH' },
  { name: 'Ezra', number: 15, osis: 'EZR' },
  { name: 'Nehemiah', number: 16, osis: 'NEH' },
  { name: 'Esther', number: 17, osis: 'EST' },
  { name: 'Job', number: 18, osis: 'JOB' },
  { name: 'Psalms', number: 19, osis: 'PSA' },
  { name: 'Proverbs', number: 20, osis: 'PRO' },
  { name: 'Ecclesiastes', number: 21, osis: 'ECC' },
  { name: 'Song of Solomon', number: 22, osis: 'SNG' },
  { name: 'Isaiah', number: 23, osis: 'ISA' },
  { name: 'Jeremiah', number: 24, osis: 'JER' },
  { name: 'Lamentations', number: 25, osis: 'LAM' },
  { name: 'Ezekiel', number: 26, osis: 'EZK' },
  { name: 'Daniel', number: 27, osis: 'DAN' },
  { name: 'Hosea', number: 28, osis: 'HOS' },
  { name: 'Joel', number: 29, osis: 'JOL' },
  { name: 'Amos', number: 30, osis: 'AMO' },
  { name: 'Obadiah', number: 31, osis: 'OBA' },
  { name: 'Jonah', number: 32, osis: 'JON' },
  { name: 'Micah', number: 33, osis: 'MIC' },
  { name: 'Nahum', number: 34, osis: 'NAM' },
  { name: 'Habakkuk', number: 35, osis: 'HAB' },
  { name: 'Zephaniah', number: 36, osis: 'ZEP' },
  { name: 'Haggai', number: 37, osis: 'HAG' },
  { name: 'Zechariah', number: 38, osis: 'ZEC' },
  { name: 'Malachi', number: 39, osis: 'MAL' },
  { name: 'Matthew', number: 40, osis: 'MAT' },
  { name: 'Mark', number: 41, osis: 'MRK' },
  { name: 'Luke', number: 42, osis: 'LUK' },
  { name: 'John', number: 43, osis: 'JHN' },
  { name: 'Acts', number: 44, osis: 'ACT' },
  { name: 'Romans', number: 45, osis: 'ROM' },
  { name: '1 Corinthians', number: 46, osis: '1CO' },
  { name: '2 Corinthians', number: 47, osis: '2CO' },
  { name: 'Galatians', number: 48, osis: 'GAL' },
  { name: 'Ephesians', number: 49, osis: 'EPH' },
  { name: 'Philippians', number: 50, osis: 'PHP' },
  { name: 'Colossians', number: 51, osis: 'COL' },
  { name: '1 Thessalonians', number: 52, osis: '1TH' },
  { name: '2 Thessalonians', number: 53, osis: '2TH' },
  { name: '1 Timothy', number: 54, osis: '1TI' },
  { name: '2 Timothy', number: 55, osis: '2TI' },
  { name: 'Titus', number: 56, osis: 'TIT' },
  { name: 'Philemon', number: 57, osis: 'PHM' },
  { name: 'Hebrews', number: 58, osis: 'HEB' },
  { name: 'James', number: 59, osis: 'JAS' },
  { name: '1 Peter', number: 60, osis: '1PE' },
  { name: '2 Peter', number: 61, osis: '2PE' },
  { name: '1 John', number: 62, osis: '1JN' },
  { name: '2 John', number: 63, osis: '2JN' },
  { name: '3 John', number: 64, osis: '3JN' },
  { name: 'Jude', number: 65, osis: 'JUD' },
  { name: 'Revelation', number: 66, osis: 'REV' },
];

const BOOK_BY_NAME = new Map(BOOKS.map((b) => [b.name.toLowerCase(), b]));
// OSIS / Paratext 3-letter codes (GEN, JHN, ACT…). The Reader identifies books
// by these codes everywhere (Reader.jsx → BOOK_NAME_TO_OSIS → bookCode), so the
// premium providers MUST accept them — historically bookByName only knew full
// English names, which 400'd ("Unknown book: ACT/JHN") every gb:/ab: chapter.
const BOOK_BY_OSIS = new Map(BOOKS.map((b) => [b.osis.toLowerCase(), b]));
// getBible's 1-based book index, in case a caller passes the raw number.
const BOOK_BY_NUMBER = new Map(BOOKS.map((b) => [String(b.number), b]));
// Common aliases the Reader / deep links may send.
for (const [alias, canonical] of [
  ['psalm', 'Psalms'],
  ['song of songs', 'Song of Solomon'],
  ['canticles', 'Song of Solomon'],
  ['revelations', 'Revelation'],
  ['1 samuel', '1 Samuel'],
]) {
  const target = BOOK_BY_NAME.get(canonical.toLowerCase());
  if (target) BOOK_BY_NAME.set(alias, target);
}

// Resolve a book from ANY identifier the client might send: full name, an OSIS
// 3-letter code, a known alias, or the numeric index. This is the single place
// premium chapter fetches resolve books, so accepting every common form here
// permanently removes the name-vs-code mismatch class of bug.
export function bookByName(name) {
  if (name === null || name === undefined) return null;
  const key = String(name).trim().toLowerCase();
  if (!key) return null;
  return BOOK_BY_NAME.get(key)
    || BOOK_BY_OSIS.get(key)
    || BOOK_BY_NUMBER.get(key)
    || null;
}

// getBible re-publishes some of the same public-domain English bibles we serve
// for free; skip those so the picker doesn't show two "KJV"s.
const PD_ENGLISH_ABBRS = new Set(['kjv', 'web', 'bbe', 'asv', 'ylt', 'darby', 'oeb-us', 'oeb-cw']);

// Rough language-code -> UI region bucket (cosmetic grouping only).
const LANG_REGION = {
  en: 'americas', es: 'americas', pt: 'americas', fr: 'europe', de: 'europe',
  it: 'europe', nl: 'europe', sv: 'europe', no: 'europe', da: 'europe',
  fi: 'europe', pl: 'europe', cs: 'europe', sk: 'europe', hu: 'europe',
  ro: 'europe', el: 'europe', la: 'europe', ru: 'europe', uk: 'europe',
  sq: 'europe', hr: 'europe', sr: 'europe', bg: 'europe',
  he: 'middle_east', ar: 'middle_east', fa: 'middle_east', tr: 'middle_east',
  ur: 'asia', hi: 'asia', zh: 'asia', ja: 'asia', ko: 'asia', th: 'asia',
  vi: 'asia', id: 'asia', tl: 'asia',
  sw: 'africa', am: 'africa', zu: 'africa', af: 'africa', yo: 'africa', ha: 'africa',
};
function regionForLang(code) {
  return LANG_REGION[String(code || '').slice(0, 2).toLowerCase()] || 'other';
}

// Infer testament scope from a translation's title/abbreviation. getBible and
// API.Bible both ship NT-only and OT-only editions but provide no machine
// book-count, so we detect the common multilingual markers. Returns
// 'nt' | 'ot' | 'full'. Conservative: only flags partial on a clear marker.
const NT_ONLY_RE = /\bn\.?\s?t\.?\b|new testament|nuevo testamento|novo testamento|neues testament|nouveau testament|nuovo testamento/i;
const OT_ONLY_RE = /\bo\.?\s?t\.?\b|old testament|antiguo testamento|velho testamento|altes testament|ancien testament/i;
export function canonScope(title) {
  const s = String(title || '');
  if (NT_ONLY_RE.test(s)) return 'nt';
  if (OT_ONLY_RE.test(s)) return 'ot';
  return 'full';
}

export function premiumProvider() {
  if (process.env.DISABLE_PREMIUM_TRANSLATIONS === '1') return null;
  if (process.env.API_BIBLE_KEY) return 'api-bible';
  return 'getbible';
}

export function isPremiumTranslationId(id) {
  return typeof id === 'string' && (id.startsWith('gb:') || id.startsWith('ab:'));
}

async function fetchJson(url, { headers, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      const err = new Error(`Upstream ${res.status} for ${url}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// --------------------------------------------------------------------------
// getBible.net provider (no key)
// --------------------------------------------------------------------------
async function getBibleCatalog() {
  const data = await fetchJson(`${GETBIBLE_BASE}/translations.json`);
  const out = [];
  for (const key of Object.keys(data || {})) {
    const t = data[key] || {};
    const abbr = String(t.abbreviation || key).toLowerCase();
    const lang = String(t.lang || 'und').toLowerCase();
    if (lang === 'en' && PD_ENGLISH_ABBRS.has(abbr)) continue; // avoid free-tier dupes
    const scope = canonScope(`${t.translation || ''} ${t.abbreviation || ''} ${abbr}`);
    out.push({
      id: `gb:${abbr}`,
      name: t.translation || t.abbreviation || abbr,
      shortName: String(t.abbreviation || abbr).toUpperCase(),
      nativeName: t.translation || abbr,
      language: t.language || lang,
      languageCode: lang,
      region: regionForLang(lang),
      textDirection: String(t.direction || 'LTR').toLowerCase() === 'rtl' ? 'rtl' : 'ltr',
      // Don't blanket-claim every translation is a full 66-book bible: getBible
      // ships NT-only / OT-only editions (e.g. "Reina Valera NT 1858"), and
      // marking them complete made the UI print a bogus "66 Books". Infer scope
      // from the title; `isComplete` is true only when it's not flagged partial.
      scope,
      isComplete: scope === 'full',
      source: 'getbible',
    });
  }
  return out;
}

async function getBibleChapter({ id, book, chapter }) {
  const abbr = id.slice(3); // strip 'gb:'
  const b = bookByName(book);
  if (!b) {
    throw Object.assign(new Error(`Unknown book: ${book}`), { status: 400 });
  }
  const data = await fetchJson(`${GETBIBLE_BASE}/${encodeURIComponent(abbr)}/${b.number}/${Number(chapter)}.json`);
  const verses = (data.verses || []).map((v) => ({
    book_name: b.name,
    chapter: Number(chapter),
    verse: Number(v.verse),
    text: String(v.text || '').replace(/\s+/g, ' ').trim(),
  }));
  return { reference: `${b.name} ${chapter}`, verses, text: verses.map((v) => v.text).join(' ') };
}

// --------------------------------------------------------------------------
// API.Bible provider (requires API_BIBLE_KEY)
// --------------------------------------------------------------------------
function apiBibleHeaders() {
  return { 'api-key': process.env.API_BIBLE_KEY };
}

async function apiBibleCatalog() {
  const data = await fetchJson(`${API_BIBLE_BASE}/bibles`, { headers: apiBibleHeaders() });
  const out = [];
  for (const b of data.data || []) {
    const lang = b.language || {};
    const code = String(lang.id || 'und').toLowerCase();
    const scope = canonScope(`${b.name || ''} ${b.nameLocal || ''} ${b.abbreviation || ''} ${b.description || ''}`);
    out.push({
      id: `ab:${b.id}`,
      name: b.name || b.abbreviation || b.id,
      shortName: String(b.abbreviation || b.abbreviationLocal || b.id.slice(0, 6)).toUpperCase(),
      nativeName: b.nameLocal || b.name || b.id,
      language: lang.name || code,
      languageCode: code,
      region: regionForLang(code),
      textDirection: String(lang.scriptDirection || 'LTR').toLowerCase() === 'rtl' ? 'rtl' : 'ltr',
      scope,
      isComplete: scope === 'full',
      source: 'api-bible',
    });
  }
  return out;
}

const VERSE_MARKER = /\[(\d+)\]/g;
// API.Bible (content-type=text&include-verse-numbers=true) returns a chapter as
// plain text with inline "[1] ... [2] ..." verse markers. Split it into the
// same {verse, text} shape the Reader uses.
export function parseVerseNumberedText(content, bookName, chapter) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  const verses = [];
  let match;
  let lastVerse = null;
  let lastIndex = 0;
  VERSE_MARKER.lastIndex = 0;
  while ((match = VERSE_MARKER.exec(text)) !== null) {
    if (lastVerse !== null) {
      verses.push({
        book_name: bookName,
        chapter: Number(chapter),
        verse: lastVerse,
        text: text.slice(lastIndex, match.index).trim(),
      });
    }
    lastVerse = Number(match[1]);
    lastIndex = VERSE_MARKER.lastIndex;
  }
  if (lastVerse !== null) {
    verses.push({
      book_name: bookName,
      chapter: Number(chapter),
      verse: lastVerse,
      text: text.slice(lastIndex).trim(),
    });
  }
  return verses;
}

async function apiBibleChapter({ id, book, chapter }) {
  const bibleId = id.slice(3); // strip 'ab:'
  const b = bookByName(book);
  if (!b) {
    throw Object.assign(new Error(`Unknown book: ${book}`), { status: 400 });
  }
  const chapterId = `${b.osis}.${Number(chapter)}`;
  const url = `${API_BIBLE_BASE}/bibles/${encodeURIComponent(bibleId)}/chapters/${encodeURIComponent(chapterId)}`
    + '?content-type=text&include-verse-numbers=true&include-titles=false&include-notes=false&include-chapter-numbers=false';
  const data = await fetchJson(url, { headers: apiBibleHeaders() });
  const verses = parseVerseNumberedText(data?.data?.content, b.name, chapter);
  return { reference: `${b.name} ${chapter}`, verses, text: verses.map((v) => v.text).join(' ') };
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------
let _catalogCache = { provider: null, at: 0, list: [] };

export function _resetPremiumCatalogCache() {
  _catalogCache = { provider: null, at: 0, list: [] };
}

export async function listPremiumTranslations() {
  const provider = premiumProvider();
  if (!provider) return [];
  const fresh = _catalogCache.provider === provider
    && _catalogCache.list.length > 0
    && (Date.now() - _catalogCache.at) < PREMIUM_CACHE_TTL_MS;
  if (fresh) return _catalogCache.list;
  try {
    const list = provider === 'api-bible' ? await apiBibleCatalog() : await getBibleCatalog();
    _catalogCache = { provider, at: Date.now(), list };
    return list;
  } catch {
    // Never let a flaky upstream break the Reader: serve stale catalogue if we
    // have one, otherwise degrade to free-only (empty premium list).
    return _catalogCache.list.length ? _catalogCache.list : [];
  }
}

export async function fetchPremiumChapter({ id, book, chapter }) {
  if (String(id).startsWith('ab:')) return apiBibleChapter({ id, book, chapter });
  return getBibleChapter({ id, book, chapter });
}

// Reduce a full-chapter payload to a single verse or verse range (e.g. "16" or
// "16-18"). Premium providers are fetched per-chapter (and cached), so verse
// requests slice the cached chapter rather than making a second upstream call.
export function sliceVerses(chapterPayload, versesSpec) {
  if (versesSpec === undefined || versesSpec === null || versesSpec === '') return chapterPayload;
  const spec = String(versesSpec).trim();
  const [a, b] = spec.split('-').map((n) => parseInt(n, 10));
  const lo = a;
  const hi = Number.isFinite(b) ? b : a;
  if (!Number.isFinite(lo)) return chapterPayload;
  const verses = (chapterPayload.verses || []).filter((v) => v.verse >= lo && v.verse <= hi);
  return {
    reference: `${chapterPayload.reference}:${spec}`,
    verses,
    text: verses.map((v) => v.text).join(' '),
  };
}

// Exposed for tests.
export const __test = { parseVerseNumberedText, getBibleCatalog, apiBibleCatalog, regionForLang, sliceVerses, bookByName, canonScope };
