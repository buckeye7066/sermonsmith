import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

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
        const user = await base44.auth.me();
        
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

        // Check for premium override (set by admins)
        const devOverride = user.premium_override === true;

        // Check premium status
        let isPremium = false;
        
        if (devOverride) {
          isPremium = true;
        } else if (user.subscription_tier === 'premium') {
          isPremium = true;
        } else if (user.premium_until) {
          const premiumUntil = new Date(user.premium_until);
          const now = new Date();
          if (premiumUntil > now) {
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