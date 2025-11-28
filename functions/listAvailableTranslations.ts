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

    // Only list translations that are actually available via bible-api.com
    // Other translations were listed but never worked - they just showed KJV text
    const translations = [
      {
        id: "en-kjv",
        name: "King James Version (KJV)",
        language: "English",
        year: "1611",
        is_premium: false,
        available: true,
        description: "The classic English translation"
      },
      {
        id: "en-web",
        name: "World English Bible (WEB)",
        language: "English",
        year: "2000",
        is_premium: false,
        available: true,
        description: "Modern English, public domain"
      }
      // Note: Other translations (NIV, ESV, Russian, etc.) were removed because
      // they were never actually working - the API doesn't support them.
      // When we add a proper multi-translation API, we can restore these.
    ];

    return Response.json({
      translations: translations,
      is_developer: user.premium_override === true
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});