import { chaptersInBook, versesInChapter } from './bibleVerseCounts';
import { BOOK_NAME_TO_OSIS } from '../components/bible/bibleSources';
import { isBookInTranslation } from '../components/reader/TranslationBookChecker';

// Names, order, chapter limits and provider identifiers all come from the
// existing Bible catalogue rather than another independently maintained list.
export const READER_BOOKS = Object.keys(BOOK_NAME_TO_OSIS).map((name) => ({
  name, chapters: chaptersInBook(name),
}));

function bookKey(value) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase()
    .replace(/^(iii|third|3rd)\s+(?=[a-z])/, '3 ')
    .replace(/^(ii|second|2nd)\s+(?=[a-z])/, '2 ')
    .replace(/^(i|first|1st)\s+(?=[a-z])/, '1 ')
    .replace(/[.\s]/g, '');
}

const aliases = new Map();
for (const { name } of READER_BOOKS) {
  aliases.set(bookKey(name), name);
  aliases.set(bookKey(BOOK_NAME_TO_OSIS[name]), name);
}
for (const [alias, name] of Object.entries({
  ps: 'Psalms', psalm: 'Psalms', jn: 'John', mt: 'Matthew', mk: 'Mark',
  lk: 'Luke', song: 'Song of Solomon', 'song of songs': 'Song of Solomon',
  sos: 'Song of Solomon', phil: 'Philippians', philem: 'Philemon',
  '1 cor': '1 Corinthians', '2 cor': '2 Corinthians',
  '1 thess': '1 Thessalonians', '2 thess': '2 Thessalonians',
})) aliases.set(bookKey(alias), name);

export function resolveReaderBook(value) {
  const key = bookKey(value);
  if (aliases.has(key)) return aliases.get(key);
  // Only unambiguous abbreviations are accepted. Never turn an uncertain
  // prefix (e.g. "Jo") into a different book without the reader's knowledge.
  if (key.replace(/^[123]/, '').length < 3) return null;
  const matches = READER_BOOKS.filter(({ name }) => bookKey(name).startsWith(key));
  return matches.length === 1 ? matches[0].name : null;
}

function positiveInteger(value, label) {
  const text = String(value ?? '').trim();
  const number = /^\d+$/.test(text) ? Number(text) : NaN;
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error(`${label} must be a whole number (1 or higher).`);
  }
  return number;
}

export function validateReaderLocation({ book, chapter, verse }, { translation, translationBookInfo } = {}) {
  const name = resolveReaderBook(book);
  if (!name) throw new Error(`"${String(book ?? '').trim()}" isn't a recognized book of the Bible. Please check the spelling.`);
  if (!isBookInTranslation(name, translationBookInfo)) {
    throw new Error(`${name} is not available in this translation. Choose another book or translation.`);
  }
  const chapterNumber = positiveInteger(chapter, 'Chapter');
  const maxChapter = chaptersInBook(name);
  if (chapterNumber > maxChapter) {
    throw new Error(`${name} only has ${maxChapter} chapter${maxChapter === 1 ? '' : 's'}.`);
  }
  const verseNumber = verse == null || String(verse).trim() === '' ? null : positiveInteger(verse, 'Verse');
  const maxVerse = versesInChapter(name, chapterNumber, translation);
  if (verseNumber !== null && maxVerse && verseNumber > maxVerse) {
    throw new Error(`${name} ${chapterNumber} only has ${maxVerse} verse${maxVerse === 1 ? '' : 's'}.`);
  }
  return { book: name, chapter: chapterNumber, verse: verseNumber };
}

export function parseReaderReference(value, options = {}) {
  const text = String(value ?? '').normalize('NFKC').trim();
  const bookOnly = resolveReaderBook(text);
  if (bookOnly) return validateReaderLocation({ book: bookOnly, chapter: 1 }, options);
  // Match the entire input, not a valid-looking substring of invalid text.
  // Supports "John 3:16", "Jn.3:16", "1 Cor 13", and book-only entries.
  const match = /^(.*?)\s*(\d+)(?:\s*:\s*(\d+))?$/.exec(text);
  if (!match || !match[1].trim()) {
    throw new Error('Enter a book, chapter, and optional verse, for example John 3:16.');
  }
  return validateReaderLocation({ book: match[1], chapter: match[2], verse: match[3] }, options);
}

export function resolveReaderEntry(book, chapter, verse, options = {}) {
  // A complete pasted passage in the book box overrides the split fields.
  return resolveReaderBook(book)
    ? validateReaderLocation({ book, chapter, verse }, options)
    : parseReaderReference(book, options);
}
