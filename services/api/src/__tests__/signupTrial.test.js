import { describe, it, expect } from 'vitest';
import { signupTrialPeriod } from '../lib/signupTrial.js';

describe('signupTrialPeriod (always-on per-signup trial)', () => {
  it('defaults to enabled with a 7-day ("week") period', () => {
    expect(signupTrialPeriod({})).toBe('week');
  });

  it('honors SIGNUP_TRIAL_PERIOD=month', () => {
    expect(signupTrialPeriod({ SIGNUP_TRIAL_PERIOD: 'month' })).toBe('month');
  });

  it('treats SIGNUP_TRIAL_PERIOD=none as disabled', () => {
    expect(signupTrialPeriod({ SIGNUP_TRIAL_PERIOD: 'none' })).toBe(null);
  });

  it('is disabled only by an explicit falsy SIGNUP_TRIAL_ENABLED', () => {
    for (const off of ['false', 'off', '0', 'no', 'FALSE', ' Off ']) {
      expect(signupTrialPeriod({ SIGNUP_TRIAL_ENABLED: off })).toBe(null);
    }
  });

  it('stays enabled for any non-falsy SIGNUP_TRIAL_ENABLED value', () => {
    expect(signupTrialPeriod({ SIGNUP_TRIAL_ENABLED: 'true' })).toBe('week');
    expect(signupTrialPeriod({ SIGNUP_TRIAL_ENABLED: '1' })).toBe('week');
  });

  it('falls back to week for an unrecognized period value', () => {
    expect(signupTrialPeriod({ SIGNUP_TRIAL_PERIOD: 'nonsense' })).toBe('week');
  });
});
