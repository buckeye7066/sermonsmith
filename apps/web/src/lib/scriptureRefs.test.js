import { describe, it, expect } from 'vitest';
import {
  extractScriptureRefs,
  extractScriptureRefsDeep,
  extractScriptureRefsJoined,
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

  it('extracts references case-insensitively (lowercase/UPPER/mixed) — the foundational bypass', () => {
    for (const text of ['hezekiah 4:5', 'HEZEKIAH 4:5', 'Hezekiah 4:5', 'as hezekiah 4:5 shows us']) {
      expect(extractScriptureRefs(text).some((r) => /hezekiah\s+4:5/i.test(r))).toBe(true);
    }
    // A lowercase fabricated ref is now flagged, not silently dropped.
    expect(validateAiSermon({ big_idea: 'as hezekiah 4:5 reminds us' }).allValid).toBe(false);
    // Lowercase REAL refs validate correctly too.
    expect(validateScriptureRefs(extractScriptureRefs('see john 3:16'))[0].status).toBe('valid');
  });

  it('parses formatting variants: spaced colons, abbreviations, roman/worded prefixes, unicode', () => {
    const canon = (t) => extractScriptureRefs(t);
    const stat = (t) => validateScriptureRefs(extractScriptureRefs(t))[0]?.status;
    // Fabricated variants must be CAUGHT (invalid / out_of_range).
    expect(stat('hezekiah 4 : 5')).toBe('invalid_book');       // spaces around colon
    expect(stat('Hez. 4:5')).toBe('invalid_book');             // abbreviation + period
    expect(stat('II Hezekiah 4:5')).toBe('invalid_book');      // roman prefix + fabricated book
    expect(stat('II John 1:20')).toBe('out_of_range');         // BOUND to 2 John (no v20), not John
    expect(canon('II John 1:20')).toEqual(['2 John 1:20']);    // prefix bound to the right book
    expect(stat('hezekiah 4：5')).toBe('invalid_book');         // fullwidth colon
    expect(stat('hezekiah ４：５')).toBe('invalid_book');        // fullwidth digits
    // Legit variants must VALIDATE.
    expect(stat('Gen. 1:1')).toBe('valid');
    expect(stat('1 Cor 13:4')).toBe('valid');
    expect(stat('II Tim 1:7')).toBe('valid');
    expect(stat('First John 3:16')).toBe('valid');
    expect(canon('II Tim 1:7')).toEqual(['2 Timothy 1:7']);
  });

  it('normalizes the full INVISIBLE separator set (controls / format / default-ignorable / combining marks)', () => {
    // Truly-invisible chars (Cc/Cf/DI) are replaced globally, so they also bind a
    // numeric prefix through the separator.
    const invisibleSeps = [
      0x01, 0x1c, 0x1d, 0x1e, 0x1f,
      0x7f, 0x80, 0x85, 0x9f,
      0x200b, 0x200c, 0x200d,
      0x2060, 0xfeff, 0x00ad,
      0x034f, 0xfe00, 0xfe0f,
      0x180b, 0x3164, 0xe0100,
    ];
    for (const code of invisibleSeps) {
      const sep = String.fromCodePoint(code);
      expect(extractScriptureRefs(`Hezekiah${sep}4:5`), `U+${code.toString(16)}`).toContain('Hezekiah 4:5');
      expect(validateScriptureRefs(extractScriptureRefs(`John${sep}3:16`))[0].status).toBe('valid');
      expect(extractScriptureRefs(`II${sep}John 1:1`)).toEqual(['2 John 1:1']);
    }
    // Combining marks (M, non-DI) are boundary-aware: a mark at the book-chapter
    // (letter-digit) boundary that has no precomposed form (h + these marks does
    // not compose) is caught as a hidden separator → fabricated book flagged.
    for (const code of [0x0300, 0x0301, 0x20dd, 0x20e3]) {
      const sep = String.fromCodePoint(code);
      expect(extractScriptureRefs(`Hezekiah${sep}4:5`), `U+${code.toString(16)}`).toContain('Hezekiah 4:5');
      expect(validateScriptureRefs(extractScriptureRefs(`Hezekiah${sep}4:5`))[0].status).toBe('invalid_book');
    }
    expect(extractScriptureRefs('See John 3:16')).toContain('John 3:16');
    expect(extractScriptureRefs('an ordinary sentence with no reference')).toEqual([]);
  });

  it('mark-hidden book name is caught regardless of mark position / NFC composition; accented prose is not', () => {
    const grave = String.fromCodePoint(0x0300); // h+grave: no precomposed form
    const dot = String.fromCodePoint(0x0307);   // h+dot: NFC COMPOSES to ḣ (U+1E23)
    // The fabricated biblical-book-shaped name is caught however the mark hides it:
    // before a space, before a digit, and whether or not NFC composed the mark.
    for (const attack of [
      `Hezekiah${grave} 4:5`,   // mark then space (letter↔space)
      `Hezekiah${dot} 4:5`,     // NFC-composed (ḣ), then space
      `Hezekiah${dot}4:5`,      // NFC-composed (ḣ), then digit (no space)
      'Hezekiah 4:5',           // plain (normal-space fabricated book)
    ]) {
      expect(validateScriptureRefs(extractScriptureRefs(attack))[0]?.status, JSON.stringify([...attack]))
        .toBe('invalid_book');
    }
    // ...but a legit accented common word + a ratio-like N:N is NOT a citation:
    // NFC keeps the accent as a letter, and the mark-stripped base (cafe/resume)
    // is not book-shaped, so it is never flagged.
    const acute = String.fromCodePoint(0x0301);
    for (const text of [
      `cafe${acute} 4:5`,       // café 4:5 (decomposed)
      'café 4:5',               // café 4:5 (NFC-composed)
      `re${acute}sume${acute} 4:5`, // résumé 4:5 (decomposed)
      'cafe 4:5',               // plain ASCII common word + ratio
      `a decomposed accent cafe${acute} sits at 2:1 in prose`,
    ]) {
      expect(extractScriptureRefs(text), JSON.stringify([...text])).toEqual([]);
    }
    // Real refs and roman-numeral books still validate.
    expect(validateScriptureRefs(extractScriptureRefs('John 3:16'))[0].status).toBe('valid');
    expect(extractScriptureRefs('II John 1:1')).toEqual(['2 John 1:1']);
  });

  it('a WORD-INTERNAL mark is deleted (token rejoins) so a mark-hidden KNOWN book out of range is caught', () => {
    const acute = String.fromCodePoint(0x0301);
    const dot = String.fromCodePoint(0x0307); // composes h+dot -> ḣ
    // Internal mark inside a known book, out-of-range chapter → caught.
    expect(validateScriptureRefs(extractScriptureRefs(`Joh${acute}n 99:1`))[0]?.status).toBe('out_of_range');
    expect(validateScriptureRefs(extractScriptureRefs(`Joh${dot}n 99:1`))[0]?.status).toBe('out_of_range');
    // Numbered book, internal mark, out of range → bound to 2 John and caught.
    expect(extractScriptureRefs(`II Joh${dot}n 99:1`)).toEqual(['2 John 99:1']);
    expect(validateScriptureRefs(extractScriptureRefs(`II Joh${dot}n 99:1`))[0].status).toBe('out_of_range');
    // A boundary mark (letter↔digit) still becomes a space, not deleted.
    expect(validateScriptureRefs(extractScriptureRefs(`Hezekiah${dot}4:5`))[0].status).toBe('invalid_book');
    // No mark present → the token is never mangled by deletion.
    expect(validateScriptureRefs(extractScriptureRefs('John 3:16'))[0].status).toBe('valid');
  });

  it('folds NFKC compatibility characters (roman numerals, math/fullwidth digits) in the detection shadow', () => {
    const stat = (t) => validateScriptureRefs(extractScriptureRefs(t))
      .map((r) => r.status);
    // U+2161 ROMAN NUMERAL TWO folds to "II" → bound to 2 John (13 verses) → v20 out of range.
    expect(extractScriptureRefs('Ⅱ John 1:20')).toContain('2 John 1:20');
    expect(stat('Ⅱ John 1:20')).toContain('out_of_range');
    // Mathematical bold digits (U+1D7D7 = 9, U+1D7CF = 1) fold to ASCII → "John 99:1" out of range.
    expect(extractScriptureRefs('John \u{1D7D7}\u{1D7D7}:\u{1D7CF}')).toContain('John 99:1');
    expect(stat('John \u{1D7D7}\u{1D7D7}:\u{1D7CF}')[0]).toBe('out_of_range');
    // NFKC is detection-only: legit refs are unaffected.
    expect(validateScriptureRefs(extractScriptureRefs('II John 1:1'))[0].status).toBe('valid');
  });

  it('deletes a zero-width char INSIDE a digit run so the true (out-of-range) verse is seen', () => {
    const zwsp = '​';
    // ZWSP between the two verse digits: rendered "John 3:99" (John 3 has 36 verses),
    // not the truncated in-range "John 3:9". The full number must be reconstructed
    // by the shadow so the union contains an out-of-range ref (→ content fails the
    // all-valid screen), even though the normal pass also sees the truncated "3:9".
    expect(extractScriptureRefs(`John 3:9${zwsp}9`)).toContain('John 3:99');
    const digitSplit = validateScriptureRefs(extractScriptureRefs(`John 3:9${zwsp}9`));
    expect(digitSplit.some((r) => r.ref === 'John 3:99' && r.status === 'out_of_range')).toBe(true);
    // ZWSP inside the BOOK token: rejoins to the known book, out-of-range chapter caught.
    expect(validateScriptureRefs(extractScriptureRefs(`Joh${zwsp}n 99:1`))[0].status).toBe('out_of_range');
    expect(validateScriptureRefs(extractScriptureRefs(`Hezekia${zwsp}h 4:5`))[0].status).toBe('invalid_book');
  });

  it('a compatibility numeral prefix fused to a book by an invisible seam is bound to the numbered book', () => {
    const zwsp = '​';
    // "Ⅱ" + zero-width-space + "John 1:20": NFKC folds Ⅱ (U+2161) to "II", and
    // the NFKC+global pass keeps the prefix a separate token → 2 John 1:20
    // (2 John has 13 verses in ch.1 → verse 20 is out of range).
    expect(extractScriptureRefs(`Ⅱ${zwsp}John 1:20`)).toContain('2 John 1:20');
    expect(validateScriptureRefs([...extractScriptureRefs(`Ⅱ${zwsp}John 1:20`)])
      .some((r) => r.ref === '2 John 1:20' && r.status === 'out_of_range')).toBe(true);
    expect(extractScriptureRefs(`Ⅲ${zwsp}John 1:20`)).toContain('3 John 1:20');
    // A genuine numbered reference is unaffected.
    expect(extractScriptureRefs('II John 1:1')).toEqual(['2 John 1:1']);
  });

  it('normalizes non-ASCII decimal digits (Arabic-Indic, Devanagari) so out-of-range refs are caught', () => {
    const ai = (v) => String.fromCodePoint(0x0660 + v);   // Arabic-Indic 0-9
    const dv = (v) => String.fromCodePoint(0x0966 + v);   // Devanagari 0-9
    // "John 3:٣٧" renders John 3:37 (John 3 has 36 verses) → out of range.
    expect(extractScriptureRefs(`John 3:${ai(3)}${ai(7)}`)).toContain('John 3:37');
    expect(validateScriptureRefs(extractScriptureRefs(`John 3:${ai(3)}${ai(7)}`))[0].status).toBe('out_of_range');
    // "John ٩٩:١" renders John 99:1 → out of range (no chapter 99).
    expect(validateScriptureRefs(extractScriptureRefs(`John ${ai(9)}${ai(9)}:${ai(1)}`))[0].status).toBe('out_of_range');
    // Devanagari digits fold too.
    expect(validateScriptureRefs(extractScriptureRefs(`John ${dv(3)}:${dv(3)}${dv(7)}`))[0].status).toBe('out_of_range');
    // A non-ASCII-digit numbered-book prefix binds correctly.
    expect(extractScriptureRefs(`${ai(2)} John 1:20`)).toContain('2 John 1:20');
    // A VALID reference written with non-ASCII digits still validates (no false positive).
    expect(validateScriptureRefs(extractScriptureRefs(`John ${dv(3)}:${dv(1)}${dv(6)}`))[0].status).toBe('valid');
    // ASCII digits and accented prose are untouched.
    expect(validateScriptureRefs(extractScriptureRefs('John 3:16'))[0].status).toBe('valid');
    expect(extractScriptureRefs('café 4:5')).toEqual([]);
  });

  it('a citation cannot START mid-word after a Unicode letter / apostrophe (accented-prose false positive)', () => {
    // The ASCII book regex must not begin inside a non-ASCII word: "naïve 4:5" once
    // yielded "ve 4:5" and "L'Oréal 4:5" yielded "al 4:5", both screened as fabricated.
    expect(extractScriptureRefs('naïve 4:5')).toEqual([]);
    expect(extractScriptureRefs("L'Oréal 4:5")).toEqual([]);
    expect(extractScriptureRefs('résumé 4:5')).toEqual([]);
    // Genuine refs immediately after an apostrophe boundary still parse.
    expect(validateScriptureRefs(extractScriptureRefs('John 3:16'))[0].status).toBe('valid');
  });

  it('folds EVERY Unicode decimal-digit code point to its ASCII value (property sweep)', () => {
    const ndRe = /\p{Nd}/u;
    let tested = 0;
    for (let cp = 0x0600; cp <= 0x1FBFF; cp += 1) {
      const ch = String.fromCodePoint(cp);
      if (!ndRe.test(ch) || (cp >= 0x30 && cp <= 0x39)) continue;
      tested += 1;
      // Expected value via the same contiguous-run rule the extractor uses.
      let start = cp;
      while (start > 0 && cp - start < 10 && ndRe.test(String.fromCodePoint(start - 1))) start -= 1;
      const expected = (cp - start) % 10;
      // Put the exotic digit in the chapter position; the extracted chapter must be its ASCII value.
      const out = extractScriptureRefs(`Genesis ${ch}:1`);
      const m = out[0] && /Genesis (\d+):1/.exec(out[0]);
      expect(m && m[1], `U+${cp.toString(16)} → ${expected}`).toBe(String(expected));
    }
    // Includes Kawi (U+11F50) and Nag Mundari (U+1E4F0), which have no NFKC folding.
    expect(tested).toBeGreaterThan(500);
    expect(validateScriptureRefs(extractScriptureRefs(`John ${String.fromCodePoint(0x11F53)}:${String.fromCodePoint(0x11F53)}${String.fromCodePoint(0x11F57)}`))[0].status).toBe('out_of_range'); // Kawi John 3:37
  });

  it('parses Roman-numeral chapter / verse / range-end and range-checks the converted number', () => {
    const stat = (t) => validateScriptureRefs(extractScriptureRefs(t)).map((r) => r.status);
    // Roman CHAPTER: "John III:37" → John 3:37 (John 3 has 36 verses) → out of range.
    expect(extractScriptureRefs('John III:37')).toContain('John 3:37');
    expect(stat('John III:37')).toContain('out_of_range');
    // Roman VERSE: "John 3:XXXVII" → John 3:37 → out of range.
    expect(extractScriptureRefs('John 3:XXXVII')).toContain('John 3:37');
    // Unicode Roman numeral (U+2162 = Ⅲ) folds via NFKC → chapter 3.
    expect(extractScriptureRefs('John Ⅲ:37')).toContain('John 3:37');
    // Numbered book + Roman chapter AND verse: "II John I:XX" → 2 John 1:20 (oor).
    expect(validateScriptureRefs(extractScriptureRefs('II John I:XX'))[0].status).toBe('out_of_range');
    // A legit ASCII reference is unaffected, and a Roman token that heads a longer
    // word is NOT parsed as a verse ("Luke 2:live" → no ref, not verse "liv"=54).
    expect(validateScriptureRefs(extractScriptureRefs('John 3:16'))[0].status).toBe('valid');
    expect(extractScriptureRefs('Luke 2:live')).toEqual([]);
  });

  it('binds compact / hyphen / dot numbered-book prefixes to the numbered book', () => {
    // "2John"/"2-John"/"2.John"/"IIJohn" all → 2 John 1:20 (2 John ch.1 has 13 verses → oor).
    for (const form of ['2John 1:20', '2-John 1:20', '2.John 1:20', 'IIJohn 1:20']) {
      expect(extractScriptureRefs(form), form).toContain('2 John 1:20');
      expect(validateScriptureRefs(extractScriptureRefs(form))[0].status, form).toBe('out_of_range');
    }
    // A hyphenated NON-book is not mis-bound to a numbered book (stays plain John).
    const pseudo = extractScriptureRefs('pseudo-John 4:5');
    expect(pseudo.some((r) => /^[123] /.test(r))).toBe(false);
    expect(pseudo).toContain('John 4:5');
    // A real book that merely STARTS with a numeral-prefix letter is never split.
    expect(extractScriptureRefs('Isaiah 3:1')).toEqual(['Isaiah 3:1']);
    // Genuine spaced forms still correct.
    expect(extractScriptureRefs('II John 1:1')).toEqual(['2 John 1:1']);
    expect(validateScriptureRefs(extractScriptureRefs('1 John 1:1'))[0].status).toBe('valid');
  });

  it('binds a book GLUED to chapter:verse with no space, gated by book-shape', () => {
    const stat = (t) => validateScriptureRefs(extractScriptureRefs(t)).map((r) => r.status);
    // Known book / abbreviation / book-shaped name glued to the numbers → bound.
    expect(extractScriptureRefs('John3:37')).toContain('John 3:37'); // John 3 has 36 verses
    expect(stat('John3:37')).toContain('out_of_range');
    expect(stat('Jn3:37')).toContain('out_of_range');
    expect(validateScriptureRefs(extractScriptureRefs('Hezekiah4:5'))[0].status).toBe('invalid_book');
    expect(stat('John3:XXXVII')).toContain('out_of_range'); // glued + Roman verse
    // A glued VALID reference is still valid; a non-book word touching digits is NOT bound.
    expect(validateScriptureRefs(extractScriptureRefs('John3:16'))[0].status).toBe('valid');
    expect(extractScriptureRefs('cafe4:5')).toEqual([]);
    expect(extractScriptureRefs('size10:30')).toEqual([]);
  });

  it('binds a compact numeric/Roman prefix to a FABRICATED book-shaped name (flagged), never splitting a real book', () => {
    const kawi2 = String.fromCodePoint(0x11F52); // Kawi digit 2
    // Fabricated compact numbered refs are bound and flagged invalid_book (not dropped).
    for (const form of ['2Hezekiah 4:5', '2-Hezekiah 4:5', '2.Hezekiah 4:5', 'IIHezekiah 4:5', `${kawi2}Hezekiah 4:5`]) {
      const v = validateScriptureRefs(extractScriptureRefs(form));
      expect(v.some((r) => /^2 Hezekiah/.test(r.ref) && r.status === 'invalid_book'), form).toBe(true);
    }
    // A KNOWN compact numbered ref binds to the numbered book (out of range).
    expect(extractScriptureRefs('2John 1:20')).toContain('2 John 1:20');
    // A real book that starts with a numeral-prefix letter is NEVER split.
    expect(extractScriptureRefs('Isaiah 5:1')).toEqual(['Isaiah 5:1']);
    // A hyphenated non-book is not mis-bound to a numbered book (stays plain Hezekiah).
    const pseudo = extractScriptureRefs('pseudo-Hezekiah 4:5');
    expect(pseudo.some((r) => /^[123] /.test(r))).toBe(false);
    expect(pseudo).toContain('Hezekiah 4:5');
  });

  it('rejects NON-canonical Roman numerals instead of coercing them to a valid ref', () => {
    // "IIV" is not a well-formed Roman numeral → must NOT validate as John 5:1.
    expect(validateScriptureRefs(extractScriptureRefs('John IIV:1')).every((r) => r.status !== 'valid')).toBe(true);
    // Unicode Roman that folds to the same non-canonical "IIV".
    expect(validateScriptureRefs(extractScriptureRefs('John ⅠⅠⅤ:1')).every((r) => r.status !== 'valid')).toBe(true);
    // A malformed Roman RANGE end must not be silently dropped (→ leaving a clean "3:1").
    const rng = validateScriptureRefs(extractScriptureRefs('John 3:1-IIV'));
    expect(rng.length).toBeGreaterThan(0);
    expect(rng.every((r) => r.status !== 'valid')).toBe(true);
    // Canonical Roman still parses: III → 3 (out of range here), IV → 4 (valid).
    expect(extractScriptureRefs('John III:37')).toContain('John 3:37');
    expect(validateScriptureRefs(extractScriptureRefs('John IV:2'))[0].status).toBe('valid');
    // Direct validator: a malformed range is out_of_range, a good one is valid.
    expect(validateScriptureRefs(['John 3:1-IIV'])[0].status).toBe('out_of_range');
    expect(validateScriptureRefs(['John 3:1-5'])[0].status).toBe('valid');
  });

  it('never DROPS an overlong numeric / Roman token — validation classifies the failure', () => {
    const stat = (t) => validateScriptureRefs(extractScriptureRefs(t)).map((r) => r.status);
    // A 4+-digit chapter/verse is captured in full and range-checked (not truncated / dropped).
    expect(extractScriptureRefs('John 1000:1')).toContain('John 1000:1');
    expect(stat('John 1000:1')).toContain('out_of_range');
    expect(stat('John 99999:1')).toContain('out_of_range');
    expect(stat('John 3:99999')).toContain('out_of_range');
    // An overlong (16-I) Roman range end is preserved and flagged, not silently trimmed to a valid "3:1".
    const longI = 'I'.repeat(16);
    const rng = validateScriptureRefs(extractScriptureRefs(`John 3:1-${longI}`));
    expect(rng.length).toBeGreaterThan(0);
    expect(rng.every((r) => r.status !== 'valid')).toBe(true);
    // An overlong Roman chapter is likewise captured and flagged.
    expect(validateScriptureRefs(extractScriptureRefs(`John ${longI}:1`)).every((r) => r.status !== 'valid')).toBe(true);
    // Legit references are unaffected.
    expect(validateScriptureRefs(extractScriptureRefs('John 3:16'))[0].status).toBe('valid');
    expect(validateScriptureRefs(extractScriptureRefs('John 3:1-5'))[0].status).toBe('valid');
    expect(validateScriptureRefs(['Psalms 119:176'])[0].status).toBe('valid'); // 3-digit chapter+verse still valid
  });

  it('binds WORDED (first/second/third) compact / hyphen / dot numbered-book prefixes', () => {
    // Worded prefix + no-space / hyphen / dot → numbered book, out of range (2 John ch.1 has 13 verses).
    for (const form of ['Second-John 1:20', 'Third.John 1:20', 'SecondJohn 1:20', 'ThirdJohn 1:20']) {
      const refs = extractScriptureRefs(form);
      expect(refs.some((r) => /^[23] John 1:20$/.test(r)), form).toBe(true);
      expect(refs.includes('John 1:20'), `${form} must not extract bare John`).toBe(false);
    }
    expect(validateScriptureRefs(extractScriptureRefs('First-John 5:22'))[0].status).toBe('out_of_range'); // 1 John has 5 ch
    // Deep + joined-array paths (schema-coercion recombination) catch it too.
    expect(extractScriptureRefsDeep({ note: 'Second-John 1:20' })).toContain('2 John 1:20');
    const joined = extractScriptureRefsJoined(['Second-John', '1:20']);
    expect(joined).toContain('2 John 1:20');
    expect(joined.includes('John 1:20')).toBe(false);
    // Spaced worded forms still validate correctly (2/1 John 1:1 exist).
    expect(validateScriptureRefs(extractScriptureRefs('Second John 1:1'))[0].status).toBe('valid');
    expect(validateScriptureRefs(extractScriptureRefs('First John 1:1'))[0].status).toBe('valid');
    // A real book that starts with a prefix-like word fragment is never split.
    expect(extractScriptureRefs('Isaiah 5:1')).toEqual(['Isaiah 5:1']);
  });

  it('flags an UNSUPPORTED numbered-book prefix (never reinterprets it as the bare valid book)', () => {
    const CANONS = ['protestant', 'catholic', 'orthodox'];
    // The reference is CAUGHT: some extracted ref is a fabricated numbered book
    // (invalid in every canon), so the all-valid screen fails.
    const isCaught = (t) => {
      const refs = extractScriptureRefs(t);
      const fabricated = refs.filter((ref) => !CANONS.some((canon) => {
        const [r] = validateScriptureRefs([ref], { canon });
        return r && (r.status === 'valid' || r.status === 'chapter_checked');
      }));
      return fabricated.some((ref) => /^\d+ John/.test(ref));
    };
    for (const form of ['4 John 1:1', 'Ⅳ John 1:1', 'IV John 1:1', 'Fourth-John 1:1', 'IIII-John 1:1', '4John 1:1', `${String.fromCodePoint(0x0664)} John 1:1`]) {
      expect(isCaught(form), form).toBe(true);
    }
    // For pure-ASCII forms the prefix is consumed by the match, so it does NOT
    // additionally reinterpret as a bare valid "John 1:1".
    for (const form of ['4 John 1:1', 'IV John 1:1', '4John 1:1', 'Fourth-John 1:1']) {
      expect(extractScriptureRefs(form).includes('John 1:1'), form).toBe(false);
    }
    // "5 Corinthians" (a numbered stem, unsupported number) is likewise invalid.
    expect(validateScriptureRefs(extractScriptureRefs('5 Corinthians 1:1'))[0].status).toBe('invalid_book');
    // Deep + joined-array paths.
    expect(extractScriptureRefsDeep({ note: '4 John 1:1' })).toContain('4 John 1:1');
    const joined = extractScriptureRefsJoined(['4 John', '1:1']);
    expect(joined).toContain('4 John 1:1');
    expect(joined.includes('John 1:1')).toBe(false);
    // SUPPORTED prefixes and the bare Gospel stay correct.
    expect(validateScriptureRefs(extractScriptureRefs('John 1:1'))[0].status).toBe('valid'); // bare Gospel
    expect(validateScriptureRefs(extractScriptureRefs('2 John 1:1'))[0].status).toBe('valid');
    expect(validateScriptureRefs(extractScriptureRefs('3 John 1:1'))[0].status).toBe('valid');
    // A spurious number on a NON-numbered book is dropped → the bare book validates.
    expect(validateScriptureRefs(extractScriptureRefs('5 Psalms 119:1'))[0].status).toBe('valid');
    expect(extractScriptureRefs('5 Psalms 119:1')).toContain('Psalms 119:1');
  });

  it('flags a numeric token with trailing letters as malformed (no truncate-to-valid)', () => {
    const stat = (t) => validateScriptureRefs(extractScriptureRefs(t)).map((r) => r.status);
    // Trailing garbage after a chapter/verse/range number → whole ref malformed.
    for (const form of ['John 3:16I', 'Psalms 119:176I', 'John 3:1-5I', 'John 3:1-5abc']) {
      const v = validateScriptureRefs(extractScriptureRefs(form));
      expect(v.length, form).toBeGreaterThan(0);
      expect(v.every((r) => r.status !== 'valid'), form).toBe(true);
    }
    // Direct validator: trailing letters make the token malformed → out_of_range.
    expect(validateScriptureRefs(['John 3:16I'])[0].status).toBe('out_of_range');
    expect(validateScriptureRefs(['John 3:1-5abc'])[0].status).toBe('out_of_range');
    // Clean references (incl. the longest chapter) are unaffected, and a real word
    // after a real space is NOT swallowed / flagged.
    expect(stat('John 3:16')).toEqual(['valid']);
    expect(stat('John 3:1-5')).toEqual(['valid']);
    expect(validateScriptureRefs(['Psalms 119:176'])[0].status).toBe('valid');
    expect(extractScriptureRefs('John 3:16 is a great verse')).toEqual(['John 3:16']);
  });

  it('applies the malformed-suffix rule UNIFORMLY to Roman chapter/verse/range tokens', () => {
    // A trailing NON-ASCII letter/mark after a Roman token is malformed, not truncated to valid.
    for (const form of ['John 3:XЖ', 'John 3:Xé', 'John 3:IVé', 'John 3:I-Vabc']) {
      const v = validateScriptureRefs(extractScriptureRefs(form));
      expect(v.length, form).toBeGreaterThan(0);
      expect(v.every((r) => r.status !== 'valid' && r.status !== 'chapter_checked'), form).toBe(true);
    }
    // A clean canonical Roman still validates; an ASCII word after a colon is prose (no match).
    expect(validateScriptureRefs(extractScriptureRefs('John IV:2'))[0].status).toBe('valid');
    expect(extractScriptureRefs('John 2:live your faith')).toEqual([]);
  });

  it('reads a SPACED-separator prefix as an OUTLINE marker → bare book (documented trade-off, no list false-positive)', () => {
    // A numbered-list / outline item ("2 - John 3:16", "1 - John 3:16", "2. John 3:16")
    // must read as the VALID bare Gospel John — NOT be rejected as a numbered book,
    // and NOT emit a spurious numbered ref. (This is the r30 reversal of the r29
    // spaced-separator over-binding, which wrongly rejected valid outline refs.)
    for (const form of ['2 - John 3:16', '1 - John 3:16', '2. John 3:16', '2 . John 3:16']) {
      const refs = extractScriptureRefs(form);
      expect(refs, form).toEqual(['John 3:16']);
      expect(validateScriptureRefs(refs)[0].status, form).toBe('valid');
    }
    expect(extractScriptureRefs('3 - John 1:1')).toEqual(['John 1:1']);
    // DOCUMENTED TRADE-OFF: a fabricated numbered book with a SPACED separator
    // ("4 - John 1:1") reads as the valid bare "John 1:1" — accepted residual.
    expect(extractScriptureRefs('4 - John 1:1')).toEqual(['John 1:1']);
    // The UNAMBIGUOUS compact forms (no space / single space) still trap unsupported prefixes.
    expect(validateScriptureRefs(extractScriptureRefs('4John 1:1'))[0].status).toBe('invalid_book');
    expect(validateScriptureRefs(extractScriptureRefs('4-John 1:1'))[0].status).toBe('invalid_book');
    expect(validateScriptureRefs(extractScriptureRefs('Fourth John 1:1'))[0].status).toBe('invalid_book');
    // Supported ref still valid; hyphenated prose not mis-bound.
    expect(validateScriptureRefs(extractScriptureRefs('2 John 1:1'))[0].status).toBe('valid');
    expect(extractScriptureRefs('well - John 3:16').some((r) => /^[123] /.test(r))).toBe(false);
  });

  it('folds a Unicode-Roman prefix in EVERY pass so no spurious bare valid ref is emitted', () => {
    // "Ⅳ John 1:1" and the UNAMBIGUOUS compact forms produce ONLY the invalid
    // "4 John", never a bare valid "John 1:1" in the extractor / audit output.
    for (const form of ['Ⅳ John 1:1', 'ⅣJohn 1:1', 'Ⅳ-John 1:1', 'Ⅳ.John 1:1']) {
      const refs = extractScriptureRefs(form);
      expect(refs, form).toContain('4 John 1:1');
      expect(refs.includes('John 1:1'), form).toBe(false);
    }
    // A supported Unicode-Roman prefix still binds to the real numbered book.
    expect(validateScriptureRefs(extractScriptureRefs('Ⅱ John 1:1'))[0].status).toBe('valid'); // 2 John
    expect(extractScriptureRefs('Ⅱ John 1:1')).toEqual(['2 John 1:1']);
  });

  it('flags a Roman chapter/verse with an ASCII suffix (malformed) while keeping Roman-looking prose clean', () => {
    // Roman token + ASCII letters is a deliberate malformed numeral → caught.
    for (const form of ['John 3:Xabc', 'John IVabc:2', 'John 3:IVabc']) {
      const v = validateScriptureRefs(extractScriptureRefs(form));
      expect(v.length, form).toBeGreaterThan(0);
      expect(v.every((r) => r.status !== 'valid' && r.status !== 'chapter_checked'), form).toBe(true);
    }
    // A lowercase Roman-looking WORD is prose, not a citation (dropped, not flagged).
    expect(extractScriptureRefs('John 2:live your faith')).toEqual([]);
    expect(extractScriptureRefs('John 3:ivy grows')).toEqual([]);
    // Clean Roman (any case) still validates.
    expect(validateScriptureRefs(extractScriptureRefs('John iv:2'))[0].status).toBe('valid'); // John 4:2
    expect(extractScriptureRefs('John III:37')).toContain('John 3:37');
  });

  it('folds EVERY Unicode Roman numeral (U+2160–U+2188, incl. archaic) — no bare-book leak', () => {
    // Sweep the whole block in the PREFIX position: 1/2/3 → valid numbered book,
    // everything else → fabricated numbered book — NONE leaks a spurious bare "John 1:1".
    for (let cp = 0x2160; cp <= 0x2188; cp += 1) {
      const refs = extractScriptureRefs(`${String.fromCodePoint(cp)} John 1:1`);
      expect(refs.includes('John 1:1'), `U+${cp.toString(16)} prefix must not leak bare John`).toBe(false);
      expect(refs.length, `U+${cp.toString(16)} must bind a numbered ref`).toBeGreaterThan(0);
    }
    // Archaic apostrophus forms that do NOT NFKC-fold are handled explicitly.
    expect(validateScriptureRefs(extractScriptureRefs('ↁ John 1:1'))[0].status).toBe('invalid_book'); // 5000 John
    expect(validateScriptureRefs(extractScriptureRefs('John ↁ:1'))[0].status).toBe('out_of_range');    // chapter 5000
    expect(validateScriptureRefs(extractScriptureRefs('John ↅ:1'))[0].status).toBe('valid');           // ↅ = 6 → John 6:1
    // Supported forms still valid.
    expect(extractScriptureRefs('Ⅱ John 1:1')).toEqual(['2 John 1:1']);
  });

  it('binds a compact numbered book with the chapter GLUED to the stem (never rebinds to bare John)', () => {
    // Legit compact numbered-book citations (chapter digit glued to the stem) bind correctly.
    expect(validateScriptureRefs(extractScriptureRefs('2John1:1'))[0].status).toBe('valid'); // 2 John 1:1
    expect(validateScriptureRefs(extractScriptureRefs('2-John1:1'))[0].status).toBe('valid');
    expect(validateScriptureRefs(extractScriptureRefs('SecondJohn1:1'))[0].status).toBe('valid');
    expect(validateScriptureRefs(extractScriptureRefs('1Cor13:4'))[0].status).toBe('valid'); // 1 Corinthians 13:4
    // Fabricated / unsupported glued forms are invalid_book — NOT rebound to a bare valid John.
    for (const form of ['4John1:1', '4-John1:1', 'Ⅳ-John1:1', 'ↀJohn1:1']) {
      const refs = extractScriptureRefs(form);
      expect(refs.includes('John 1:1'), `${form} must not rebind to bare John`).toBe(false);
      expect(validateScriptureRefs(refs).some((r) => r.status === 'invalid_book'), form).toBe(true);
    }
    // Deep + joined-array.
    expect(validateScriptureRefs(extractScriptureRefsDeep({ note: '2John1:1' }))[0].status).toBe('valid');
    expect(extractScriptureRefsJoined(['4John', '1:1']).some((r) => /^4 John/.test(r))).toBe(true);
    // The r30 SPACED-separator OUTLINE behavior is intact (not re-broken).
    expect(extractScriptureRefs('2 - John 3:16')).toEqual(['John 3:16']);
    expect(validateScriptureRefs(extractScriptureRefs('2John 1:1'))[0].status).toBe('valid'); // single-space still 2 John
  });

  it('routes a lowercase NON-canonical all-Roman token to the strict validator (not dropped as prose)', () => {
    // Lowercased malformed Roman numerals must reach the validator (malformed / out_of_range),
    // NOT be silently dropped as prose.
    for (const form of ['John iiii:2', 'John vv:2', 'John iiv:2', 'John 3:iiii']) {
      const v = validateScriptureRefs(extractScriptureRefs(form));
      expect(v.length, form).toBeGreaterThan(0);
      expect(v.every((r) => r.status !== 'valid' && r.status !== 'chapter_checked'), form).toBe(true);
    }
    // A clean canonical lowercase Roman still validates.
    expect(validateScriptureRefs(extractScriptureRefs('John iv:2'))[0].status).toBe('valid'); // John 4:2
    // A lowercase word with a NON-Roman letter stays prose (clean, dropped).
    expect(extractScriptureRefs('John 2:live your faith')).toEqual([]);
    expect(extractScriptureRefs('John 3:ivy grows tall')).toEqual([]);
  });

  it('binds NUMERIC ORDINAL-SUFFIX prefixes (1st/2nd/3rd/4th/11th) to the numbered book', () => {
    // Supported ordinals bind to the correct numbered book.
    expect(validateScriptureRefs(extractScriptureRefs('1st John 1:1'))[0].ref).toBe('1 John 1:1');
    expect(validateScriptureRefs(extractScriptureRefs('1st John 1:1'))[0].status).toBe('valid');
    expect(validateScriptureRefs(extractScriptureRefs('2nd John 1:1'))[0].ref).toBe('2 John 1:1');
    expect(validateScriptureRefs(extractScriptureRefs('3rd John 1:1'))[0].ref).toBe('3 John 1:1');
    expect(validateScriptureRefs(extractScriptureRefs('1ST John 1:1'))[0].status).toBe('valid'); // suffix case-insensitive
    // Unsupported ordinals bind as INVALID — never a bare valid Gospel John.
    for (const form of ['4th John 1:1', '5th John 1:1', '11th John 1:1', '4thJohn1:1', '4th-John1:1']) {
      const refs = extractScriptureRefs(form);
      expect(refs.includes('John 1:1'), `${form} must not rebind to bare John`).toBe(false);
      expect(validateScriptureRefs(refs).some((r) => r.status === 'invalid_book'), form).toBe(true);
    }
    // Glued / hyphen / dot supported forms bind to the numbered book (valid).
    expect(validateScriptureRefs(extractScriptureRefs('2ndJohn1:1'))[0].ref).toBe('2 John 1:1');
    expect(validateScriptureRefs(extractScriptureRefs('2nd.John1:1'))[0].ref).toBe('2 John 1:1');
    // Deep + joined-array.
    expect(validateScriptureRefs(extractScriptureRefsDeep({ note: '1st John 1:1' }))[0].ref).toBe('1 John 1:1');
    expect(extractScriptureRefsJoined(['4th John', '1:1']).some((r) => /^4 John/.test(r))).toBe(true);
    // A bare ordinal not bound to a book name stays clean prose (no citation).
    expect(extractScriptureRefs('the 1st chapter of this book')).toEqual([]);
    expect(extractScriptureRefs('read the 2nd verse today')).toEqual([]);
    // r30 outline + r31 glued behaviors intact.
    expect(extractScriptureRefs('2 - John 3:16')).toEqual(['John 3:16']);
    expect(validateScriptureRefs(extractScriptureRefs('2John1:1'))[0].status).toBe('valid');
  });

  it('binds SUPERSCRIPT / NFKC ordinal-suffix prefixes with NO bare-John leak (folded in pass 1)', () => {
    const sup = { s: 'ˢ', t: 'ᵗ', n: 'ⁿ', d: 'ᵈ', r: 'ʳ', h: 'ʰ' };
    const forms = {
      '1st': `1${sup.s}${sup.t}`, '2nd': `2${sup.n}${sup.d}`,
      '3rd': `3${sup.r}${sup.d}`, '4th': `4${sup.t}${sup.h}`,
    };
    // Supported superscript ordinals → the numbered book; NO bare John in the output.
    expect(extractScriptureRefs(`${forms['1st']} John 1:1`)).toEqual(['1 John 1:1']);
    expect(extractScriptureRefs(`${forms['2nd']} John 1:1`)).toEqual(['2 John 1:1']);
    expect(extractScriptureRefs(`${forms['3rd']} John 1:1`)).toEqual(['3 John 1:1']);
    // Unsupported superscript ordinal → invalid_book, NO bare John.
    const four = extractScriptureRefs(`${forms['4th']} John 1:1`);
    expect(four.includes('John 1:1')).toBe(false);
    expect(validateScriptureRefs(four).some((r) => r.status === 'invalid_book')).toBe(true);
    // Superscript DIGIT + suffix folds too ("²ⁿᵈ").
    expect(extractScriptureRefs('²ⁿᵈ John 1:1')).toEqual(['2 John 1:1']);
    // (B) span-suppression must NOT drop a genuinely un-prefixed bare citation that co-occurs.
    const mixed = extractScriptureRefs(`John 1:1 and ${forms['2nd']} John 1:1`);
    expect(mixed).toContain('John 1:1');
    expect(mixed).toContain('2 John 1:1');
  });

  it('binds an ordinal-suffix prefix across a SPACED punctuation separator (never bare John); bare-numeric outline preserved', () => {
    // Ordinal suffix is NEVER an outline marker → binds across spaced dot/hyphen.
    expect(extractScriptureRefs('1st. John 1:1')).toEqual(['1 John 1:1']);
    expect(extractScriptureRefs('2nd- John 1:1')).toEqual(['2 John 1:1']);
    expect(extractScriptureRefs('2nd - John 1:1')).toEqual(['2 John 1:1']);
    for (const form of ['4th. John 1:1', '4th- John 1:1', '4th . John 1:1']) {
      const refs = extractScriptureRefs(form);
      expect(refs.includes('John 1:1'), `${form} must not leak bare John`).toBe(false);
      expect(validateScriptureRefs(refs).some((r) => r.status === 'invalid_book'), form).toBe(true);
    }
    // r30 BARE-NUMERIC outline behavior intact: a spaced separator without an
    // ordinal suffix is still an outline marker → valid bare John.
    expect(extractScriptureRefs('2 - John 3:16')).toEqual(['John 3:16']);
    expect(extractScriptureRefs('2. John 3:16')).toEqual(['John 3:16']);
    // Ordinal prose not followed by a book stays clean.
    expect(extractScriptureRefs('the 1st chapter of this book')).toEqual([]);
    expect(extractScriptureRefs('won the 3rd race yesterday')).toEqual([]);
  });

  it('binds an ordinal prefix with HIDDEN/combining chars at the digit↔suffix seam (no bare-John leak)', () => {
    const cp = (x) => String.fromCodePoint(x);
    const ZWSP = cp(0x200B);
    const CGJ = cp(0x034F);   // combining grapheme joiner (default-ignorable)
    const ACUTE = cp(0x0301); // combining mark
    const Th = cp(0x1D57) + cp(0x02B0); // superscript ᵗʰ
    const SUP4 = cp(0x2074);            // superscript ⁴
    // A hidden/combining char inside the ordinal is deleted BEFORE the boundary
    // pass, so the ordinal binds as one token (never split into a bare John).
    expect(extractScriptureRefs(`2${ZWSP}nd John 1:1`)).toEqual(['2 John 1:1']);
    for (const form of [`4${ZWSP}th John 1:1`, `4${CGJ}th. John 1:1`, `4${ACUTE}th- John 1:1`, `${SUP4}${ZWSP}${Th} John 1:1`]) {
      const refs = extractScriptureRefs(form);
      expect(refs.includes('John 1:1'), `${JSON.stringify([...form])} must not leak bare John`).toBe(false);
      expect(validateScriptureRefs(refs).some((r) => r.status === 'invalid_book')).toBe(true);
    }
  });

  it('folds a SUPERSCRIPT ordinal only in ordinal-prefix position; a superscript FOOTNOTE marker is left alone', () => {
    const cp = (x) => String.fromCodePoint(x);
    const SUP1 = cp(0xB9), SUP2 = cp(0xB2);
    const Nd = cp(0x207F) + cp(0x1D48); // superscript ⁿᵈ
    const Th = cp(0x1D57) + cp(0x02B0); // superscript ᵗʰ
    // Ordinal-prefix superscript before a numbered stem → numbered book.
    expect(extractScriptureRefs(`2${Nd} John 1:1`)).toEqual(['2 John 1:1']);
    expect(extractScriptureRefs(`${SUP2}${Nd} John 1:1`)).toEqual(['2 John 1:1']);
    const four = extractScriptureRefs(`4${Th} John 1:1`);
    expect(four.includes('John 1:1')).toBe(false);
    expect(validateScriptureRefs(four).some((r) => r.status === 'invalid_book')).toBe(true);
    // A superscript FOOTNOTE marker adjacent to a citation must NOT mutate it:
    // "John 3:16¹" stays valid John 3:16 (NOT 3:161); "John²:1"/"Rev²:1" mint nothing.
    expect(validateScriptureRefs(extractScriptureRefs(`John 3:16${SUP1}`))[0].status).toBe('valid');
    expect(extractScriptureRefs(`John 3:16${SUP1}`)).toEqual(['John 3:16']);
    expect(extractScriptureRefs(`John${SUP2}:1`)).toEqual([]);
    expect(extractScriptureRefs(`Rev${SUP2}:1`)).toEqual([]);
    // (B) span-suppression still preserves a genuinely un-prefixed bare John that co-occurs.
    const mixed = extractScriptureRefs(`John 1:1 and 2${Nd} John 1:1`);
    expect(mixed).toContain('John 1:1');
    expect(mixed).toContain('2 John 1:1');
    // r30 bare-numeric outline intact.
    expect(extractScriptureRefs('2 - John 3:16')).toEqual(['John 3:16']);
  });

  it('does not false-positive on ordinary prose that is not a reference pattern', () => {
    expect(extractScriptureRefs('we met at 3:30 today')).toEqual([]);
    expect(extractScriptureRefs('the ratio was 2:1 in our favor')).toEqual([]);
    expect(extractScriptureRefs('the score 24:10 at halftime')).toEqual([]);
    expect(validateAiSermon({ theological_notes: 'the meeting at 10:45 went long' }).allValid).toBe(true);
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
    // The extractor canonicalizes: "Psalm" → "Psalms" (both are valid aliases).
    expect(refs).toEqual(['Ephesians 2:8', 'Isaiah 40:31', 'John 3:16', 'Psalms 23:1', 'Romans 8:28']);
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
