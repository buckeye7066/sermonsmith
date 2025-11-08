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

        // Developer allowlist - emails and phone numbers
        const devEmails = [
          'buckeye7066@gmail.com',
          'anyawhite@rocketmail.com',
          'whiterobert1201@icloud.com',
          'tishka1201@icloud.com'
        ];
        
        const devPhones = ['9319981779', '+19319981779', '931-998-1779', '(931) 998-1779'];
        
        const emailMatch = user.email && devEmails.includes(user.email.toLowerCase());
        const phoneMatch = user.phone && devPhones.some(p => 
          user.phone.replace(/[\s\-\(\)]/g, '').includes(p.replace(/[\s\-\(\)\+]/g, ''))
        );
        
        const devOverride = emailMatch || phoneMatch || user.premium_override === true;

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