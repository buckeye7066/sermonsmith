import { describe, expect, it } from 'vitest';
import {
  buildVerseWordingResult,
  canonicalizeWordingStatus,
  compareQuotedWording,
  countSignificantWords,
  extractQuotedPairsFromProse,
  extractSermonQuotations,
  meetsMeaningfulExcerptThreshold,
  MIN_VERIFIED_EXCERPT_CHARS,
  MIN_VERIFIED_EXCERPT_WORDS,
  normalizeVerseText,
} from '../services/verseWording.js';
import {
  attachQuotationVerification,
  buildQuotationVerification,
} from '../services/quotationVerification.js';

const JOHN_316 =
  'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.';

describe('verse wording verification', () => {
  it('normalizes punctuation, smart quotes, and case without inventing words', () => {
    expect(normalizeVerseText('  “For God so loved the world,”  ')).toBe(
      'for god so loved the world',
    );
    expect(normalizeVerseText('God\u2019s love')).toBe("god's love");
  });

  it('flags a valid reference shape when quoted wording is wrong', () => {
    const result = buildVerseWordingResult({
      reference: 'John 3:16',
      translationId: 'kjv',
      quotedText: 'God is love and nothing else matters.',
      providerText: JOHN_316,
    });

    expect(result.reference).toBe('John 3:16');
    expect(result.status).toBe('mismatch');
    expect(result.verified).toBe(false);
    expect(result.message).toMatch(/does not match the registered provider text/i);
  });

  it('accepts exact full-verse match as exact_full_verse', () => {
    const result = buildVerseWordingResult({
      reference: 'John 3:16',
      quotedText: JOHN_316,
      providerText: JOHN_316,
    });
    expect(result.status).toBe('exact_full_verse');
    expect(result.verified).toBe(true);
  });

  it('maps legacy status aliases onto the canonical vocabulary', () => {
    expect(canonicalizeWordingStatus('exact_full_verse_match')).toBe('exact_full_verse');
    expect(canonicalizeWordingStatus('no_quote')).toBe('reference_only');
    expect(canonicalizeWordingStatus('match')).toBe('exact_full_verse');
  });

  it('accepts a meaningful verified excerpt, not a tiny common phrase', () => {
    const longExcerpt =
      'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him';
    expect(meetsMeaningfulExcerptThreshold(normalizeVerseText(longExcerpt))).toBe(true);
    const excerpt = compareQuotedWording(longExcerpt, JOHN_316);
    expect(excerpt.status).toBe('verified_excerpt');

    const tiny = compareQuotedWording('God so loved', JOHN_316);
    expect(tiny.status).toBe('mismatch');
    expect(tiny.excerptChars).toBeLessThan(MIN_VERIFIED_EXCERPT_CHARS);
    expect(tiny.significantWords).toBeLessThan(MIN_VERIFIED_EXCERPT_WORDS);

    const common = compareQuotedWording('the Lord', 'Blessed be the Lord God of Israel');
    expect(common.status).toBe('mismatch');
  });

  it('rejects repeated common phrases even when they appear in the provider text', () => {
    const provider = 'Blessed be the Lord God of Israel from everlasting to everlasting Amen and Amen';
    expect(compareQuotedWording('Amen and Amen', provider).status).toBe('mismatch');
    expect(compareQuotedWording('the Lord God', provider).status).toBe('mismatch');
  });

  it('treats generated quotation marks as punctuation, not wording', () => {
    const quoted = `"${JOHN_316}"`;
    expect(compareQuotedWording(quoted, JOHN_316).status).toBe('exact_full_verse');
    const curly = `“${JOHN_316}”`;
    expect(compareQuotedWording(curly, JOHN_316).status).toBe('exact_full_verse');
  });

  it('handles punctuation differences and verse-range shaped references without inventing a match', () => {
    const punctuated = JOHN_316.replace(/,/g, ';').replace(/\./g, '!');
    expect(compareQuotedWording(punctuated, JOHN_316).status).toBe('exact_full_verse');

    const result = buildVerseWordingResult({
      reference: 'John 3:16-17',
      quotedText: 'Wrong words entirely for this range.',
      providerText: JOHN_316,
    });
    expect(result.status).toBe('mismatch');
  });

  it('reports provider_unavailable honestly without deleting the quote', () => {
    const result = buildVerseWordingResult({
      reference: 'John 3:16',
      quotedText: JOHN_316,
      providerText: '',
    });
    expect(result.status).toBe('provider_unavailable');
    expect(result.verified).toBe(false);
    expect(result.quotedText).toBe(JOHN_316);
  });

  it('reports unsupported_translation without blessing the quote', () => {
    const result = buildVerseWordingResult({
      reference: 'John 3:16',
      quotedText: JOHN_316,
      providerText: '',
      unsupportedTranslation: true,
      translationId: 'niv',
    });
    expect(result.status).toBe('unsupported_translation');
    expect(result.verified).toBe(false);
  });

  it('reference_only when no quote is supplied', () => {
    const result = buildVerseWordingResult({
      reference: 'John 3:16',
      quotedText: '',
      providerText: JOHN_316,
    });
    expect(result.status).toBe('reference_only');
    expect(result.verified).toBe(false);
  });

  it('rejects translation-mismatched wording even when the reference is valid', () => {
    const result = buildVerseWordingResult({
      reference: 'John 3:16',
      quotedText:
        'This is how much God loved the world: He gave his Son so that no one need be destroyed.',
      providerText: JOHN_316,
      translationId: 'kjv',
    });
    expect(result.status).toBe('mismatch');
  });

  it('counts significant words and enforces the 8-word / 40-char threshold', () => {
    expect(countSignificantWords('for god so loved the world that he gave')).toBeGreaterThanOrEqual(5);
    // Short but high-signal phrase under both thresholds → not meaningful.
    const shortNorm = normalizeVerseText('God so loved');
    expect(meetsMeaningfulExcerptThreshold(shortNorm)).toBe(false);
    // Long enough by characters alone.
    const longEnough = 'a'.repeat(MIN_VERIFIED_EXCERPT_CHARS);
    expect(meetsMeaningfulExcerptThreshold(longEnough)).toBe(true);
  });

  it('extracts quotations from sermon-shaped records including prose fields', () => {
    const qs = extractSermonQuotations({
      anchor_passage: 'John 3:16',
      passage_text: JOHN_316,
      introduction: 'As John 3:16 says, “For God so loved the world, that he gave his only begotten Son.”',
      conclusion: 'Therefore remember Romans 5:8 — “But God commendeth his love toward us.”',
      theological_notes: 'See also John 3:17.',
      points: [
        {
          scripture: { reference: 'John 1:1', text: 'In the beginning was the Word' },
          supporting_scriptures: [
            'Romans 5:8',
            { reference: 'John 3:17', text: 'For God sent not his Son into the world to condemn the world' },
          ],
        },
      ],
    });
    expect(qs.length).toBeGreaterThanOrEqual(5);
    expect(qs[0].source).toBe('anchor_passage');
    expect(qs.some((q) => q.source === 'introduction')).toBe(true);
    expect(qs.some((q) => q.source === 'conclusion')).toBe(true);
    expect(extractQuotedPairsFromProse(
      'John 3:16: “For God so loved the world, that he gave his only begotten Son.”',
      'test',
    )).toHaveLength(1);
  });

  it('partial excerpts below the threshold stay mismatch', () => {
    expect(compareQuotedWording('whosoever believeth', JOHN_316).status).toBe('mismatch');
    expect(compareQuotedWording('should not perish', JOHN_316).status).toBe('mismatch');
  });
});

describe('quotationVerification / wording_verification attach path', () => {
  it('verifies all sermon quotations and never blesses mismatches', async () => {
    const record = {
      anchor_passage: 'John 3:16',
      passage_text: 'God is love and nothing else matters.',
      translation: 'kjv',
    };
    const verification = await buildQuotationVerification(record, {
      translationId: 'kjv',
      getProviderPassage: async () => ({
        text: JOHN_316,
        reference: 'John 3:16',
        provider: 'test-provider',
        retrievedAt: '2026-08-10T00:00:00.000Z',
      }),
    });
    expect(verification.verified).toBe(false);
    expect(verification.overall).toBe('mismatch');
    expect(verification.quotations[0].status).toBe('mismatch');

    const attached = attachQuotationVerification(record, verification);
    expect(attached.passage_text).toBe(record.passage_text);
    expect(attached.wording_verification.quotations[0].provider).toBe('test-provider');
    expect(attached.quotation_verification).toEqual(attached.wording_verification);
  });

  it('marks provider failure as unverified without stripping quotes', async () => {
    const record = {
      anchor_passage: 'John 3:16',
      passage_text: JOHN_316,
    };
    const verification = await buildQuotationVerification(record, {
      getProviderPassage: async () => {
        throw new Error('upstream down');
      },
    });
    expect(verification.verified).toBe(false);
    expect(verification.quotations[0].status).toBe('provider_unavailable');
    expect(attachQuotationVerification(record, verification).passage_text).toBe(JOHN_316);
  });

  it('returns unsupported_translation for premium ids without blessing quotes', async () => {
    const record = {
      anchor_passage: 'John 3:16',
      passage_text: JOHN_316,
    };
    const verification = await buildQuotationVerification(record, {
      translationId: 'gb:niv',
      getProviderPassage: async () => ({ text: JOHN_316 }),
    });
    // Namespaced premium ids cannot be provider-verified on the public path.
    expect(verification.quotations[0].status).toBe('unsupported_translation');
    expect(verification.verified).toBe(false);
  });
});
