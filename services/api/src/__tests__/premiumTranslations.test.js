import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseVerseNumberedText,
  sliceVerses,
  isPremiumTranslationId,
  premiumProvider,
  listPremiumTranslations,
  fetchPremiumChapter,
  bookByName,
  _resetPremiumCatalogCache,
} from '../services/premiumTranslations.js';

function jsonResponse(payload, ok = true, status = 200) {
  return { ok, status, json: async () => payload };
}

// Route a mocked fetch by URL substring.
function mockFetch(routes) {
  return vi.fn(async (url) => {
    for (const { match, payload, ok, status } of routes) {
      if (String(url).includes(match)) return jsonResponse(payload, ok ?? true, status ?? 200);
    }
    return jsonResponse({}, false, 404);
  });
}

const GETBIBLE_TRANSLATIONS = {
  kjv: { translation: 'King James Version', abbreviation: 'kjv', lang: 'en', language: 'English', direction: 'LTR' },
  akjv: { translation: 'American King James Version', abbreviation: 'akjv', lang: 'en', language: 'English', direction: 'LTR' },
  arabicsv: { translation: 'Smith Van Dyke', abbreviation: 'arabicsv', lang: 'ar', language: 'Arabic', direction: 'RTL' },
};

describe('premiumTranslations — pure helpers', () => {
  it('parseVerseNumberedText splits inline [n] markers into verses', () => {
    const content = '[1] In the beginning God created the heavens and the earth. [2] And the earth was without form.';
    const verses = parseVerseNumberedText(content, 'Genesis', 1);
    expect(verses).toHaveLength(2);
    expect(verses[0]).toMatchObject({ book_name: 'Genesis', chapter: 1, verse: 1 });
    expect(verses[0].text).toMatch(/In the beginning/);
    expect(verses[1].verse).toBe(2);
    expect(verses[1].text).toBe('And the earth was without form.');
  });

  it('parseVerseNumberedText returns [] for empty content', () => {
    expect(parseVerseNumberedText('', 'John', 3)).toEqual([]);
  });

  it('sliceVerses returns a single verse, a range, and passes through when no spec', () => {
    const chapter = {
      reference: 'John 3',
      verses: [
        { book_name: 'John', chapter: 3, verse: 16, text: 'For God so loved' },
        { book_name: 'John', chapter: 3, verse: 17, text: 'For God sent not' },
        { book_name: 'John', chapter: 3, verse: 18, text: 'He that believeth' },
      ],
    };
    expect(sliceVerses(chapter, '16').verses).toHaveLength(1);
    expect(sliceVerses(chapter, '16').reference).toBe('John 3:16');
    expect(sliceVerses(chapter, '16-17').verses.map((v) => v.verse)).toEqual([16, 17]);
    expect(sliceVerses(chapter, '').verses).toHaveLength(3);
  });

  it('isPremiumTranslationId only matches namespaced ids', () => {
    expect(isPremiumTranslationId('gb:akjv')).toBe(true);
    expect(isPremiumTranslationId('ab:de4e12af7f28f599-02')).toBe(true);
    expect(isPremiumTranslationId('kjv')).toBe(false);
    expect(isPremiumTranslationId(undefined)).toBe(false);
  });

  it('bookByName resolves canonical names and aliases', () => {
    expect(bookByName('John')).toMatchObject({ number: 43, osis: 'JHN' });
    expect(bookByName('psalm')).toMatchObject({ number: 19, osis: 'PSA' });
    expect(bookByName('Revelations')).toMatchObject({ number: 66 });
    expect(bookByName('Nonsense')).toBeNull();
  });
});

describe('premiumTranslations — provider resolution', () => {
  const original = { key: process.env.API_BIBLE_KEY, off: process.env.DISABLE_PREMIUM_TRANSLATIONS };
  afterEach(() => {
    if (original.key === undefined) delete process.env.API_BIBLE_KEY; else process.env.API_BIBLE_KEY = original.key;
    if (original.off === undefined) delete process.env.DISABLE_PREMIUM_TRANSLATIONS; else process.env.DISABLE_PREMIUM_TRANSLATIONS = original.off;
  });

  it('defaults to getbible, uses api-bible with a key, null when disabled', () => {
    delete process.env.API_BIBLE_KEY;
    delete process.env.DISABLE_PREMIUM_TRANSLATIONS;
    expect(premiumProvider()).toBe('getbible');
    process.env.API_BIBLE_KEY = 'x';
    expect(premiumProvider()).toBe('api-bible');
    delete process.env.API_BIBLE_KEY;
    process.env.DISABLE_PREMIUM_TRANSLATIONS = '1';
    expect(premiumProvider()).toBeNull();
  });
});

describe('premiumTranslations — getBible provider (mocked fetch)', () => {
  beforeEach(() => {
    _resetPremiumCatalogCache();
    delete process.env.API_BIBLE_KEY;
    delete process.env.DISABLE_PREMIUM_TRANSLATIONS;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps the catalogue, namespaces ids, skips public-domain dupes, and caches', async () => {
    const fetchMock = mockFetch([{ match: '/translations.json', payload: GETBIBLE_TRANSLATIONS }]);
    vi.stubGlobal('fetch', fetchMock);

    const list = await listPremiumTranslations();
    const ids = list.map((t) => t.id);
    expect(ids).toContain('gb:akjv');
    expect(ids).toContain('gb:arabicsv');
    expect(ids).not.toContain('gb:kjv'); // free PD dupe filtered out

    const arabic = list.find((t) => t.id === 'gb:arabicsv');
    expect(arabic).toMatchObject({ language: 'Arabic', languageCode: 'ar', region: 'middle_east', textDirection: 'rtl', source: 'getbible' });

    // Second call is served from cache (no extra fetch).
    await listPremiumTranslations();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetchPremiumChapter returns Reader-shaped verses from getBible', async () => {
    const fetchMock = mockFetch([
      { match: '/akjv/43/3.json', payload: { verses: [{ verse: 16, text: 'For God so loved the world' }] } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const chapter = await fetchPremiumChapter({ id: 'gb:akjv', book: 'John', chapter: 3 });
    expect(chapter.reference).toBe('John 3');
    expect(chapter.verses[0]).toMatchObject({ book_name: 'John', chapter: 3, verse: 16, text: 'For God so loved the world' });
  });

  it('degrades to an empty premium list when the upstream catalogue fails', async () => {
    _resetPremiumCatalogCache();
    vi.stubGlobal('fetch', mockFetch([])); // every request 404s
    const list = await listPremiumTranslations();
    expect(list).toEqual([]);
  });
});
