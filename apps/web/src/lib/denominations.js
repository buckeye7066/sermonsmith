/**
 * Denomination belief engine — thin re-export.
 *
 * The canonical engine lives in `@sermonsmith/shared/denominations` so the
 * web client and the API resolve traditions (and their canons) with the
 * exact same code. See that module for the belief profiles, alias
 * resolution, prompt-block builder, and canon mapping.
 */
export {
  DENOMINATION_PROFILES,
  DENOMINATION_GROUPS,
  DENOMINATION_OPTIONS,
  resolveDenominationProfile,
  canonForDenomination,
  denominationPromptBlock,
} from '@sermonsmith/shared/denominations';
