/**
 * signupTrial.js — always-on, per-user free trial granted automatically to
 * every new signup.
 *
 * This mirrors GrantFlow's `signupTrialGrant` (shared/freeWeek.js, PR #727):
 * an ON-BY-DEFAULT trial, independent of any owner-controlled promotion. It
 * is deliberately separate from the dormant, env-gated global "Free Week"
 * promo (`FREE_WEEK_ENABLED` in `lib/freeWeek.js` / the
 * `grantFreePeriod({ scope: 'all' })` admin toggle) — that promo stays off by
 * default and this module never reads or flips it.
 *
 *   SIGNUP_TRIAL_ENABLED  Only an explicit falsy value ('false'/'off'/'0'/'no')
 *                         disables the trial. Default: enabled.
 *   SIGNUP_TRIAL_PERIOD   'week' (default, 7 days) | 'month' (30 days) | 'none'
 *
 * Pure + dependency-free: never reads process.env itself, so the same
 * function works in Node and in unit tests.
 */

const FALSY_VALUES = new Set(['false', 'off', '0', 'no']);

function isDisabled(value) {
  return FALSY_VALUES.has(String(value ?? '').trim().toLowerCase());
}

/**
 * Returns the trial period ('week' | 'month') a new signup should be granted,
 * or null if the trial is disabled (via env) or explicitly set to 'none'.
 */
export function signupTrialPeriod(env = {}) {
  if (isDisabled(env.SIGNUP_TRIAL_ENABLED)) return null;
  const raw = String(env.SIGNUP_TRIAL_PERIOD ?? 'week').trim().toLowerCase();
  if (['none', 'off', 'false', '0', 'no'].includes(raw)) return null;
  return raw === 'month' ? 'month' : 'week';
}
