import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

const FREE_ENTITLEMENTS = new Set(['bible_reader', 'core_ai', 'personal_library']);

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
  const [, setExpiryTick] = useState(0);

  useEffect(() => {
    const expiresAt = Date.parse(user?.premium_until || '');
    if (!Number.isFinite(expiresAt)) return undefined;
    let timer;
    const scheduleExpiry = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) return;
      timer = setTimeout(() => {
        if (Date.now() >= expiresAt) {
          setExpiryTick((current) => current + 1);
        } else {
          scheduleExpiry();
        }
      }, Math.min(remaining + 25, 2_147_000_000));
    };
    scheduleExpiry();
    return () => clearTimeout(timer);
  }, [user?.premium_until]);

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
  // Only server-controlled promotional identity fields may participate in
  // the legacy allowlist. Registration email/profile.phone remain user data.
  const normalizedEmail = String(user.promotionalEmail || '').toLowerCase();
  const normalizedPhone = String(user.promotionalPhone || '').replace(/\D/g, '');
  const promotionalAccess = (promotionalEmails.includes(normalizedEmail)
    && normalizedEmail === String(user.email || '').toLowerCase())
    || promotionalPhones.includes(normalizedPhone);
  const devOverride = isAdmin || user.premium_override === true || promotionalAccess;

  const premiumUntilMs = Date.parse(user.premium_until || '');
  const hasTimedGrant = Number.isFinite(premiumUntilMs);
  const timedGrantActive = hasTimedGrant && premiumUntilMs > Date.now();

  let isPremium = false;
  if (isAdmin || devOverride) {
    isPremium = true;
  } else if (user.premium === true) {
    isPremium = true;
  } else if (hasTimedGrant) {
    // AuthContext may still contain the server's earlier premium tier and
    // entitlement array after a trial expires. The timestamp is authoritative
    // for a timed grant, so stale cached fields cannot extend it.
    isPremium = timedGrantActive;
  } else if (user.subscription_tier === 'premium') {
    isPremium = true;
  }

  const receivedEntitlements = Array.isArray(user.entitlements) ? user.entitlements : [];
  const entitlements = isPremium
    ? receivedEntitlements
    : receivedEntitlements.filter((entitlement) => FREE_ENTITLEMENTS.has(entitlement));
  const hasEntitlement = (entitlement) => entitlements.length > 0
    ? entitlements.includes(entitlement)
    : (isPremium || FREE_ENTITLEMENTS.has(entitlement));

  return {
    isPremium,
    devOverride,
    tier: isPremium ? 'premium' : 'free',
    entitlements,
    hasEntitlement,
    loading: false,
    error: null,
  };
}
