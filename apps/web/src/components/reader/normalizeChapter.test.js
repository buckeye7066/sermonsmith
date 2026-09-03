import { describe, expect, it } from 'vitest';
import { normalizeReaderChapter } from './normalizeChapter';

describe('normalizeReaderChapter', () => {
  it('reads the current API format saved by OfflineDownloadManager', () => {
    expect(normalizeReaderChapter({
      verses: [{ book_name: 'John', chapter: 3, verse: 16, text: 'For God so loved the world.' }],
    }, { book: 'John', chapter: 3 })).toEqual([{
      id: 'John-3-16',
      book_name: 'John',
      chapter: 3,
      verse: 16,
      text: 'For God so loved the world.',
    }]);
  });

  it('keeps legacy downloaded chapter content readable', () => {
    const result = normalizeReaderChapter({
      chapter: {
        content: [
          { type: 'verse', number: 1 },
          { type: 'text', text: 'In the beginning ' },
          { type: 'text', text: 'God created.' },
          { type: 'verse', number: 2 },
          { type: 'text', text: 'The earth was formless.' },
        ],
      },
    }, { book: 'Genesis', chapter: 1 });

    expect(result.map((row) => [row.verse, row.text])).toEqual([
      [1, 'In the beginning God created.'],
      [2, 'The earth was formless.'],
    ]);
  });
});
