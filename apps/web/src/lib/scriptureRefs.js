/**
 * Scripture reference validator.
 *
 * The LLM prompts tell Larry and Arlynn not to invent verses, but the
 * server cannot guarantee the model obeys. For a sermon / Bible study
 * app, hallucinated references erode trust quickly — so any AI-generated
 * content is run through this validator before being shown or saved.
 *
 * We extract candidate references with a regex, then check the book
 * portion against the canonical 66-book list. Chapter/verse numbers are
 * not range-checked here (that would require a chapter/verse-count table);
 * if a book is recognised we mark the ref `needs_chapter_verse_check` so
 * the UI can surface it as "verify before publishing" rather than
 * blocking the user.
 *
 * Returns:
 *   - `extractScriptureRefs(text)` -> string[]
 *   - `validateScriptureRefs(refs)` -> Array<{ ref, validBook, status }>
 *   - `validateAiSermon(sermon)` -> { refs, allValid, summary }
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

const BOOK_LOOKUP = new Set(BOOKS.map((b) => b.toLowerCase()));

// Match e.g. "John 3:16", "1 John 4:8", "Romans 8:28-30", "Song of Solomon 2:1".
// We deliberately allow some loose punctuation/spacing so casual citations
// in conclusion paragraphs are caught too.
const REF_RE = /\b(?:[1-3]\s*)?[A-Z][a-z]+(?:\s+of\s+[A-Z][a-z]+)?(?:\s+[A-Z][a-z]+)?\s+\d{1,3}:\d{1,3}(?:[-–]\d{1,3})?\b/g;

export function extractScriptureRefs(text) {
  if (!text) return [];
  return String(text).match(REF_RE) || [];
}

export function validateScriptureRefs(refs) {
  const list = Array.isArray(refs) ? refs : [];
  return list.filter(Boolean).map((ref) => {
    const bookPart = String(ref).replace(/\s+\d{1,3}:.+$/, '').trim();
    const validBook = BOOK_LOOKUP.has(bookPart.toLowerCase());
    return {
      ref,
      validBook,
      status: validBook ? 'needs_chapter_verse_check' : 'invalid_book',
    };
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
  const allValid = checked.every((r) => r.validBook);
  return { refs: checked, allValid, summary: `${checked.length} reference(s) reviewed` };
}
