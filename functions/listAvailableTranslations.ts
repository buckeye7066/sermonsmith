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
        name: "King James Version (KJV)",
        language: "en",
        year: "1611",
        is_premium: false,
        available: true
      },
      {
        id: "en-web",
        name: "World English Bible (WEB)",
        language: "en",
        year: "2000",
        is_premium: false,
        available: true
      },
      {
        id: "en-niv",
        name: "New International Version (NIV)",
        language: "en",
        year: "1978",
        is_premium: true,
        available: isPremium
      },
      {
        id: "en-esv",
        name: "English Standard Version (ESV)",
        language: "en",
        year: "2001",
        is_premium: true,
        available: isPremium
      },
      {
        id: "en-nlt",
        name: "New Living Translation (NLT)",
        language: "en",
        year: "1996",
        is_premium: true,
        available: isPremium
      },
      {
        id: "en-nkjv",
        name: "New King James Version (NKJV)",
        language: "en",
        year: "1982",
        is_premium: true,
        available: isPremium
      },
      {
        id: "en-nasb",
        name: "New American Standard Bible (NASB)",
        language: "en",
        year: "1971",
        is_premium: true,
        available: isPremium
      },
      {
        id: "es-rvr",
        name: "Reina-Valera (RVR)",
        language: "es",
        year: "1960",
        is_premium: true,
        available: isPremium
      },
      {
        id: "fr-lsg",
        name: "Louis Segond (LSG)",
        language: "fr",
        year: "1910",
        is_premium: true,
        available: isPremium
      },
      {
        id: "de-lut",
        name: "Luther Bible (LUT)",
        language: "de",
        year: "1984",
        is_premium: true,
        available: isPremium
      },
      {
        id: "pt-arc",
        name: "Almeida Revista e Corrigida (ARC)",
        language: "pt",
        year: "1969",
        is_premium: true,
        available: isPremium
      },
      {
        id: "zh-cnv",
        name: "Chinese Union Version (CNV)",
        language: "zh",
        year: "1919",
        is_premium: true,
        available: isPremium
      },
      {
        id: "ru-rst",
        name: "Russian Synodal Translation (RST)",
        language: "ru",
        year: "1876",
        is_premium: true,
        available: isPremium
      },
      {
        id: "he-wlc",
        name: "Westminster Leningrad Codex (Hebrew OT)",
        language: "he",
        year: "1008",
        is_premium: true,
        available: isPremium
      },
      {
        id: "el-grk",
        name: "Greek New Testament (Textus Receptus)",
        language: "el",
        year: "1550",
        is_premium: true,
        available: isPremium
      },
      {
        id: "arc-peshitta",
        name: "Peshitta (Aramaic)",
        language: "arc",
        year: "200",
        is_premium: true,
        available: isPremium
      }
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