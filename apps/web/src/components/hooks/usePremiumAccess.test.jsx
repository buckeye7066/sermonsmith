// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let authState;
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => authState,
}));

import { usePremiumAccess } from './usePremiumAccess';

describe('usePremiumAccess', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00.000Z'));
    authState = { isLoadingAuth: false, authError: null, user: null };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('revokes cached premium entitlements when a timed grant expires in an open SPA', () => {
    authState.user = {
      id: 'trial-user',
      premium: false,
      subscription_tier: 'premium',
      premium_until: '2026-09-02T12:00:01.000Z',
      entitlements: ['bible_reader', 'core_ai', 'personal_library', 'community', 'exports'],
    };
    const { result } = renderHook(() => usePremiumAccess());

    expect(result.current.isPremium).toBe(true);
    expect(result.current.hasEntitlement('community')).toBe(true);

    act(() => vi.advanceTimersByTime(1_050));

    expect(result.current.isPremium).toBe(false);
    expect(result.current.tier).toBe('free');
    expect(result.current.hasEntitlement('community')).toBe(false);
    expect(result.current.hasEntitlement('bible_reader')).toBe(true);
  });

  it('keeps an administrator-controlled promotional principal entitled', () => {
    authState.user = {
      id: 'promotion-user',
      email: 'buckeye7066@gmail.com',
      promotionalEmail: 'buckeye7066@gmail.com',
      premium: false,
      subscription_tier: 'free',
      premium_until: '2026-09-01T12:00:00.000Z',
      entitlements: [],
    };
    const { result } = renderHook(() => usePremiumAccess());

    expect(result.current.devOverride).toBe(true);
    expect(result.current.isPremium).toBe(true);
    expect(result.current.hasEntitlement('community')).toBe(true);
    expect(result.current.hasPaidPremium).toBe(true);
  });

  it('keeps a signup-trial user able to buy: premium now, but not paid premium', () => {
    authState.user = {
      id: 'new-signup',
      premium: false,
      subscription_tier: 'premium',
      premium_until: '2026-09-09T12:00:00.000Z',
      entitlements: ['bible_reader', 'core_ai', 'personal_library', 'community'],
    };
    const { result } = renderHook(() => usePremiumAccess());

    expect(result.current.isPremium).toBe(true);
    expect(result.current.hasPaidPremium).toBe(false);
  });

  it('treats a Stripe-confirmed subscription as paid premium', () => {
    authState.user = { id: 'subscriber', premium: true, subscription_tier: 'premium', entitlements: [] };
    const { result } = renderHook(() => usePremiumAccess());

    expect(result.current.isPremium).toBe(true);
    expect(result.current.hasPaidPremium).toBe(true);
  });

  it('reports no paid premium while signed out or loading', () => {
    expect(renderHook(() => usePremiumAccess()).result.current.hasPaidPremium).toBe(false);
    authState = { isLoadingAuth: true, authError: null, user: null };
    expect(renderHook(() => usePremiumAccess()).result.current.hasPaidPremium).toBe(false);
  });
});
