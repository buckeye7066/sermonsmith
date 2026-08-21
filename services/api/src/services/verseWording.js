/**
 * Exact verse wording checks against a registered Bible provider payload.
 *
 * Canon/reference validation (packages/shared/scripture) only proves a
 * reference exists in a selected canon. This module separately compares a
 * quoted string to provider-sourced text so a valid reference with wrong
 * wording is reported as a mismatch — never silently accepted as verified.
 *
 * Canonical statuses (single result shape for API, persistence, UI, PDF):
 *   - exact_full_verse
 *   - verified_excerpt
 *   - reference_only          (ref present, no quote to check)
 *   - mismatch
 *   - provider_unavailable
 *   - unsupported_translation
 *
 * Backward-compatible aliases (read/normalize only; never write as primary):
 *   - exact_full_verse_match → exact_full_verse
 *   - match                  → exact_full_verse | verified_excerpt (legacy)
 *   - no_quote               → reference_only
 *
 * Meaningful excerpt threshold (document + enforce):
 *   A quote may become verified_excerpt only when the normalized quote is a
 *   substring of the provider text AND it has either:
 *     - ≥ MIN_VERIFIED_EXCERPT_WORDS (8) significant words, OR
 *     - ≥ MIN_VERIFIED_EXCERPT_CHARS (40) normalized characters,
 *   AND coverage ≥ MIN_EXCERPT_COVERAGE of the provider verse text.
 *   Tiny common phrases ("God so loved", "the Lord") MUST NOT verify.
 */

/** Minimum significant-word count for an excerpt to count as verified wording. */
export const MIN_VERIFIED_EXCERPT_WORDS = 8;

/** Minimum normalized length for an excerpt to count as verified wording. */
export const MIN_VERIFIED_EXCERPT_CHARS = 40;

/**
 * Excerpt must cover at least this fraction of the provider verse to be
 * verified. Prevents short common-phrase false positives inside long verses.
 */
export const MIN_EXCERPT_COVERAGE = 0.35;

/** Stopwords ignored when counting "significant" words for the word threshold. */
const INSIGNIFICANT_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'by', 'for',
  'is', 'be', 'as', 'it', 'he', 'she', 'we', 'ye', 'thou', 'thy', 'his', 'her',
  'him', 'them', 'that', 'this', 'with', 'from', 'into', 'unto',
]);

export const VERSE_WORDING_STATUSES = Object.freeze([
  'exact_full_verse',
  'verified_excerpt',
  'reference_only',
  'mismatch',
  'provider_unavailable',
  'unsupported_translation',
]);

/** Statuses that may be shown as positively verified wording. */
export const VERIFIED_WORDING_STATUSES = Object.freeze([
  'exact_full_verse',
  'verified_excerpt',
]);

export function normalizeVerseText(text) {
  return String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u201C\u201D\u00AB\u00BB\u201E]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9'\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Count significant (non-stopword) tokens in already-normalized text. */
export function countSignificantWords(normalizedText) {
  const tokens = String(normalizedText || '').split(/\s+/).filter(Boolean);
  return tokens.filter((t) => !INSIGNIFICANT_WORDS.has(t)).length;
}

/**
 * Meaningful-excerpt gate: tiny normalized substrings must NOT become
 * verified_excerpt / exact_full_verse.
 */
export function meetsMeaningfulExcerptThreshold(quotedNormalized) {
  if (!quotedNormalized) return false;
  const words = countSignificantWords(quotedNormalized);
  return (
    words >= MIN_VERIFIED_EXCERPT_WORDS
    || quotedNormalized.length >= MIN_VERIFIED_EXCERPT_CHARS
  );
}

/**
 * Normalize legacy status strings onto the canonical vocabulary.
 * @param {string} status
 */
export function canonicalizeWordingStatus(status) {
  switch (status) {
    case 'exact_full_verse_match':
    case 'match':
      return 'exact_full_verse';
    case 'no_quote':
      return 'reference_only';
    default:
      return status;
  }
}

/**
 * @param {string} quotedText
 * @param {string} providerText
 * @returns {{
 *   status: 'exact_full_verse' | 'verified_excerpt' | 'mismatch' | 'reference_only' | 'provider_unavailable',
 *   quotedNormalized: string,
 *   providerNormalized: string,
 *   excerptChars: number,
 *   significantWords: number,
 *   coverage: number | null,
 * }}
 */
export function compareQuotedWording(quotedText, providerText) {
  const quotedNormalized = normalizeVerseText(quotedText);
  const providerNormalized = normalizeVerseText(providerText);
  const significantWords = countSignificantWords(quotedNormalized);

  if (!quotedNormalized) {
    return {
      status: 'reference_only',
      quotedNormalized,
      providerNormalized,
      excerptChars: 0,
      significantWords: 0,
      coverage: null,
    };
  }
  if (!providerNormalized) {
    return {
      status: 'provider_unavailable',
      quotedNormalized,
      providerNormalized,
      excerptChars: quotedNormalized.length,
      significantWords,
      coverage: null,
    };
  }

  if (quotedNormalized === providerNormalized) {
    // Full-verse equality is exact regardless of length (provider is the verse).
    return {
      status: 'exact_full_verse',
      quotedNormalized,
      providerNormalized,
      excerptChars: quotedNormalized.length,
      significantWords,
      coverage: 1,
    };
  }

  const coverage = quotedNormalized.length / providerNormalized.length;
  const isSubstring = providerNormalized.includes(quotedNormalized);
  const meaningful = meetsMeaningfulExcerptThreshold(quotedNormalized);
  const enoughCoverage = coverage >= MIN_EXCERPT_COVERAGE;

  if (isSubstring && meaningful && enoughCoverage) {
    return {
      status: 'verified_excerpt',
      quotedNormalized,
      providerNormalized,
      excerptChars: quotedNormalized.length,
      significantWords,
      coverage,
    };
  }

  // Substring that is too short / low coverage is NOT verified. Wrong wording
  // with a valid reference is always mismatch — never verified.
  return {
    status: 'mismatch',
    quotedNormalized,
    providerNormalized,
    excerptChars: quotedNormalized.length,
    significantWords,
    coverage: isSubstring ? coverage : null,
  };
}

function messageForStatus(status) {
  switch (canonicalizeWordingStatus(status)) {
    case 'exact_full_verse':
      return 'Quoted wording exactly matches the registered Bible provider text for this translation.';
    case 'verified_excerpt':
      return 'Quoted wording is a verified excerpt of the registered Bible provider text for this translation.';
    case 'reference_only':
      return 'Reference recorded without quoted wording; wording was not verified.';
    case 'mismatch':
      return 'Reference may be valid, but the quoted wording does not match the registered provider text (or the excerpt is too short to verify).';
    case 'provider_unavailable':
      return 'Provider text was unavailable; wording could not be verified.';
    case 'unsupported_translation':
      return 'Wording verification is not available for this translation on the registered public-domain providers.';
    default:
      return 'Wording verification state is unknown.';
  }
}

/**
 * @param {{
 *   reference: string,
 *   quotedText: string,
 *   translationId?: string,
 *   providerText: string,
 *   translation?: object,
 *   provider?: string,
 *   retrievedAt?: string,
 *   providerVersion?: string,
 *   unsupportedTranslation?: boolean,
 *   source?: string,
 * }} args
 */
export function buildVerseWordingResult({
  reference,
  quotedText,
  translationId = 'kjv',
  providerText,
  translation = null,
  provider = null,
  retrievedAt = null,
  providerVersion = null,
  unsupportedTranslation = false,
  source = null,
}) {
  if (unsupportedTranslation) {
    return {
      reference: String(reference || '').trim(),
      translationId,
      translation,
      provider: provider || null,
      providerText: providerText || '',
      quotedText: quotedText || '',
      status: 'unsupported_translation',
      verified: false,
      checks: {
        referenceShape: 'not_evaluated_here',
        providerWording: 'unsupported_translation',
      },
      excerptChars: normalizeVerseText(quotedText).length,
      significantWords: countSignificantWords(normalizeVerseText(quotedText)),
      coverage: null,
      retrievedAt: retrievedAt || null,
      providerVersion: providerVersion || null,
      source: source || null,
      message: messageForStatus('unsupported_translation'),
    };
  }

  const comparison = compareQuotedWording(quotedText, providerText);
  const status = canonicalizeWordingStatus(comparison.status);
  const verified = VERIFIED_WORDING_STATUSES.includes(status);

  return {
    reference: String(reference || '').trim(),
    translationId,
    translation,
    provider: provider || null,
    providerText: providerText || '',
    quotedText: quotedText || '',
    status,
    verified,
    checks: {
      referenceShape: 'not_evaluated_here',
      providerWording: status,
    },
    excerptChars: comparison.excerptChars,
    significantWords: comparison.significantWords,
    coverage: comparison.coverage,
    retrievedAt: retrievedAt || null,
    providerVersion: providerVersion || null,
    source: source || null,
    message: messageForStatus(status),
  };
}

/** Loose Scripture reference token for free-text quote pairing. */
const REF_NEAR_QUOTE =
  /\b((?:[1-3]\s?)?[A-Za-z][A-Za-z.]*(?:\s+[A-Za-z][A-Za-z.]*)?\s+\d+:\d+(?:\s*[-–—]\s*\d+)?)\b/;

/**
 * Pull `{reference, quotedText}` pairs from free-text fields that embed
 * quotations (curly or straight quotes), optionally preceded by a reference.
 */
export function extractQuotedPairsFromProse(text, source) {
  const out = [];
  const raw = String(text || '');
  if (!raw) return out;

  const quoteRe = /[“"]([^”"]{8,})[”"]/g;
  let match;
  while ((match = quoteRe.exec(raw)) !== null) {
    const quotedText = match[1].trim();
    const windowStart = Math.max(0, match.index - 100);
    const before = raw.slice(windowStart, match.index);
    // Allow brief attribution between the ref and the opening quote
    // ("John 3:16 says,", "Romans 5:8 —", "as John 3:16:").
    const refMatch = before.match(
      new RegExp(
        `${REF_NEAR_QUOTE.source}\\s*(?:says?|said|writes?|wrote|teaches?|taught|reads?|notes?)?\\s*[-–—:,]?\\s*$`,
        'i',
      ),
    );
    const reference = refMatch ? refMatch[1].replace(/\s+/g, ' ').trim() : '';
    if (reference) {
      out.push({ reference, quotedText, source });
    }
  }
  return out;
}

/**
 * Extract {reference, quotedText} pairs from a sermon-shaped record so wording
 * can be verified wherever Scripture quotations enter the builder/editor/PDF.
 *
 * Looks for:
 * - top-level anchor_passage + optional passage_text / scripture_text / quoted_text
 * - points[].supporting_scriptures / scriptures as strings or {reference, text/quote}
 * - points[].scripture / points[].quotation objects
 * - introduction / conclusion / theological_notes (structured or quoted prose)
 * - explicit quotations[] array if present
 */
export function extractSermonQuotations(record) {
  const out = [];
  if (!record || typeof record !== 'object') return out;

  const push = (reference, quotedText, source) => {
    const ref = String(reference || '').trim();
    if (!ref) return;
    out.push({
      reference: ref,
      quotedText: quotedText == null ? '' : String(quotedText),
      source,
    });
  };

  if (record.anchor_passage) {
    push(
      record.anchor_passage,
      record.passage_text
        || record.scripture_text
        || record.anchor_passage_text
        || record.quoted_text
        || '',
      'anchor_passage',
    );
  }

  if (Array.isArray(record.quotations)) {
    for (const [i, q] of record.quotations.entries()) {
      if (!q || typeof q !== 'object') continue;
      push(q.reference || q.ref, q.quotedText || q.text || q.quote || '', `quotations[${i}]`);
    }
  }

  const proseFields = ['introduction', 'conclusion', 'theological_notes'];
  for (const field of proseFields) {
    const value = record[field];
    if (typeof value === 'string') {
      for (const pair of extractQuotedPairsFromProse(value, field)) {
        push(pair.reference, pair.quotedText, pair.source);
      }
    } else if (value && typeof value === 'object') {
      push(
        value.reference || value.ref || value.passage,
        value.quotedText || value.text || value.quote || '',
        field,
      );
      if (typeof value.body === 'string') {
        for (const pair of extractQuotedPairsFromProse(value.body, `${field}.body`)) {
          push(pair.reference, pair.quotedText, pair.source);
        }
      }
    }
  }

  if (Array.isArray(record.points)) {
    for (const [pi, point] of record.points.entries()) {
      if (!point || typeof point !== 'object') continue;
      if (point.scripture || point.quotation) {
        const block = point.scripture || point.quotation;
        if (typeof block === 'string') {
          push(block, '', `points[${pi}].scripture`);
        } else if (block && typeof block === 'object') {
          push(
            block.reference || block.ref,
            block.quotedText || block.text || block.quote || '',
            `points[${pi}].scripture`,
          );
        }
      }
      // Supporting refs (product field name varies: supporting / supporting_scriptures / scriptures)
      const supports = point.supporting_scriptures
        || point.supporting
        || point.scriptures
        || [];
      if (Array.isArray(supports)) {
        for (const [si, entry] of supports.entries()) {
          if (typeof entry === 'string') {
            push(entry, '', `points[${pi}].supporting[${si}]`);
          } else if (entry && typeof entry === 'object') {
            push(
              entry.reference || entry.ref || entry.citation,
              entry.quotedText || entry.text || entry.quote || entry.wording || '',
              `points[${pi}].supporting[${si}]`,
            );
          }
        }
      }
      if (typeof point.content === 'string') {
        for (const pair of extractQuotedPairsFromProse(point.content, `points[${pi}].content`)) {
          push(pair.reference, pair.quotedText, pair.source);
        }
      }
    }
  }

  return out;
}
