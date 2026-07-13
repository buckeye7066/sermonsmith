/**
 * User-input fencing — thin re-export.
 *
 * The canonical fencing helpers (and the shared prompt builders that use
 * them) live in `@sermonsmith/shared/prompts` so the web client and the
 * benchmark runner assemble byte-identical prompts.
 */
export {
  USER_INPUT_START,
  USER_INPUT_END,
  formatUserInputBlock,
} from '@sermonsmith/shared/prompts';
