import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * UNIFIED RESPONSE ENVELOPE:
 * All responses follow: { ok: boolean, error: string|null, data: any }
 */

let cachedTranslations = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const languageRegions = {
  "eng": "europe", "deu": "europe", "fra": "europe", "spa": "europe", "por": "europe",
  "ita": "europe", "nld": "europe", "pol": "europe", "rus": "europe", "ukr": "europe",
  "heb": "middle_east", "ara": "middle_east", "fas": "middle_east", "tur": "middle_east",
  "zho": "asia", "cmn": "asia", "jpn": "asia", "kor": "asia", "vie": "asia", "tha": "asia",
  "hin": "asia", "ben": "asia", "tam": "asia", "ind": "asia", "tgl": "asia",
  "swa": "africa", "amh": "africa", "hau": "africa", "yor": "africa", "zul": "africa",
  "que": "americas", "aym": "americas", "grn": "americas",
  "mri": "oceania", "haw": "oceania", "smo": "oceania"
};

const regionNames = {
  "europe": "Europe",
  "middle_east": "Middle East & Biblical Languages",
  "asia": "Asia & Pacific",
  "africa": "Africa",
  "americas": "Americas",
  "oceania": "Oceania",
  "other": "Other Languages"
};

function getRegion(langCode) {
  const code = (langCode || "").toLowerCase().substring(0, 3);
  return languageRegions[code] || "other";
}

async function fetchTranslations() {
  if (cachedTranslations && (Date.now() - cacheTime) < CACHE_DURATION) {
    return { ok: true, data: cachedTranslations };
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch('https://bible.helloao.org/api/available_translations.json', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { ok: false, error: 'API returned non-JSON response' };
    }
    
    if (!response.ok) {
      return { ok: false, error: `API error: ${response.status}` };
    }
    
    const data = await response.json();
    cachedTranslations = data.translations || [];
    cacheTime = Date.now();
    return { ok: true, data: cachedTranslations };
  } catch (err) {
    return { ok: false, error: err.message || 'Failed to fetch translations' };
  }
}

async function safeRun(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user) {
    return { ok: false, error: 'Unauthorized', data: null };
  }

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body._selfTest) {
    return { ok: true, selfTest: true, message: 'listAvailableTranslations is operational', data: null };
  }

  const isPremium = user.premium_override === true || 
                    user.subscription_tier === 'premium' ||
                    (user.premium_until && new Date(user.premium_until) > new Date());

  const fetchResult = await fetchTranslations();
  
  if (!fetchResult.ok) {
    return { ok: false, error: fetchResult.error, data: { translations: [] } };
  }

  const apiTranslations = fetchResult.data;
  const freeTranslationIds = ['engKJV', 'ENGWEBP', 'BSB', 'engASV', 'engDARBY', 'engYLT', 'engAKJV', 'engRV', 'engDRA', 'engWEBBE'];

  const translations = apiTranslations
    .filter(t => t.numberOfBooks >= 27)
    .map(t => {
      const isFree = freeTranslationIds.includes(t.id) || freeTranslationIds.includes(t.shortName);
      const region = getRegion(t.language);
      
      return {
        id: t.id,
        shortName: t.shortName || t.id,
        name: t.englishName || t.name,
        nativeName: t.name,
        language: t.languageEnglishName || t.language,
        languageCode: t.language,
        region,
        regionName: regionNames[region],
        textDirection: t.textDirection || 'ltr',
        is_premium: !isFree,
        available: isFree || isPremium,
        unavailable_reason: (!isFree && !isPremium) ? 'premium_required' : null,
        numberOfBooks: t.numberOfBooks,
        isComplete: t.numberOfBooks >= 66
      };
    })
    .sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.language.localeCompare(b.language);
    });

  const byRegion = {};
  for (const t of translations) {
    if (!byRegion[t.region]) {
      byRegion[t.region] = { name: t.regionName, translations: [] };
    }
    byRegion[t.region].translations.push(t);
  }

  return {
    ok: true,
    error: null,
    data: {
      translations,
      byRegion,
      stats: {
        total: translations.length,
        available: translations.filter(t => t.available).length,
        languages: [...new Set(translations.map(t => t.languageCode))].length,
        complete: translations.filter(t => t.isComplete).length
      },
      is_premium: isPremium,
      is_developer: user.premium_override === true
    }
  };
}

Deno.serve(async (req) => {
  try {
    const result = await safeRun(req);
    return Response.json(result);
  } catch (err) {
    console.error("[listAvailableTranslations] CRITICAL ERROR:", err);
    return Response.json({
      ok: false,
      error: err?.message ?? "Unknown error",
      data: null
    });
  }
});