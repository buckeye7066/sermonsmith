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
        id: "KJV",
        name: "King James Version",
        is_premium: false,
        available: true
      },
      {
        id: "WEB",
        name: "World English Bible",
        is_premium: false,
        available: true
      }
    ];

    return Response.json({
      translations: translations,
      isPremium,
      is_developer: user.premium_override === true
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});