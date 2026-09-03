/**
 * Convert both current API chapters (`{ verses: [...] }`) and the legacy
 * offline format (`{ chapter: { content: [...] } }`) into the one shape the
 * Reader renders. Previously downloaded chapters remain readable after the
 * API storage format change.
 */
export function normalizeReaderChapter(data, { book, chapter }) {
  if (Array.isArray(data?.verses)) {
    return data.verses
      .map((row) => ({
        id: `${book}-${chapter}-${Number(row.verse)}`,
        verse: Number(row.verse),
        text: String(row.text || '').trim(),
        book_name: row.book_name || row.book || book,
        chapter: Number(row.chapter) || Number(chapter),
      }))
      .filter((row) => Number.isInteger(row.verse) && row.verse > 0 && row.text);
  }

  const content = data?.chapter?.content;
  if (!Array.isArray(content)) return [];

  const verses = [];
  let verseNumber = null;
  let verseText = '';
  const flush = () => {
    if (verseNumber === null || !verseText.trim()) return;
    verses.push({
      id: `${book}-${chapter}-${verseNumber}`,
      verse: verseNumber,
      text: verseText.trim(),
      book_name: book,
      chapter: Number(chapter),
    });
  };

  for (const item of content) {
    if (item?.type === 'verse') {
      flush();
      verseNumber = Number(item.number);
      verseText = '';
    } else if (item?.type === 'text' && verseNumber !== null) {
      verseText += String(item.text || '');
    }
  }
  flush();
  return verses.filter((row) => Number.isInteger(row.verse) && row.verse > 0);
}
