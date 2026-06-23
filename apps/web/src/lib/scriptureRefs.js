/**
 * Scripture reference validator.
 *
 * The LLM prompts tell Larry and Arlynn not to invent verses, but the
 * server cannot guarantee the model obeys. For a sermon / Bible study
 * app, hallucinated references erode trust quickly — so any AI-generated
 * content is run through this validator before being shown or saved.
 *
 * We extract candidate references with a regex, then check the book
 * portion against the canonical 66-book list AND range-check the chapter
 * against that book's known chapter count and the verse against that exact
 * chapter's verse count (from bibleVerseCounts.js). This catches a real book
 * with an impossible chapter ("John 99:99", John has 21 chapters), an absurd
 * verse ("Genesis 1:9000"), and a precise overrun ("John 3:37" — John 3 has 36
 * verses). If the chapter is somehow unknown we fall back to a coarse global
 * verse ceiling (Psalm 119 is the longest at 176 verses).
 *
 * Returns:
 *   - `extractScriptureRefs(text)` -> string[]
 *   - `validateScriptureRefs(refs)` -> Array<{ ref, validBook, chapter, verse, status }>
 *   - `validateAiSermon(sermon)` -> { refs, allValid, summary }
 *
 * Status is one of: 'valid' | 'invalid_book' | 'out_of_range' | 'unparseable'.
 */

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

import { versesInChapter } from './bibleVerseCounts';

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

// Longest chapter in the Bible is Psalm 119 with 176 verses.
const MAX_VERSE = 176;

// Match e.g. "John 3:16", "1 John 4:8", "Romans 8:28-30", "Song of Solomon 2:1".
// We deliberately allow some loose punctuation/spacing so casual citations
// in conclusion paragraphs are caught too. The book name is the numbered
// prefix + one capitalized word, plus an optional "of X" clause (the only
// multi-word canonical books are Song of Solomon / Song of Songs). We do NOT
// allow an extra trailing capitalized word — that made the regex swallow the
// preceding sentence word, e.g. "As John 3:16" instead of "John 3:16".
const REF_RE = /\b(?:[1-3]\s*)?[A-Z][a-z]+(?:\s+of\s+[A-Z][a-z]+)?\s+\d{1,3}:\d{1,3}(?:[-–]\d{1,3})?\b/g;

export function extractScriptureRefs(text) {
  if (!text) return [];
  return String(text).match(REF_RE) || [];
}

export function validateScriptureRefs(refs) {
  const list = Array.isArray(refs) ? refs : [];
  return list.filter(Boolean).map((ref) => {
    const str = String(ref);
    const bookPart = str.replace(/\s+\d{1,3}:.+$/, '').trim();
    const bookKey = bookPart.toLowerCase();
    const validBook = BOOK_LOOKUP.has(bookKey);
    const cv = str.match(/(\d{1,3}):(\d{1,3})/);
    const chapter = cv ? Number(cv[1]) : null;
    const verse = cv ? Number(cv[2]) : null;

    let status;
    if (!validBook) {
      status = 'invalid_book';
    } else if (chapter == null || verse == null) {
      status = 'unparseable';
    } else {
      const maxChapter = CHAPTER_COUNTS[bookKey] ?? Infinity;
      const chapterOk = chapter >= 1 && chapter <= maxChapter;
      // Prefer the exact verse count for this chapter; fall back to the global
      // ceiling when the chapter is unknown / out of the table.
      const maxVerse = (chapterOk ? versesInChapter(bookKey, chapter) : null) ?? MAX_VERSE;
      const inRange = chapterOk && verse >= 1 && verse <= maxVerse;
      status = inRange ? 'valid' : 'out_of_range';
    }

    return { ref, validBook, chapter, verse, status };
  });
}

/**
 * High-level helper for an AI-generated sermon-shaped object. Sweeps the
 * anchor passage and every point's supporting scriptures, returns a
 * structured summary the UI can render and the entity layer can persist
 * as `scripture_validation`.
 */
export function validateAiSermon(sermon) {
  const refs = [
    ...extractScriptureRefs(sermon?.anchor_passage),
    ...(sermon?.points || []).flatMap((p) => [
      ...(Array.isArray(p?.supporting_scriptures)
        ? p.supporting_scriptures
        : extractScriptureRefs(p?.supporting_scriptures)),
      ...extractScriptureRefs(p?.text),
    ]),
    ...extractScriptureRefs(sermon?.conclusion),
  ];
  const checked = validateScriptureRefs(refs);
  const allValid = checked.every((r) => r.status === 'valid');
  const problems = checked.filter((r) => r.status !== 'valid').length;
  const summary = problems === 0
    ? `${checked.length} reference(s) reviewed — all valid`
    : `${checked.length} reference(s) reviewed — ${problems} need attention`;
  return { refs: checked, allValid, summary };
}
