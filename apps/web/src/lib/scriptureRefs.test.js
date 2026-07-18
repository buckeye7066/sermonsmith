import { describe, it, expect } from 'vitest';
import {
  extractScriptureRefs,
  extractScriptureRefsDeep,
  validateScriptureRefs,
  validateAiSermon,
  validateAiContent,
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

describe('validateScriptureRefs — verse-range end-points', () => {
  it('accepts a well-formed range (Romans 8 has 39 verses)', () => {
    const [r] = validateScriptureRefs(['Romans 8:28-30']);
    expect(r.status).toBe('valid');
    expect(r.verse).toBe(28);
    expect(r.verseEnd).toBe(30);
  });

  it('rejects a range whose end-point overruns the chapter (John 3 has 36 verses)', () => {
    expect(validateScriptureRefs(['John 3:16-999'])[0].status).toBe('out_of_range');
    expect(validateScriptureRefs(['John 3:16-37'])[0].status).toBe('out_of_range');
    expect(validateScriptureRefs(['John 3:16-36'])[0].status).toBe('valid');
  });

  it('rejects a reversed range', () => {
    expect(validateScriptureRefs(['John 3:20-16'])[0].status).toBe('out_of_range');
  });

  it('extracts and validates en-dash ranges', () => {
    const refs = extractScriptureRefs('Read Acts 2:1–21 aloud.');
    expect(refs).toHaveLength(1);
    expect(validateScriptureRefs(refs)[0].status).toBe('valid');
  });
});

describe('validateScriptureRefs — canon awareness', () => {
  it('defaults to the Protestant canon: deuterocanon is unsupported_canon, not invalid_book', () => {
    const [r] = validateScriptureRefs(['Wisdom 3:1-9']);
    expect(r.status).toBe('unsupported_canon');
    expect(r.validBook).toBe(false);
  });

  it('recognizes deuterocanon books under the Catholic canon at chapter level', () => {
    const [r] = validateScriptureRefs(['Wisdom 3:1-9'], { canon: 'catholic' });
    expect(r.status).toBe('chapter_checked'); // real book, chapter valid, no verse table
    expect(r.validBook).toBe(true);
  });

  it('resolves deuterocanon aliases (Sirach == Ecclesiasticus, Wisdom of Solomon)', () => {
    expect(validateScriptureRefs(['Sirach 2:1'], { canon: 'catholic' })[0].status).toBe('chapter_checked');
    expect(validateScriptureRefs(['Ecclesiasticus 2:1'], { canon: 'orthodox' })[0].status).toBe('chapter_checked');
    expect(validateScriptureRefs(['Wisdom of Solomon 3:1'], { canon: 'catholic' })[0].status).toBe('chapter_checked');
  });

  it('still range-checks deuterocanon chapters (Wisdom has 19, 1 Maccabees 16)', () => {
    expect(validateScriptureRefs(['Wisdom 25:1'], { canon: 'catholic' })[0].status).toBe('out_of_range');
    expect(validateScriptureRefs(['1 Maccabees 17:1'], { canon: 'catholic' })[0].status).toBe('out_of_range');
    expect(validateScriptureRefs(['1 Maccabees 16:1'], { canon: 'catholic' })[0].status).toBe('chapter_checked');
  });

  it('rejects reversed ranges even without a verse table', () => {
    expect(validateScriptureRefs(['Wisdom 3:9-1'], { canon: 'catholic' })[0].status).toBe('out_of_range');
  });

  it('handles Greek Daniel (13-14) per canon', () => {
    expect(validateScriptureRefs(['Daniel 13:1'])[0].status).toBe('out_of_range'); // protestant
    expect(validateScriptureRefs(['Daniel 13:1'], { canon: 'catholic' })[0].status).toBe('chapter_checked');
    expect(validateScriptureRefs(['Daniel 12:1'], { canon: 'catholic' })[0].status).toBe('valid');
    expect(validateScriptureRefs(['Daniel 15:1'], { canon: 'catholic' })[0].status).toBe('out_of_range');
  });

  it('a truly made-up book stays invalid_book in every canon', () => {
    expect(validateScriptureRefs(['Hezekiah 4:5'], { canon: 'catholic' })[0].status).toBe('invalid_book');
    expect(validateScriptureRefs(['Hezekiah 4:5'], { canon: 'orthodox' })[0].status).toBe('invalid_book');
  });

  it('an unknown canon id falls back to protestant', () => {
    expect(validateScriptureRefs(['Wisdom 3:1'], { canon: 'martian' })[0].status).toBe('unsupported_canon');
    expect(validateScriptureRefs(['John 3:16'], { canon: 'martian' })[0].status).toBe('valid');
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

  it('catches a fabricated reference in big_idea / theological_notes / a point field', () => {
    for (const sermon of [
      { anchor_passage: 'John 3:16', big_idea: 'As Hezekiah 4:5 shows...' },
      { anchor_passage: 'John 3:16', theological_notes: 'See Hezekiah 4:5.' },
      { anchor_passage: 'John 3:16', points: [{ exegesis: 'Rooted in Hezekiah 4:5.' }] },
      { anchor_passage: 'John 3:16', points: [{ application: 'Live out Hezekiah 4:5.' }] },
      { anchor_passage: 'John 3:16', points: [{ illustration: 'Like Hezekiah 4:5 teaches.' }] },
    ]) {
      const out = validateAiSermon(sermon);
      expect(out.allValid).toBe(false);
      expect(out.refs.some((r) => r.ref === 'Hezekiah 4:5' && r.status === 'invalid_book')).toBe(true);
    }
  });

  it('keeps a Catholic sermon with a deuterocanon anchor in review (chapter_checked, not invalid)', () => {
    const out = validateAiSermon(
      {
        anchor_passage: 'Wisdom 3:1-9',
        points: [{ supporting_scriptures: ['John 11:25'], text: '' }],
        conclusion: '',
      },
      { canon: 'catholic' },
    );
    // Honest state: the reference is real Scripture in this canon but the
    // verse level is not yet source-verified, so the sermon must not be
    // reported as all-valid…
    expect(out.allValid).toBe(false);
    // …and it must not be smeared as a fabricated book either.
    expect(out.refs.find((r) => r.ref === 'Wisdom 3:1-9').status).toBe('chapter_checked');
    expect(out.counts.chapter_checked).toBe(1);
    expect(out.counts.valid).toBe(1);
  });
});

describe('extractScriptureRefsDeep / validateAiContent (shape-agnostic sweep)', () => {
  it('collects references from arbitrarily nested strings and arrays', () => {
    const refs = extractScriptureRefsDeep({
      overview: 'Grounded in Ephesians 2:8.',
      key_verses: ['Romans 8:28', 'John 3:16'],
      study_sections: [{ scripture: 'Psalm 23:1', questions: ['See Isaiah 40:31'] }],
    }).sort();
    expect(refs).toEqual(['Ephesians 2:8', 'Isaiah 40:31', 'John 3:16', 'Psalm 23:1', 'Romans 8:28']);
  });

  it('reaches into the double-nested ethics-analysis result shape', () => {
    const out = validateAiContent({
      data: {
        result: {
          biblical_foundation: {
            key_scriptures: [
              { reference: 'Ephesians 4:25' },
              { reference: 'Deuteronomy 99:1' },
            ],
          },
        },
      },
    });
    const statuses = out.refs.map((r) => r.status).sort();
    expect(statuses).toContain('valid');
    expect(statuses).toContain('out_of_range');
    expect(out.allValid).toBe(false);
  });

  it('does not re-sweep a previously-stored scripture_validation array', () => {
    const out = validateAiContent({
      key_verses: ['John 3:16'],
      // A prior validation blob whose ref would be double-counted if walked.
      scripture_validation: [{ ref: 'Genesis 1:1', status: 'valid' }],
    });
    expect(out.refs).toHaveLength(1);
    expect(out.refs[0].ref).toBe('John 3:16');
  });

  it('is canon-aware just like validateAiSermon', () => {
    const out = validateAiContent({ key_verses: ['Wisdom 3:1'] }, { canon: 'catholic' });
    expect(out.refs[0].status).toBe('chapter_checked');
    expect(out.allValid).toBe(false);
  });
});

describe('canonForDenomination', () => {
  it('maps Catholic and Orthodox traditions to their canons', async () => {
    const { canonForDenomination } = await import('@/lib/denominations');
    expect(canonForDenomination('Roman Catholic')).toBe('catholic');
    expect(canonForDenomination('Eastern Orthodox')).toBe('orthodox');
  });

  it('defaults everything else (including unknown traditions) to protestant', async () => {
    const { canonForDenomination } = await import('@/lib/denominations');
    expect(canonForDenomination('Southern Baptist')).toBe('protestant');
    expect(canonForDenomination('Church of God of Prophecy')).toBe('protestant');
    expect(canonForDenomination('')).toBe('protestant');
    expect(canonForDenomination('Totally Unknown Fellowship')).toBe('protestant');
  });
});
