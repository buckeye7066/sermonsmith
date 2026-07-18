/**
 * Canonical, canon-aware Scripture reference validator.
 *
 * This is THE single source of truth for reference validation across
 * SermonSmith. The web app re-exports it via `apps/web/src/lib/scriptureRefs.js`
 * and the API imports it directly, so client and server can never drift.
 *
 * The LLM prompts tell Larry and Arlynn not to invent verses, but the
 * server cannot guarantee the model obeys. For a sermon / Bible study
 * app, hallucinated references erode trust quickly — so AI-generated
 * content is run through this validator before being shown or saved.
 *
 * Canon awareness: SermonSmith serves Protestant, Catholic, and Orthodox
 * ministers. A Catholic citation of Wisdom 3:1 is real Scripture in that
 * tradition and must NOT be reported as a fabricated book — but we also
 * must not pretend we verified its verse numbers when we carry no
 * versification table for it. The status vocabulary keeps those states
 * distinct:
 *
 *   - 'valid'             book + chapter + verse (and range end) all verified
 *   - 'chapter_checked'   book + chapter verified for the selected canon, but
 *                         we have no versification table for the verse level
 *                         (deuterocanon / Greek Daniel) — needs source review
 *   - 'unsupported_canon' a real book in another Christian canon that is not
 *                         part of the selected validation canon
 *   - 'out_of_range'      chapter, verse, or range end-point out of range
 *                         (also reversed ranges like John 3:20-16)
 *   - 'invalid_book'      not a book in any canon we know
 *   - 'unparseable'       book recognized but chapter:verse could not be read
 *
 * Deuterocanon scope note: we include the Catholic deuterocanon (Tobit,
 * Judith, Wisdom, Sirach, Baruch, 1-2 Maccabees) plus Greek Daniel 13-14.
 * Chapter counts are standard across Catholic editions. We deliberately do
 * NOT carry verse-level tables for these books (versification varies across
 * editions) and we do NOT extend Esther (the Greek additions use lettered /
 * Vulgate-specific chapter numbering that plain "Esther N:V" citations
 * cannot address unambiguously). Orthodox-only books (1 Esdras, 3-4
 * Maccabees, Prayer of Manasseh, Psalm 151) are not yet registered; they
 * will be added when a translation source in the registry can actually
 * supply them.
 *
 * Exports:
 *   - CANONS
 *   - extractScriptureRefs(text) -> string[]
 *   - extractScriptureRefsDeep(obj) -> string[]   (recursive, shape-agnostic)
 *   - validateScriptureRefs(refs, { canon }) ->
 *       Array<{ ref, validBook, chapter, verse, verseEnd, status, canon }>
 *   - validateAiSermon(sermon, { canon }) -> { refs, allValid, summary, counts }
 *   - validateAiContent(content, { canon }) -> { refs, allValid, summary, counts }
 *       (same shape as validateAiSermon, for any persisted AI content type)
 *   - re-exports VERSE_COUNTS / versesInChapter / chaptersInBook
 */

import { versesInChapter } from './bibleVerseCounts.js';

export { VERSE_COUNTS, versesInChapter, chaptersInBook } from './bibleVerseCounts.js';

export const CANONS = ['protestant', 'catholic', 'orthodox'];

const BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Psalm',
  'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Song of Songs',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
  'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
  'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts',
  'Romans', '1 Corinthians', '2 Corinthians', 'Galatians',
  'Ephesians', 'Philippians', 'Colossians',
  '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
  'Jude', 'Revelation',
];

const BOOK_LOOKUP = new Set(BOOKS.map((b) => b.toLowerCase()));

// Canonical chapter counts (Protestant 66-book canon). Used to range-check the
// chapter number of an extracted reference. Aliases (Psalm/Psalms, Song of
// Solomon/Song of Songs) map to the same count.
const CHAPTER_COUNTS = {
  genesis: 50, exodus: 40, leviticus: 27, numbers: 36, deuteronomy: 34,
  joshua: 24, judges: 21, ruth: 4, '1 samuel': 31, '2 samuel': 24,
  '1 kings': 22, '2 kings': 25, '1 chronicles': 29, '2 chronicles': 36,
  ezra: 10, nehemiah: 13, esther: 10, job: 42, psalms: 150, psalm: 150,
  proverbs: 31, ecclesiastes: 12, 'song of solomon': 8, 'song of songs': 8,
  isaiah: 66, jeremiah: 52, lamentations: 5, ezekiel: 48, daniel: 12,
  hosea: 14, joel: 3, amos: 9, obadiah: 1, jonah: 4, micah: 7,
  nahum: 3, habakkuk: 3, zephaniah: 3, haggai: 2, zechariah: 14, malachi: 4,
  matthew: 28, mark: 16, luke: 24, john: 21, acts: 28,
  romans: 16, '1 corinthians': 16, '2 corinthians': 13, galatians: 6,
  ephesians: 6, philippians: 4, colossians: 4,
  '1 thessalonians': 5, '2 thessalonians': 3, '1 timothy': 6, '2 timothy': 4,
  titus: 3, philemon: 1, hebrews: 13, james: 5,
  '1 peter': 5, '2 peter': 3, '1 john': 5, '2 john': 1, '3 john': 1,
  jude: 1, revelation: 22,
};

// Catholic deuterocanon, keyed by every accepted alias (lower-cased). Chapter
// counts are stable across Catholic editions; verse-level counts are NOT
// carried (versification varies), so these books validate to
// 'chapter_checked' rather than 'valid'.
const DEUTERO_CHAPTER_COUNTS = {
  tobit: 14,
  judith: 16,
  wisdom: 19, 'wisdom of solomon': 19,
  sirach: 51, ecclesiasticus: 51,
  baruch: 6,
  '1 maccabees': 16,
  '2 maccabees': 15,
};

// Books whose chapter range extends beyond the Protestant count in the
// Catholic/Orthodox canons (Greek Daniel: 13 Susanna, 14 Bel and the Dragon).
const CANON_EXTRA_CHAPTERS = {
  daniel: { catholic: 14, orthodox: 14 },
};

// Longest chapter in the Bible is Psalm 119 with 176 verses. Fallback ceiling
// only, for core books whose exact per-chapter count is somehow unavailable.
const MAX_VERSE = 176;

// ---------------------------------------------------------------------------
// Citation extraction — normalization + variant-tolerant parsing.
//
// A single tight regex is not enough: an AI naturally produces citations in many
// FORMS, and each form that the extractor misses is a total gate bypass (every
// consumer — validateAiSermon, validateAiContent, assertAiReplyExposable,
// screenStreamedScripture — sees "zero references → all valid"). We therefore:
//   1. normalize unicode spaces / fullwidth digits / colon + dash variants to
//      ASCII (so "Ｈｅｚ ４：５" / non-breaking spaces don't evade the matcher);
//   2. match a permissive citation shape that allows a numeric/roman/worded
//      prefix, an abbreviated book (with or without a trailing period), an
//      optional "of X" clause, and flexible whitespace AROUND the colon;
//   3. canonicalize each match (prefix → 1/2/3 BOUND to the book, abbreviation →
//      full book) into a clean "Book C:V[-V]" string that validateScriptureRefs
//      already understands — so `II John 1:20` validates as 2 John (v20 fails,
//      not silently attributed to John), `Hez. 4:5` / `hezekiah 4 : 5` are
//      caught as fabricated, and `Gen. 1:1` / `1 Cor 13:4` / `II Tim 1:7`
//      validate correctly.
// A looksLikeReference guard still drops ordinary prose (times/ratios/scores)
// so the tolerant matcher does not over-match.
// ---------------------------------------------------------------------------

function normalizeCitationText(text) {
  return String(text)
    // Unicode spaces → ASCII space.
    .replace(/[   -   　]/g, ' ')
    // Fullwidth digits → ASCII digits.
    .replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xFF10))
    // Fullwidth Latin letters (U+FF21–FF3A / U+FF41–FF5A) → ASCII letters.
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    // Colon variants (fullwidth colon, ratio, modifier letter colon) → ':'.
    .replace(/[：∶ː꞉]/g, ':')
    // Dash variants → '-'.
    .replace(/[‐-―−－]/g, '-');
}

// Numeric-prefix words / roman numerals → 1 / 2 / 3.
const PREFIX_NUM = {
  1: '1', 2: '2', 3: '3', '1': '1', '2': '2', '3': '3',
  i: '1', ii: '2', iii: '3',
  first: '1', second: '2', third: '3',
};

// Book ABBREVIATION (no numeric prefix) → canonical lowercase book key. Numbered
// books map by their SUFFIX (e.g. "cor" → "corinthians"); the numeric prefix is
// bound separately. Full names validate directly and need no entry here. NONE of
// these collide with a common English word (ambiguous forms like "is"/"am" are
// deliberately omitted — use "isa"/"amos") so they never false-positive prose.
const BOOK_ABBREV = {
  gen: 'genesis', gn: 'genesis', ge: 'genesis',
  ex: 'exodus', exo: 'exodus', exod: 'exodus',
  lev: 'leviticus', lv: 'leviticus',
  num: 'numbers', nm: 'numbers', nb: 'numbers',
  deut: 'deuteronomy', dt: 'deuteronomy', deu: 'deuteronomy',
  josh: 'joshua', jos: 'joshua', jsh: 'joshua',
  judg: 'judges', jdg: 'judges', jgs: 'judges',
  rth: 'ruth', ru: 'ruth',
  sam: 'samuel', sm: 'samuel',
  kgs: 'kings', kg: 'kings', ki: 'kings',
  chr: 'chronicles', chron: 'chronicles',
  ezr: 'ezra',
  neh: 'nehemiah',
  esth: 'esther', est: 'esther',
  ps: 'psalms', psa: 'psalms', psalm: 'psalms', pss: 'psalms', psm: 'psalms',
  prov: 'proverbs', prv: 'proverbs', pro: 'proverbs',
  eccl: 'ecclesiastes', ecc: 'ecclesiastes', eccles: 'ecclesiastes', qoh: 'ecclesiastes',
  song: 'song of solomon', sos: 'song of solomon', cant: 'song of solomon', canticles: 'song of solomon',
  isa: 'isaiah', isai: 'isaiah',
  jer: 'jeremiah', jr: 'jeremiah',
  lam: 'lamentations',
  ezek: 'ezekiel', eze: 'ezekiel', ezk: 'ezekiel',
  dan: 'daniel', dn: 'daniel',
  hos: 'hosea',
  jl: 'joel', joe: 'joel',
  amo: 'amos', amos: 'amos',
  obad: 'obadiah', ob: 'obadiah',
  jon: 'jonah', jnh: 'jonah',
  mic: 'micah',
  nah: 'nahum', na: 'nahum',
  hab: 'habakkuk',
  zeph: 'zephaniah', zep: 'zephaniah',
  hag: 'haggai', hg: 'haggai',
  zech: 'zechariah', zec: 'zechariah',
  mal: 'malachi',
  matt: 'matthew', mt: 'matthew', mat: 'matthew',
  mrk: 'mark', mk: 'mark', mar: 'mark',
  luk: 'luke', lk: 'luke',
  jn: 'john', joh: 'john', jhn: 'john',
  act: 'acts',
  rom: 'romans', rm: 'romans',
  cor: 'corinthians', co: 'corinthians',
  gal: 'galatians', ga: 'galatians',
  eph: 'ephesians',
  phil: 'philippians', php: 'philippians', philipp: 'philippians',
  col: 'colossians',
  thess: 'thessalonians', thes: 'thessalonians', ths: 'thessalonians',
  tim: 'timothy', ti: 'timothy', tm: 'timothy',
  tit: 'titus',
  philem: 'philemon', phlm: 'philemon', phm: 'philemon',
  heb: 'hebrews',
  jas: 'james', jm: 'james',
  pet: 'peter', pt: 'peter', pe: 'peter',
  jud: 'jude',
  rev: 'revelation', rv: 'revelation', apoc: 'revelation',
  tob: 'tobit', tb: 'tobit',
  jdt: 'judith', jth: 'judith',
  wis: 'wisdom', wisd: 'wisdom',
  sir: 'sirach', ecclus: 'sirach',
  bar: 'baruch',
  macc: 'maccabees', mac: 'maccabees', mcc: 'maccabees',
};

// Canonical lowercase book key → display (Title Case) for a clean `ref` string.
const DISPLAY_NAME = {};
for (const b of BOOKS) DISPLAY_NAME[b.toLowerCase()] = b;
Object.assign(DISPLAY_NAME, {
  tobit: 'Tobit', judith: 'Judith', wisdom: 'Wisdom', 'wisdom of solomon': 'Wisdom of Solomon',
  sirach: 'Sirach', ecclesiasticus: 'Ecclesiasticus', baruch: 'Baruch',
  '1 maccabees': '1 Maccabees', '2 maccabees': '2 Maccabees',
});

// Common English words that legitimately precede "N:N" in ordinary prose (times,
// ratios, scores, counts, pronoun-verb sequences) and must NOT be mistaken for a
// (fabricated) book name. Real book names / abbreviations are NEVER added here
// and always win (see looksLikeReference), so genuine citations are never
// dropped; anything else shaped like "<Word> N:N" is kept as a possible
// fabrication, so a lowercase/abbreviated evasion is still caught.
const NON_BOOK_WORDS = new Set([
  'at', 'by', 'to', 'of', 'in', 'on', 'up', 'as', 'is', 'am', 'was', 'are', 'were', 'be', 'been', 'being',
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'from', 'with', 'without', 'within', 'into', 'onto',
  'this', 'that', 'these', 'those', 'our', 'your', 'their', 'his', 'her', 'its', 'my', 'we', 'you',
  'they', 'it', 'he', 'she', 'i', 'me', 'us', 'them', 'him', 'about', 'around', 'approximately',
  'approx', 'roughly', 'over', 'under', 'near', 'between', 'than', 'then', 'ratio', 'ratios', 'score',
  'scored', 'scores', 'time', 'times', 'hour', 'hours', 'minute', 'minutes', 'page', 'pages', 'line',
  'lines', 'room', 'number', 'no', 'version', 'level', 'round', 'size', 'part', 'parts', 'step',
  'steps', 'figure', 'table', 'item', 'day', 'days', 'week', 'weeks', 'year', 'years', 'vs', 'versus',
  'meeting', 'meetings', 'session', 'sessions', 'appointment', 'grade', 'model', 'chapter', 'verse',
  'first', 'second', 'third', 'saw', 'see', 'seen', 'do', 'did', 'does', 'go', 'went', 'get', 'got',
  'had', 'has', 'have', 'will', 'would', 'could', 'should', 'can', 'may', 'said', 'says', 'know', 'knew',
  'make', 'made', 'take', 'took', 'come', 'came', 'meet', 'met', 'want', 'need', 'call', 'called',
]);

// Permissive citation matcher (run on normalized text). Groups:
//   1 prefix (optional): 1-3 / I-III / first-third
//   2 book (with optional trailing '.', optional "of X")
//   3 chapter   4 verse   5 verseEnd (optional)
const CITATION_RE = /\b(?:([1-3]|i{1,3}|first|second|third)\.?\s+)?([a-z]{2,}\.?(?:\s+of\s+[a-z]+)?)\s+(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-]\s*(\d{1,3}))?/gi;

const titleCase = (s) => s.split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

function parseCitation(m) {
  const rawPrefix = m[1] ? m[1].toLowerCase().replace(/\./g, '') : '';
  const prefixNum = rawPrefix ? (PREFIX_NUM[rawPrefix] || '') : '';
  const rawBook = m[2].toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ').trim();
  const base = BOOK_ABBREV[rawBook] || rawBook;
  const canonicalKey = prefixNum ? `${prefixNum} ${base}` : base;
  return {
    prefixNum,
    base,
    canonicalKey,
    chapter: m[3],
    verse: m[4],
    verseEnd: m[5],
  };
}

function looksLikeReference({ base, canonicalKey }) {
  // A known book (with prefix bound, or the bare base) is always a reference —
  // this also protects deuterocanon words that resemble nouns (Wisdom, Song).
  if (BOOK_LOOKUP.has(canonicalKey) || DEUTERO_CHAPTER_COUNTS[canonicalKey] != null) return true;
  if (BOOK_LOOKUP.has(base) || DEUTERO_CHAPTER_COUNTS[base] != null) return true;
  // Otherwise keep it as a possible fabrication unless the leading word is a
  // common non-book word (filters times/ratios/scores/prose out).
  const firstWord = base.split(' ')[0];
  return !NON_BOOK_WORDS.has(firstWord);
}

function buildCanonical({ canonicalKey, base, prefixNum, chapter, verse, verseEnd }) {
  const display = DISPLAY_NAME[canonicalKey]
    || (prefixNum ? `${prefixNum} ${titleCase(base)}` : titleCase(base));
  const range = verseEnd != null ? `-${verseEnd}` : '';
  return `${display} ${chapter}:${verse}${range}`;
}

export function extractScriptureRefs(text) {
  if (!text) return [];
  const normalized = normalizeCitationText(text);
  const out = [];
  for (const m of normalized.matchAll(CITATION_RE)) {
    const parsed = parseCitation(m);
    if (!looksLikeReference(parsed)) continue;
    out.push(buildCanonical(parsed));
  }
  return out;
}

function normalizeCanon(canon) {
  return CANONS.includes(canon) ? canon : 'protestant';
}

/**
 * Validate an array of reference strings against the selected canon.
 * Backward compatible with the original signature: `options` may be omitted
 * and defaults to the Protestant 66-book canon (the previous behavior).
 */
export function validateScriptureRefs(refs, options = {}) {
  const canon = normalizeCanon(options.canon);
  const list = Array.isArray(refs) ? refs : [];
  return list.filter(Boolean).map((ref) => {
    const str = String(ref);
    const bookPart = str.replace(/\s+\d{1,3}:.+$/, '').trim();
    const bookKey = bookPart.toLowerCase();
    const isCore = BOOK_LOOKUP.has(bookKey);
    const deuteroChapters = DEUTERO_CHAPTER_COUNTS[bookKey];
    const isDeutero = deuteroChapters != null;
    // A book "counts" for this validation run only if the selected canon
    // actually contains it. Deuterocanon under the Protestant canon is a
    // real book in another canon — reported as such, never as fabricated.
    const validBook = isCore || (isDeutero && canon !== 'protestant');

    const cv = str.match(/(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/);
    const chapter = cv ? Number(cv[1]) : null;
    const verse = cv ? Number(cv[2]) : null;
    const verseEnd = cv && cv[3] != null ? Number(cv[3]) : null;

    let status;
    if (!isCore && !isDeutero) {
      status = 'invalid_book';
    } else if (!validBook) {
      status = 'unsupported_canon';
    } else if (chapter == null || verse == null) {
      status = 'unparseable';
    } else {
      const coreChapters = isCore ? CHAPTER_COUNTS[bookKey] ?? Infinity : 0;
      const extraChapters = CANON_EXTRA_CHAPTERS[bookKey]?.[canon] ?? 0;
      const maxChapter = Math.max(isCore ? coreChapters : deuteroChapters, extraChapters);
      const chapterOk = chapter >= 1 && chapter <= maxChapter;
      if (!chapterOk) {
        status = 'out_of_range';
      } else {
        // Exact verse count for this chapter when we have a table for it.
        const exact = versesInChapter(bookKey, chapter);
        const beyondCoreTable = !isCore || chapter > coreChapters;
        if (exact == null && beyondCoreTable) {
          // Canon-supported book/chapter with no versification table
          // (deuterocanon or Greek Daniel). We can still reject a reversed
          // range, but we must not claim verse-level verification.
          status = verseEnd != null && verseEnd < verse ? 'out_of_range' : 'chapter_checked';
        } else {
          const maxVerse = exact ?? MAX_VERSE;
          const startOk = verse >= 1 && verse <= maxVerse;
          const endOk = verseEnd == null || (verseEnd >= verse && verseEnd <= maxVerse);
          status = startOk && endOk ? 'valid' : 'out_of_range';
        }
      }
    }

    return { ref, validBook, chapter, verse, verseEnd, status, canon };
  });
}

// Keys that never hold sermon prose but DO hold prior validation output or
// bookkeeping whose `ref` strings would be re-extracted and double-counted by
// the deep walk. `scripture_validation` is the array of {ref,status,...}
// objects this module itself produced; walking it would re-validate already-
// recorded references (and, on an update, mix stale results into the new
// computation). Skip these keys everywhere in the tree.
const NON_CONTENT_KEYS = new Set(['scripture_validation']);

/**
 * Recursively collect scripture references from every string anywhere in an
 * arbitrary AI-generated content object.
 *
 * The per-type generators persist scripture in wildly different shapes —
 * sermon `points[].supporting_scriptures[]`, Bible-study
 * `study_sections[].scripture` + `key_verses[]`, quiz
 * `questions[].scripture_reference`, reading-plan `daily_readings[].passages[]`,
 * and the Christian-Ethics analysis which nests everything under
 * `data.result.biblical_foundation.key_scriptures[].reference`. Hard-coding a
 * field list per type is fragile (a UI shape change silently drops a field out
 * of validation), so the durable save gate walks the whole object and extracts
 * references from every string. Array-of-reference fields (already bare
 * "John 3:16" strings) and prose fields are handled uniformly because the
 * reference regex matches a bare reference as readily as one embedded in a
 * sentence.
 */
export function extractScriptureRefsDeep(value, _depth = 0, _seen = new Set()) {
  if (value == null || _depth > 12) return [];
  if (typeof value === 'string') return extractScriptureRefs(value);
  if (typeof value !== 'object') return [];
  // Guard against cyclic references (defensive; entity data is plain JSON).
  if (_seen.has(value)) return [];
  _seen.add(value);

  const out = [];
  if (Array.isArray(value)) {
    for (const item of value) out.push(...extractScriptureRefsDeep(item, _depth + 1, _seen));
  } else {
    for (const [key, item] of Object.entries(value)) {
      if (NON_CONTENT_KEYS.has(key)) continue;
      out.push(...extractScriptureRefsDeep(item, _depth + 1, _seen));
    }
  }
  return out;
}

/**
 * Canon-aware validation summary for ANY persisted AI-generated content
 * object, regardless of its type-specific shape. Deep-sweeps every string for
 * references and returns the same `{ refs, allValid, summary, counts }` shape
 * `validateAiSermon` produces, so the entity save gate can persist an honest
 * `scripture_validation` for Bible studies, quizzes, reading plans, ethics
 * analyses, study notes, etc. — not just sermons.
 *
 * `allValid` is strict in exactly the same way: only fully verse-verified
 * references count, so a 'chapter_checked' deuterocanon reference keeps the
 * record in a review-required state rather than passing as verified.
 */
export function validateAiContent(content, options = {}) {
  const refs = extractScriptureRefsDeep(content);
  const checked = validateScriptureRefs(refs, options);
  const allValid = checked.every((r) => r.status === 'valid');
  const problems = checked.filter((r) => r.status !== 'valid').length;
  const counts = checked.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const summary = problems === 0
    ? `${checked.length} reference(s) reviewed — all valid`
    : `${checked.length} reference(s) reviewed — ${problems} need attention`;
  return { refs: checked, allValid, summary, counts };
}

/**
 * High-level helper for an AI-generated sermon-shaped object. Sweeps the
 * anchor passage and every point's supporting scriptures, returns a
 * structured summary the UI can render and the entity layer can persist
 * as `scripture_validation`.
 *
 * `allValid` is strict: only fully verse-verified references count. A
 * 'chapter_checked' deuterocanon reference is real Scripture but still needs
 * source review, so it keeps the sermon in a review-required state rather
 * than silently passing as verified.
 */
export function validateAiSermon(sermon, options = {}) {
  // Deep-scan the WHOLE sermon object, not a hand-picked field list. Sermons
  // persist references across many prose fields — big_idea, theological_notes,
  // and each point's exegesis/application/illustration/text/supporting_scriptures
  // — and BOTH the entity publish gate and the share-link exposure gate validate
  // sermons through this function. A hand-picked list (previously only
  // anchor_passage, points[].supporting_scriptures, points[].text, conclusion)
  // let a fabricated reference in big_idea / theological_notes / a point's
  // exegesis pass as all-valid and be published + share-served. The shape-
  // agnostic deep sweep closes that blind spot and stays correct as the sermon
  // shape evolves.
  const checked = validateScriptureRefs(extractScriptureRefsDeep(sermon), options);
  const allValid = checked.every((r) => r.status === 'valid');
  const problems = checked.filter((r) => r.status !== 'valid').length;
  const counts = checked.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const summary = problems === 0
    ? `${checked.length} reference(s) reviewed — all valid`
    : `${checked.length} reference(s) reviewed — ${problems} need attention`;
  return { refs: checked, allValid, summary, counts };
}
