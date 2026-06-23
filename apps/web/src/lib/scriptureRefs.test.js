import { describe, it, expect } from 'vitest';
import {
  extractScriptureRefs,
  validateScriptureRefs,
  validateAiSermon,
} from '@/lib/scriptureRefs';
import { VERSE_COUNTS, versesInChapter } from '@/lib/bibleVerseCounts';

// Canonical chapter counts (mirrors the table inside scriptureRefs) — used to
// assert the verse-count table is internally consistent.
const EXPECTED_CHAPTERS = {
  genesis: 50, exodus: 40, leviticus: 27, numbers: 36, deuteronomy: 34,
  joshua: 24, judges: 21, ruth: 4, '1 samuel': 31, '2 samuel': 24,
  '1 kings': 22, '2 kings': 25, '1 chronicles': 29, '2 chronicles': 36,
  ezra: 10, nehemiah: 13, esther: 10, job: 42, psalms: 150,
  proverbs: 31, ecclesiastes: 12, 'song of solomon': 8,
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

describe('bibleVerseCounts table integrity', () => {
  it('has the correct number of chapters for every book', () => {
    for (const [book, chapters] of Object.entries(EXPECTED_CHAPTERS)) {
      expect(VERSE_COUNTS[book], book).toBeDefined();
      expect(VERSE_COUNTS[book].length, `${book} chapter count`).toBe(chapters);
    }
  });

  it('verse counts are positive integers', () => {
    for (const [book, arr] of Object.entries(VERSE_COUNTS)) {
      for (let i = 0; i < arr.length; i++) {
        expect(Number.isInteger(arr[i]) && arr[i] > 0, `${book} ch${i + 1}`).toBe(true);
      }
    }
  });

  it('knows the longest chapter is Psalm 119 with 176 verses', () => {
    expect(versesInChapter('Psalms', 119)).toBe(176);
    expect(versesInChapter('John', 3)).toBe(36);
    expect(versesInChapter('Jude', 1)).toBe(25);
    expect(versesInChapter('Made Up', 1)).toBe(null);
  });
});

describe('extractScriptureRefs', () => {
  it('pulls references out of prose', () => {
    const refs = extractScriptureRefs('As John 3:16 says, and again in Romans 8:28-30 we read.');
    expect(refs).toContain('John 3:16');
    expect(refs.some((r) => r.startsWith('Romans 8:28'))).toBe(true);
  });

  it('handles empty / nullish input', () => {
    expect(extractScriptureRefs('')).toEqual([]);
    expect(extractScriptureRefs(null)).toEqual([]);
  });
});

describe('validateScriptureRefs', () => {
  it('accepts a valid reference', () => {
    const [r] = validateScriptureRefs(['John 3:16']);
    expect(r.status).toBe('valid');
    expect(r.validBook).toBe(true);
    expect(r.chapter).toBe(3);
    expect(r.verse).toBe(16);
  });

  it('flags a made-up book', () => {
    const [r] = validateScriptureRefs(['Hezekiah 4:5']);
    expect(r.status).toBe('invalid_book');
    expect(r.validBook).toBe(false);
  });

  it('flags an impossible chapter (John has 21)', () => {
    const [r] = validateScriptureRefs(['John 99:99']);
    expect(r.validBook).toBe(true);
    expect(r.status).toBe('out_of_range');
  });

  it('flags an absurd verse (> Psalm 119:176)', () => {
    const [r] = validateScriptureRefs(['Genesis 1:9000']);
    expect(r.status).toBe('out_of_range');
  });

  it('flags a precise verse overrun (John 3 has 36 verses)', () => {
    expect(validateScriptureRefs(['John 3:37'])[0].status).toBe('out_of_range');
    expect(validateScriptureRefs(['John 3:36'])[0].status).toBe('valid');
  });

  it('accepts single-chapter books like Jude', () => {
    const [r] = validateScriptureRefs(['Jude 1:5']);
    expect(r.status).toBe('valid');
  });

  it('accepts book aliases (Psalm == Psalms)', () => {
    const [r] = validateScriptureRefs(['Psalm 119:105']);
    expect(r.status).toBe('valid');
  });
});

describe('validateAiSermon', () => {
  it('summarises a clean sermon as all-valid', () => {
    const out = validateAiSermon({
      anchor_passage: 'John 3:16',
      points: [{ supporting_scriptures: ['Romans 8:28'], text: '' }],
      conclusion: 'Ephesians 2:8',
    });
    expect(out.allValid).toBe(true);
    expect(out.summary).toMatch(/all valid/);
  });

  it('catches a hallucinated reference and reports it needs attention', () => {
    const out = validateAiSermon({
      anchor_passage: 'John 99:1',
      points: [],
      conclusion: '',
    });
    expect(out.allValid).toBe(false);
    expect(out.summary).toMatch(/need attention/);
  });
});
