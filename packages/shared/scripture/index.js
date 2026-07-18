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

// Match e.g. "John 3:16", "1 John 4:8", "Romans 8:28-30", "Song of Solomon 2:1",
// "Wisdom of Solomon 3:1". We deliberately allow some loose punctuation/spacing
// so casual citations in conclusion paragraphs are caught too. The book name is
// the numbered prefix + one word, plus an optional "of X" clause.
//
// CASE-INSENSITIVE: the pattern must match `hezekiah 4:5` / `HEZEKIAH 4:5` as
// readily as `Hezekiah 4:5`. The old `[A-Z][a-z]+` (no /i flag) extracted NOTHING
// for a lowercase book word, so a lowercase fabricated reference slipped through
// EVERY consumer (validateAiSermon, validateAiContent, assertAiReplyExposable,
// screenStreamedScripture) as "zero references → all valid". Since
// `validateScriptureRefs` already lower-cases the book for canon lookup, matching
// case-insensitively here is all that is needed to validate correctly. The
// `looksLikeReference` filter below then drops ordinary prose like times/ratios
// ("at 3:30", "the ratio 2:1") so case-insensitivity doesn't over-match.
const REF_RE = /\b(?:[1-3]\s*)?[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?\s+\d{1,3}:\d{1,3}(?:[-–]\d{1,3})?\b/gi;

// Common English words that legitimately precede "N:N" in ordinary prose (times,
// ratios, scores, counts) and must NOT be mistaken for a (fabricated) book name.
// Real book names — including deuterocanon aliases like "wisdom"/"song"/"job" —
// are NEVER added here, and a known book always wins over this list (see
// looksLikeReference), so genuine citations are never dropped. Anything else
// shaped like "<Word> N:N" is kept as a possible fabrication, so a lowercase
// evasion like "hezekiah 4:5" is still caught and flagged invalid_book.
const NON_BOOK_WORDS = new Set([
  'at', 'by', 'to', 'of', 'in', 'on', 'up', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'from', 'with', 'without', 'within', 'into', 'onto',
  'this', 'that', 'these', 'those', 'our', 'your', 'their', 'his', 'her', 'its', 'my', 'we', 'you',
  'they', 'it', 'he', 'she', 'i', 'me', 'us', 'them', 'him', 'about', 'around', 'approximately',
  'approx', 'roughly', 'over', 'under', 'near', 'between', 'than', 'then', 'ratio', 'ratios', 'score',
  'scored', 'scores', 'time', 'times', 'hour', 'hours', 'minute', 'minutes', 'page', 'pages', 'line',
  'lines', 'room', 'number', 'no', 'version', 'level', 'round', 'size', 'part', 'parts', 'step',
  'steps', 'figure', 'table', 'item', 'day', 'days', 'week', 'weeks', 'year', 'years', 'vs', 'versus',
  'meeting', 'meetings', 'session', 'sessions', 'appointment', 'grade', 'model', 'chapter', 'verse',
]);

function looksLikeReference(match) {
  const str = String(match);
  const bookPart = str.replace(/\s+\d{1,3}:.+$/, '').trim().toLowerCase();
  const firstWord = bookPart.replace(/^[1-3]\s*/, '').split(/\s+/)[0] || '';
  // A known book (core or deuterocanon, any alias) is always a reference — this
  // guard also protects deuterocanon words that resemble common nouns (Wisdom).
  if (BOOK_LOOKUP.has(bookPart) || DEUTERO_CHAPTER_COUNTS[bookPart] != null) return true;
  if (BOOK_LOOKUP.has(firstWord) || DEUTERO_CHAPTER_COUNTS[firstWord] != null) return true;
  // Otherwise keep it as a possible fabrication unless the leading word is a
  // common non-book word (filters times/ratios/scores out of ordinary prose).
  return !NON_BOOK_WORDS.has(firstWord);
}

export function extractScriptureRefs(text) {
  if (!text) return [];
  return (String(text).match(REF_RE) || []).filter(looksLikeReference);
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
