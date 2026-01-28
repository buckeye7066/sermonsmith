import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Get all enabled translations
    const translations = await base44.asServiceRole.entities.Translation.filter({ enabled: true }, 'id');

    // Developer backdoor - FULL ACCESS
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
    
    const isDeveloper = emailMatch || phoneMatch;
    const isPremium = isDeveloper || 
                      user.subscription_tier === 'premium' || 
                      user.premium_override === true ||
                      (user.premium_until && new Date(user.premium_until) > new Date());

    // Check availability of each translation
    const available = translations.map(t => {
      let isAvailable = true;
      let reason = null;

      // DEVELOPERS GET EVERYTHING
      if (isDeveloper) {
        return {
          id: t.id,
          name: t.name,
          language: t.language,
          year: t.year,
          description: t.description,
          is_premium: t.is_premium,
          available: true,
          unavailable_reason: null
        };
      }

      // Check if premium and user doesn't have access
      if (t.is_premium && !isPremium) {
        isAvailable = false;
        reason = 'premium_required';
      }

      // Check if required API key is configured
      if (t.requires_api_key) {
        const apiKey = Deno.env.get(t.requires_api_key);
        if (!apiKey) {
          isAvailable = false;
          reason = `missing_${t.requires_api_key}`;
        }
      }

      return {
        id: t.id,
        name: t.name,
        language: t.language,
        year: t.year,
        description: t.description,
        is_premium: t.is_premium,
        available: isAvailable,
        unavailable_reason: reason
      };
    });

    return Response.json({
      translations: available,
      user_is_premium: isPremium,
      is_developer: isDeveloper
    });

  } catch (error) {
    console.error('listAvailableTranslations error:', error);
    return Response.json({
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
});