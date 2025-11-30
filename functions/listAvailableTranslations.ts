import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Cache translations for 1 hour to avoid hitting the API too often
let cachedTranslations = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Language code to region/continent mapping
const languageRegions = {
  // Europe
  "eng": "europe", "deu": "europe", "fra": "europe", "spa": "europe", "por": "europe",
  "ita": "europe", "nld": "europe", "pol": "europe", "rus": "europe", "ukr": "europe",
  "ces": "europe", "slk": "europe", "hrv": "europe", "srp": "europe", "bul": "europe",
  "ron": "europe", "hun": "europe", "ell": "europe", "swe": "europe", "nor": "europe",
  "dan": "europe", "fin": "europe", "lat": "europe", "lit": "europe", "lav": "europe",
  "est": "europe", "slv": "europe", "mkd": "europe", "sqi": "europe", "bos": "europe",
  "bel": "europe", "cat": "europe", "glg": "europe", "eus": "europe", "cym": "europe",
  "gle": "europe", "gla": "europe", "isl": "europe", "mlt": "europe",
  
  // Middle East
  "heb": "middle_east", "ara": "middle_east", "fas": "middle_east", "tur": "middle_east",
  "kur": "middle_east", "aze": "middle_east", "arm": "middle_east", "kat": "middle_east",
  "syr": "middle_east", "arc": "middle_east", "cop": "middle_east", "prs": "middle_east",
  
  // Asia
  "zho": "asia", "cmn": "asia", "yue": "asia", "jpn": "asia", "kor": "asia",
  "vie": "asia", "tha": "asia", "mya": "asia", "khm": "asia", "lao": "asia",
  "hin": "asia", "ben": "asia", "tam": "asia", "tel": "asia", "mar": "asia",
  "guj": "asia", "kan": "asia", "mal": "asia", "pan": "asia", "urd": "asia",
  "nep": "asia", "sin": "asia", "mon": "asia", "tib": "asia", "kaz": "asia",
  "uzb": "asia", "tgk": "asia", "kir": "asia", "ind": "asia", "msa": "asia",
  "tgl": "asia", "ceb": "asia", "ilo": "asia", "jav": "asia", "sun": "asia",
  
  // Africa
  "swa": "africa", "amh": "africa", "orm": "africa", "hau": "africa", "yor": "africa",
  "ibo": "africa", "zul": "africa", "xho": "africa", "afr": "africa", "som": "africa",
  "tir": "africa", "kin": "africa", "run": "africa", "nya": "africa", "sna": "africa",
  "twi": "africa", "wol": "africa", "lin": "africa", "lug": "africa", "sot": "africa",
  "tsn": "africa", "ssw": "africa", "ven": "africa", "nbl": "africa", "tso": "africa",
  
  // Americas  
  "que": "americas", "aym": "americas", "grn": "americas", "nah": "americas",
  "myn": "americas", "cre": "americas", "oji": "americas", "nav": "americas",
  "chy": "americas", "chr": "americas",
  
  // Oceania
  "mri": "oceania", "haw": "oceania", "smo": "oceania", "ton": "oceania",
  "fij": "oceania", "tah": "oceania", "cha": "oceania", "pau": "oceania"
};

// Get region for a language code
function getRegion(langCode) {
  const code = (langCode || "").toLowerCase().substring(0, 3);
  return languageRegions[code] || "other";
}

// Region display names
const regionNames = {
  "europe": "Europe",
  "middle_east": "Middle East & Biblical Languages",
  "asia": "Asia & Pacific",
  "africa": "Africa",
  "americas": "Americas",
  "oceania": "Oceania",
  "other": "Other Languages"
};

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

    // Fetch all available translations from helloao.org
    const apiTranslations = await fetchAvailableTranslations();
    
    if (!apiTranslations) {
      return Response.json({ 
        error: 'Failed to fetch translations from API',
        translations: []
      }, { status: 500 });
    }

    // Free translations (English public domain) - use actual API IDs from bible.helloao.org
    const freeTranslationIds = ['engKJV', 'ENGWEBP', 'BSB', 'engASV', 'engDARBY', 'engYLT', 'engAKJV', 'engRV', 'engDRA', 'engWEBBE'];
    
    // Process all translations
    const translations = apiTranslations
      .filter(t => t.numberOfBooks >= 27) // At least New Testament
      .map(t => {
        const isFree = freeTranslationIds.includes(t.id) || freeTranslationIds.includes(t.shortName);
        const isComplete = t.numberOfBooks >= 66;
        const region = getRegion(t.language);
        
        return {
          id: t.id,
          shortName: t.shortName || t.id,
          name: t.englishName || t.name,
          nativeName: t.name,
          language: t.languageEnglishName || t.language,
          languageCode: t.language,
          region: region,
          regionName: regionNames[region],
          textDirection: t.textDirection || 'ltr',
          is_premium: !isFree,
          available: isFree || isPremium,
          unavailable_reason: (!isFree && !isPremium) ? 'premium_required' : null,
          numberOfBooks: t.numberOfBooks,
          isComplete: isComplete,
          website: t.website
        };
      })
      .sort((a, b) => {
        // Sort: available first, then by language name
        if (a.available !== b.available) return a.available ? -1 : 1;
        return a.language.localeCompare(b.language);
      });

    // Group by region for UI
    const byRegion = {};
    for (const t of translations) {
      if (!byRegion[t.region]) {
        byRegion[t.region] = {
          name: t.regionName,
          translations: []
        };
      }
      byRegion[t.region].translations.push(t);
    }

    // Stats
    const stats = {
      total: translations.length,
      available: translations.filter(t => t.available).length,
      languages: [...new Set(translations.map(t => t.languageCode))].length,
      complete: translations.filter(t => t.isComplete).length
    };

    return Response.json({
      translations,
      byRegion,
      stats,
      is_premium: isPremium,
      is_developer: user.premium_override === true
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});