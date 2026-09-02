import { useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';

/**
 * Returns the current user's premium / dev-access state.
 *
 * IMPORTANT: this hook used to call `api.auth.me()` itself, which meant every
 * component that called `usePremiumAccess()` triggered an additional auth
 * round-trip. Layout AND WorldviewExplorer (and a few other pages) both call
 * this hook, which is how /api/auth/me ended up being fetched 4× per page
 * load. We now derive everything from the single AuthContext fetch so the
 * hook is free to call from anywhere.
 */
export function usePremiumAccess() {
  const { user, isLoadingAuth, authError } = useAuth();

  return useMemo(() => {
    if (isLoadingAuth) {
      return {
        isPremium: false,
        devOverride: false,
        tier: 'free',
        entitlements: [],
        hasEntitlement: () => false,
        loading: true,
        error: null,
      };
    }

    if (!user) {
      return {
        isPremium: false,
        devOverride: false,
        tier: 'free',
        entitlements: [],
        hasEntitlement: () => false,
        loading: false,
        error: authError?.message || null,
      };
    }

    const isAdmin = user.role === 'admin' || user.role === 'dev';
    const promotionalEmails = ['buckeye7066@gmail.com', 'anyawhite@rocketmail.com', 'whiterobert1201@icloud.com', 'tishka1201@icloud.com'];
    const promotionalPhones = ['9319981779', '19319981779'];
    const normalizedPhone = String(user.phone || '').replace(/\D/g, '');
    const promotionalAccess = promotionalEmails.includes(String(user.email || '').toLowerCase())
      || promotionalPhones.includes(normalizedPhone);
    const devOverride = isAdmin || user.premium_override === true || promotionalAccess;

    let isPremium = false;
    if (isAdmin || devOverride) {
      isPremium = true;
    } else if (user.premium === true) {
      isPremium = true;
    } else if (user.subscription_tier === 'premium') {
      isPremium = true;
    } else if (user.premium_until) {
      const premiumUntil = new Date(user.premium_until);
      if (!Number.isNaN(premiumUntil.getTime()) && premiumUntil > new Date()) {
        isPremium = true;
      }
    }

    const entitlements = Array.isArray(user.entitlements) ? user.entitlements : [];
    const hasEntitlement = (entitlement) => entitlements.length > 0
      ? entitlements.includes(entitlement)
      : isPremium;

    return {
      isPremium,
      devOverride,
      tier: isPremium ? 'premium' : (user.subscription_tier || 'free'),
      entitlements,
      hasEntitlement,
      loading: false,
      error: null,
    };
  }, [user, isLoadingAuth, authError]);
}
