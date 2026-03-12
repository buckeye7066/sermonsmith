import { useState, useEffect } from 'react';
import { api } from '@/api/apiClient';

export function usePremiumAccess() {
  const [accessData, setAccessData] = useState({
    isPremium: false,
    devOverride: false,
    tier: 'free',
    loading: true,
    error: null
  });

  useEffect(() => {
    let mounted = true;

    async function fetchAccess() {
      try {
        const user = await api.auth.me();
        
        if (!user) {
          if (mounted) {
            setAccessData({
              isPremium: false,
              devOverride: false,
              tier: 'free',
              loading: false,
              error: null
            });
          }
          return;
        }

        // Admin and dev roles always get full access
        const isAdmin = user.role === 'admin' || user.role === 'dev';
        const devOverride = isAdmin || user.premium_override === true;

        let isPremium = false;

        if (isAdmin || devOverride) {
          isPremium = true;
        } else if (user.premium === true) {
          isPremium = true;
        } else if (user.subscription_tier === 'premium') {
          isPremium = true;
        } else if (user.premium_until) {
          const premiumUntil = new Date(user.premium_until);
          if (premiumUntil > new Date()) {
            isPremium = true;
          }
        }

        if (mounted) {
          setAccessData({
            isPremium,
            devOverride,
            tier: isPremium ? 'premium' : 'free',
            loading: false,
            error: null
          });
        }

      } catch (error) {
        console.error('Error checking premium access:', error);
        
        if (mounted) {
          setAccessData({
            isPremium: false,
            devOverride: false,
            tier: 'free',
            loading: false,
            error: error.message
          });
        }
      }
    }

    fetchAccess();

    return () => {
      mounted = false;
    };
  }, []);

  return accessData;
}