import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Cache translations for 1 hour to avoid hitting the API too often
let cachedTranslations = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Map our internal IDs to helloao.org IDs
const internalToApiId = {
  "en-kjv": "KJV",
  "en-web": "WEB",
  "en-bsb": "BSB",
  "en-asv": "ASV",
  "ru-rusv": "RUSV",
  "es-rv": "RV1909",
  "de-lut": "DELUT",
  "fr-lsg": "LSG",
  "zh-cuv": "CUV",
  "pt-arc": "PTBR",
  "he-wlc": "WLC",
  "el-grk": "TR",
  "la-vul": "VULG"
};

// Curated list of popular/useful translations with our internal IDs
const curatedTranslations = [
  // Free English translations
  { internalId: "en-kjv", apiId: "KJV", name: "King James Version", language: "English", year: "1611", is_premium: false },
  { internalId: "en-web", apiId: "WEB", name: "World English Bible", language: "English", year: "2000", is_premium: false },
  { internalId: "en-bsb", apiId: "BSB", name: "Berean Standard Bible", language: "English", year: "2020", is_premium: false },
  { internalId: "en-asv", apiId: "ASV", name: "American Standard Version", language: "English", year: "1901", is_premium: false },
  
  // Premium translations (other languages)
  { internalId: "ru-rusv", apiId: "RUSV", name: "Russian Synodal Version", language: "Russian", year: "1876", is_premium: true },
  { internalId: "es-rv", apiId: "RV1909", name: "Reina-Valera 1909", language: "Spanish", year: "1909", is_premium: true },
  { internalId: "de-lut", apiId: "DELUT", name: "Luther Bible 1912", language: "German", year: "1912", is_premium: true },
  { internalId: "fr-lsg", apiId: "LSG", name: "Louis Segond 1910", language: "French", year: "1910", is_premium: true },
  { internalId: "zh-cuv", apiId: "CUV", name: "Chinese Union Version", language: "Chinese", year: "1919", is_premium: true },
  { internalId: "pt-arc", apiId: "PTBR", name: "Almeida Revista", language: "Portuguese", year: "1969", is_premium: true },
  { internalId: "he-wlc", apiId: "WLC", name: "Westminster Leningrad Codex", language: "Hebrew", year: "1008", is_premium: true },
  { internalId: "el-grk", apiId: "TR", name: "Textus Receptus", language: "Greek", year: "1550", is_premium: true },
  { internalId: "la-vul", apiId: "VULG", name: "Latin Vulgate", language: "Latin", year: "405", is_premium: true }
];

async function fetchAvailableTranslations() {
  // Check cache
  if (cachedTranslations && (Date.now() - cacheTime) < CACHE_DURATION) {
    return cachedTranslations;
  }
  
  try {
    const response = await fetch('https://bible.helloao.org/api/available_translations.json');
    if (!response.ok) {
      throw new Error('Failed to fetch translations');
    }
    
    const data = await response.json();
    cachedTranslations = data.translations || [];
    cacheTime = Date.now();
    return cachedTranslations;
  } catch (error) {
    console.error('Error fetching translations:', error);
    return null;
  }
}

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

    // Fetch available translations from helloao.org to verify what's actually available
    const apiTranslations = await fetchAvailableTranslations();
    
    // Build the translation list, marking unavailable ones
    const translations = curatedTranslations.map(t => {
      // Check if this translation exists in the API
      const apiTranslation = apiTranslations?.find(at => at.id === t.apiId || at.shortName === t.apiId);
      const isApiAvailable = !!apiTranslation;
      
      // Translation is available if:
      // 1. It exists in the API
      // 2. It's either free OR user has premium
      const isAvailable = isApiAvailable && (!t.is_premium || isPremium);
      
      let unavailable_reason = null;
      if (!isApiAvailable) {
        unavailable_reason = 'not_in_api';
      } else if (t.is_premium && !isPremium) {
        unavailable_reason = 'premium_required';
      }
      
      return {
        id: t.internalId,
        name: apiTranslation?.englishName || t.name,
        language: apiTranslation?.languageEnglishName || t.language,
        year: t.year,
        is_premium: t.is_premium,
        available: isAvailable,
        unavailable_reason,
        numberOfBooks: apiTranslation?.numberOfBooks || 66,
        description: apiTranslation?.name || t.name
      };
    });

    return Response.json({
      translations: translations,
      is_developer: user.premium_override === true,
      api_available: !!apiTranslations
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});