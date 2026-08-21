/**
 * Attach provider-backed wording verification to sermon-shaped records.
 *
 * `scripture_validation` (canon/reference) and `wording_verification`
 * (provider wording) are deliberately separate. A valid reference with wrong
 * wording must never receive a verified wording state.
 *
 * Persistence field: `wording_verification` (canonical).
 * Alias: `quotation_verification` is also written for older readers.
 */

import {
  buildVerseWordingResult,
  extractSermonQuotations,
  VERIFIED_WORDING_STATUSES,
} from './verseWording.js';
import { isPremiumTranslationId } from './premiumTranslations.js';

/**
 * @param {object} record
 * @param {{
 *   translationId?: string,
 *   getProviderPassage: (args: { reference: string, translationId: string }) => Promise<{
 *     text?: string,
 *     reference?: string,
 *     provider?: string,
 *     providerVersion?: string,
 *     retrievedAt?: string,
 *     unsupported?: boolean,
 *     unavailable?: boolean,
 *   }>,
 *   translationMetadata?: (id: string) => object | null,
 *   now?: () => string,
 * }} opts
 */
export async function buildQuotationVerification(record, opts) {
  const {
    translationId = 'kjv',
    getProviderPassage,
    translationMetadata = () => null,
    now = () => new Date().toISOString(),
  } = opts;

  const quotations = extractSermonQuotations(record);
  const results = [];

  if (isPremiumTranslationId(translationId)) {
    for (const q of quotations) {
      results.push(
        buildVerseWordingResult({
          reference: q.reference,
          quotedText: q.quotedText,
          translationId,
          providerText: '',
          translation: translationMetadata(translationId),
          unsupportedTranslation: true,
          retrievedAt: now(),
          source: q.source,
        }),
      );
    }
    return summarize(results, translationId, now());
  }

  for (const q of quotations) {
    let passage;
    try {
      passage = await getProviderPassage({
        reference: q.reference,
        translationId,
      });
    } catch {
      results.push(
        buildVerseWordingResult({
          reference: q.reference,
          quotedText: q.quotedText,
          translationId,
          providerText: '',
          translation: translationMetadata(translationId),
          provider: null,
          retrievedAt: now(),
          source: q.source,
        }),
      );
      continue;
    }

    if (!passage || passage.unsupported) {
      results.push(
        buildVerseWordingResult({
          reference: q.reference,
          quotedText: q.quotedText,
          translationId,
          providerText: '',
          translation: translationMetadata(translationId),
          unsupportedTranslation: true,
          retrievedAt: now(),
          source: q.source,
        }),
      );
      continue;
    }

    if (passage.unavailable || !passage.text) {
      results.push(
        buildVerseWordingResult({
          reference: q.reference,
          quotedText: q.quotedText,
          translationId,
          providerText: '',
          translation: translationMetadata(translationId),
          provider: passage.provider || null,
          retrievedAt: passage.retrievedAt || now(),
          providerVersion: passage.providerVersion || null,
          source: q.source,
        }),
      );
      continue;
    }

    results.push(
      buildVerseWordingResult({
        reference: passage.reference || q.reference,
        quotedText: q.quotedText,
        translationId,
        providerText: passage.text,
        translation: translationMetadata(translationId),
        provider: passage.provider || null,
        retrievedAt: passage.retrievedAt || now(),
        providerVersion: passage.providerVersion || null,
        source: q.source,
      }),
    );
  }

  return summarize(results, translationId, now());
}

/** @deprecated Use buildWordingVerification — alias kept for call-site clarity. */
export const buildWordingVerification = buildQuotationVerification;

function summarize(results, translationId, verifiedAt) {
  const anyVerified = results.some((r) => VERIFIED_WORDING_STATUSES.includes(r.status));
  const anyMismatch = results.some((r) => r.status === 'mismatch');
  const anyUnavailable = results.some((r) =>
    r.status === 'provider_unavailable' || r.status === 'unsupported_translation');
  const allReferenceOnly = results.length > 0
    && results.every((r) => r.status === 'reference_only');

  let overall = 'reference_only';
  if (results.length === 0) overall = 'reference_only';
  else if (anyMismatch) overall = 'mismatch';
  else if (anyUnavailable) overall = anyVerified ? 'partial_provider' : 'provider_unavailable';
  else if (anyVerified) {
    overall = results.every((r) => r.status === 'exact_full_verse')
      ? 'exact_full_verse'
      : 'verified_excerpt';
  } else if (allReferenceOnly) {
    overall = 'reference_only';
  }

  return {
    translationId,
    verifiedAt,
    overall,
    // Never claim verified when any quote mismatched or provider failed.
    verified: anyVerified && !anyMismatch && !anyUnavailable,
    quotations: results,
  };
}

/**
 * Merge wording_verification onto a record for persistence. Does not strip
 * quotes on provider failure — fails honestly as unverified.
 *
 * Also mirrors to `quotation_verification` for older readers.
 */
export function attachQuotationVerification(record, verification) {
  if (!record || typeof record !== 'object') return record;
  return {
    ...record,
    wording_verification: verification,
    quotation_verification: verification,
  };
}

export const attachWordingVerification = attachQuotationVerification;
