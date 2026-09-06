import { describe, expect, it } from 'vitest';
import { READER_BOOKS, parseReaderReference, resolveReaderBook, resolveReaderEntry, validateReaderLocation } from './readerReference';

describe('reader reference input', () => {
  it('navigates every catalogue book using the shared chapter counts', () => {
    expect(READER_BOOKS).toHaveLength(66);
    for (const { name, chapters } of READER_BOOKS) {
      expect(parseReaderReference(`${name} ${chapters}:1`)).toEqual({ book: name, chapter: chapters, verse: 1 });
      expect(parseReaderReference(name)).toEqual({ book: name, chapter: 1, verse: null });
      expect(() => parseReaderReference(`${name} ${chapters + 1}`)).toThrow(/only has/);
    }
  });
  it.each([
    ['john 3:16', 'John', 3, 16], ['Jn.3:16', 'John', 3, 16],
    ['1 Cor 13:4', '1 Corinthians', 13, 4], ['II Timothy 1:7', '2 Timothy', 1, 7],
    ['Psalm 23', 'Psalms', 23, null], ['Song of Songs 2:1', 'Song of Solomon', 2, 1],
    ['  Ｊｏｈｎ ３：１６  ', 'John', 3, 16], ['3JN 1:4', '3 John', 1, 4],
  ])('accepts %s', (input, book, chapter, verse) => {
    expect(parseReaderReference(input)).toEqual({ book, chapter, verse });
  });
  it.each(['', 'John 3:16 trailing', 'John 3.5:16', 'John -3:16', 'John 3:0',
    'John 0:1', 'John 3:16-18', 'Hezekiah 4:5', 'John 22:1', 'John 3:37'])('rejects %s without truncating it', (text) => {
    expect(() => parseReaderReference(text)).toThrow();
  });
  it.each(['2.5', '3abc', '1e2', '-1', 'Infinity', '', '9007199254740993'])('rejects an invalid split chapter %s', (chapter) => {
    expect(() => validateReaderLocation({ book: 'John', chapter })).toThrow();
  });
  it.each(['2.5', '3abc', '1e2', '-1', '0'])('rejects an invalid split verse %s', (verse) => {
    expect(() => validateReaderLocation({ book: 'John', chapter: 3, verse })).toThrow();
  });
  it('accepts typed books separately or a full passage in the Book box', () => {
    expect(resolveReaderEntry('jn', '3', '16')).toEqual({ book: 'John', chapter: 3, verse: 16 });
    expect(resolveReaderEntry('Jn 3:16', '50', '99')).toEqual({ book: 'John', chapter: 3, verse: 16 });
    expect(resolveReaderBook('Jo')).toBeNull();
  });
  it('preserves audited translation-specific verse limits', () => {
    expect(parseReaderReference('Romans 14:26', { translation: 'web' }).verse).toBe(26);
    expect(() => parseReaderReference('Romans 14:24', { translation: 'kjv' })).toThrow('only has 23 verses');
    expect(() => parseReaderReference('Romans 16:26', { translation: 'en-web' })).toThrow('only has 25 verses');
    expect(parseReaderReference('Romans 14:24', { translation: 'bbe' }).verse).toBe(24);
  });
  it('honors both NT-only and OT-only translation restrictions', () => {
    expect(() => parseReaderReference('Genesis 1:1', { translationBookInfo: { isNTOnly: true } })).toThrow(/not available/);
    expect(() => parseReaderReference('John 3:16', { translationBookInfo: { isOTOnly: true } })).toThrow(/not available/);
    expect(parseReaderReference('John 3:16', { translationBookInfo: { isNTOnly: true } }).book).toBe('John');
  });
});
