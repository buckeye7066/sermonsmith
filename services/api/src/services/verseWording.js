/**
 * Exact verse wording checks against a registered Bible provider payload.
 *
 * Canon/reference validation (packages/shared/scripture) only proves a
 * reference exists in a selected canon. This module separately compares a
 * quoted string to provider-sourced text so a valid reference with wrong
 * wording is reported as a mismatch — never silently accepted as verified.
 */

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

/**
 * @param {string} quotedText
 * @param {string} providerText
 * @returns {{ status: 'match' | 'mismatch' | 'no_quote' | 'provider_unavailable', quotedNormalized: string, providerNormalized: string }}
 */
export function compareQuotedWording(quotedText, providerText) {
  const quotedNormalized = normalizeVerseText(quotedText);
  const providerNormalized = normalizeVerseText(providerText);

  if (!quotedNormalized) {
    return { status: 'no_quote', quotedNormalized, providerNormalized };
  }
  if (!providerNormalized) {
    return { status: 'provider_unavailable', quotedNormalized, providerNormalized };
  }

  const match =
    quotedNormalized === providerNormalized
    // Allow acceptable partial excerpts (quoted text is a substring of provider text)
    || providerNormalized.includes(quotedNormalized);

  return {
    status: match ? 'match' : 'mismatch',
    quotedNormalized,
    providerNormalized,
  };
}

/**
 * @param {{ reference: string, quotedText: string, translationId?: string, providerText: string, translation?: object }} args
 */
export function buildVerseWordingResult({
  reference,
  quotedText,
  translationId = 'kjv',
  providerText,
  translation = null,
}) {
  const comparison = compareQuotedWording(quotedText, providerText);
  return {
    reference: String(reference || '').trim(),
    translationId,
    translation,
    providerText: providerText || '',
    quotedText: quotedText || '',
    status: comparison.status,
    // Honest product language: canon/reference checking is a different gate.
    checks: {
      referenceShape: 'not_evaluated_here',
      providerWording: comparison.status,
    },
    message:
      comparison.status === 'match'
        ? 'Quoted wording matches the registered Bible provider text for this translation.'
        : comparison.status === 'mismatch'
          ? 'Reference may be valid, but the quoted wording does not match the registered provider text.'
          : comparison.status === 'provider_unavailable'
            ? 'Provider text was unavailable; wording could not be verified.'
            : 'No quoted wording was supplied to verify.',
  };
}
