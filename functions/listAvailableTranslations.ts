import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check premium status
    const isPremium = user.premium_override === true || 
                      user.subscription_tier === 'premium' ||
                      (user.premium_until && new Date(user.premium_until) > new Date());

    const translations = [
      {
        id: "en-kjv",
        label: "King James Version (KJV)",
        premium: false,
        default: true
      },
      {
        id: "en-web",
        label: "World English Bible (WEB)",
        premium: false
      }
    ];

    // Filter out premium translations if user is not premium
    const availableTranslations = isPremium 
      ? translations 
      : translations.filter(t => !t.premium);

    return Response.json({
      translations: availableTranslations,
      isPremium
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});