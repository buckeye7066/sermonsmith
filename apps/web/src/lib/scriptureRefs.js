/**
 * Scripture reference validation — thin re-export.
 *
 * The canonical, canon-aware implementation lives in
 * `@sermonsmith/shared/scripture` so the web client and the API validate
 * references with the exact same code and can never drift. See that module
 * for the status vocabulary ('valid' | 'chapter_checked' |
 * 'unsupported_canon' | 'out_of_range' | 'invalid_book' | 'unparseable')
 * and the deuterocanon scope notes.
 */
export {
  CANONS,
  extractScriptureRefs,
  validateScriptureRefs,
  validateAiSermon,
} from '@sermonsmith/shared/scripture';
