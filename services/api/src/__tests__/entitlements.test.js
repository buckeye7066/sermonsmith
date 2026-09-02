import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_TIERS,
  ENTITLEMENTS,
  accessSummaryFor,
  accountTierFor,
  entitlementForAiFeature,
  entitlementForEntityType,
} from '../lib/entitlements.js';

describe('server account entitlements', () => {
  it('derives free access from authoritative account fields, ignoring profile tier claims', () => {
    const user = {
      role: 'user',
      premium: false,
      premium_until: null,
      email: 'member@example.com',
      profile: { subscription_tier: 'premium', premium_override: true },
    };

    expect(accountTierFor(user)).toBe(ACCOUNT_TIERS.FREE);
    expect(accessSummaryFor(user).entitlements).not.toContain(ENTITLEMENTS.COMMUNITY);
  });

  it('recognizes paid, active trial, admin, and owner-approved promotional access', () => {
    const future = new Date(Date.now() + 60_000);
    expect(accountTierFor({ premium: true, role: 'user' })).toBe(ACCOUNT_TIERS.PREMIUM);
    expect(accountTierFor({ premium: false, premium_until: future, role: 'user' })).toBe(ACCOUNT_TIERS.PREMIUM);
    expect(accountTierFor({ premium: false, role: 'admin' })).toBe(ACCOUNT_TIERS.PREMIUM);
    expect(accountTierFor({ premium: false, role: 'user', email: 'buckeye7066@gmail.com' })).toBe(ACCOUNT_TIERS.PREMIUM);
    expect(accountTierFor({ premium: false, role: 'user', promotionalPhone: '(931) 998-1779' })).toBe(ACCOUNT_TIERS.PREMIUM);
    expect(accountTierFor({ premium: false, role: 'user', profile: { phone: '(931) 998-1779' } })).toBe(ACCOUNT_TIERS.FREE);
  });

  it('expires date-bound promotional access automatically', () => {
    const expired = new Date(Date.now() - 60_000);
    expect(accountTierFor({ premium: false, premium_until: expired, role: 'user' })).toBe(ACCOUNT_TIERS.FREE);
  });

  it('maps premium AI and entity surfaces to explicit entitlements', () => {
    expect(entitlementForAiFeature('worldview')).toBe(ENTITLEMENTS.WORLDVIEW);
    expect(entitlementForAiFeature('sermon')).toBe(ENTITLEMENTS.CORE_AI);
    expect(entitlementForAiFeature('general')).toBe(ENTITLEMENTS.ADVANCED_STUDY);
    expect(entitlementForAiFeature('made_up')).toBeNull();
    expect(entitlementForEntityType('CommunityPost')).toBe(ENTITLEMENTS.COMMUNITY);
    expect(entitlementForEntityType('Sermon')).toBeNull();
  });
});
