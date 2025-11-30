import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * UNIFIED RESPONSE ENVELOPE:
 * All responses follow: { ok: boolean, error: string|null, data: any }
 * 
 * MULTI-API STRATEGY:
 * - KJV: Use bible-api.com (free, no auth, has actual KJV)
 * - Other translations: Use bible.helloao.org (1000+ translations)
 */

// OSIS to API book code mapping for bible.helloao.org
const OSIS_TO_BOOK_ID = {
  "Gen": "GEN", "Exod": "EXO", "Lev": "LEV", "Num": "NUM", "Deut": "DEU",
  "Josh": "JOS", "Judg": "JDG", "Ruth": "RUT", "1Sam": "1SA", "2Sam": "2SA",
  "1Kgs": "1KI", "2Kgs": "2KI", "1Chr": "1CH", "2Chr": "2CH", "Ezra": "EZR",
  "Neh": "NEH", "Esth": "EST", "Job": "JOB", "Ps": "PSA", "Prov": "PRO",
  "Eccl": "ECC", "Song": "SNG", "Isa": "ISA", "Jer": "JER", "Lam": "LAM",
  "Ezek": "EZK", "Dan": "DAN", "Hos": "HOS", "Joel": "JOL", "Amos": "AMO",
  "Obad": "OBA", "Jonah": "JON", "Mic": "MIC", "Nah": "NAM", "Hab": "HAB",
  "Zeph": "ZEP", "Hag": "HAG", "Zech": "ZEC", "Mal": "MAL",
  "Matt": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN", "Acts": "ACT",
  "Rom": "ROM", "1Cor": "1CO", "2Cor": "2CO", "Gal": "GAL", "Eph": "EPH",
  "Phil": "PHP", "Col": "COL", "1Thess": "1TH", "2Thess": "2TH", "1Tim": "1TI",
  "2Tim": "2TI", "Titus": "TIT", "Phlm": "PHM", "Heb": "HEB", "Jas": "JAS",
  "1Pet": "1PE", "2Pet": "2PE", "1John": "1JN", "2John": "2JN", "3John": "3JN",
  "Jude": "JUD", "Rev": "REV"
};

// OSIS to bible-api.com book codes (lowercase full names)
const OSIS_TO_BIBLE_API_BOOK = {
  "Gen": "genesis", "Exod": "exodus", "Lev": "leviticus", "Num": "numbers", "Deut": "deuteronomy",
  "Josh": "joshua", "Judg": "judges", "Ruth": "ruth", "1Sam": "1samuel", "2Sam": "2samuel",
  "1Kgs": "1kings", "2Kgs": "2kings", "1Chr": "1chronicles", "2Chr": "2chronicles", "Ezra": "ezra",
  "Neh": "nehemiah", "Esth": "esther", "Job": "job", "Ps": "psalms", "Prov": "proverbs",
  "Eccl": "ecclesiastes", "Song": "songofsolomon", "Isa": "isaiah", "Jer": "jeremiah", "Lam": "lamentations",
  "Ezek": "ezekiel", "Dan": "daniel", "Hos": "hosea", "Joel": "joel", "Amos": "amos",
  "Obad": "obadiah", "Jonah": "jonah", "Mic": "micah", "Nah": "nahum", "Hab": "habakkuk",
  "Zeph": "zephaniah", "Hag": "haggai", "Zech": "zechariah", "Mal": "malachi",
  "Matt": "matthew", "Mark": "mark", "Luke": "luke", "John": "john", "Acts": "acts",
  "Rom": "romans", "1Cor": "1corinthians", "2Cor": "2corinthians", "Gal": "galatians", "Eph": "ephesians",
  "Phil": "philippians", "Col": "colossians", "1Thess": "1thessalonians", "2Thess": "2thessalonians", "1Tim": "1timothy",
  "2Tim": "2timothy", "Titus": "titus", "Phlm": "philemon", "Heb": "hebrews", "Jas": "james",
  "1Pet": "1peter", "2Pet": "2peter", "1John": "1john", "2John": "2john", "3John": "3john",
  "Jude": "jude", "Rev": "revelation"
};

// Translations available on bible-api.com (use this API for these)
const BIBLE_API_COM_TRANSLATIONS = {
  "kjv": "kjv", "KJV": "kjv", "en-kjv": "kjv", "engKJV": "kjv",
  "asv": "asv", "ASV": "asv", "en-asv": "asv", "engASV": "asv",
  "web": "web", "WEB": "web", "en-web": "web",
  "bbe": "bbe", "BBE": "bbe",
  "darby": "darby", "DARBY": "darby",
  "ylt": "ylt", "YLT": "ylt"
};

// Default fallback translation 
const DEFAULT_TRANSLATION = "kjv";

function getBookId(bookCode) {
  if (OSIS_TO_BOOK_ID[bookCode]) return OSIS_TO_BOOK_ID[bookCode];
  return bookCode;
}

function normalizeTranslationId(translationId) {
  if (!translationId) return DEFAULT_TRANSLATION;
  // Check if it's a bible-api.com translation first
  if (BIBLE_API_COM_TRANSLATIONS[translationId]) return BIBLE_API_COM_TRANSLATIONS[translationId];
  // Pass through as-is for bible.helloao.org translations
  return translationId;
}

function isBibleApiComTranslation(translationId) {
  return !!BIBLE_API_COM_TRANSLATIONS[translationId];
}

// Fetch from bible-api.com (for KJV, ASV, WEB, etc.)
async function fetchFromBibleApiCom(translationId, bookCode, chapter) {
  const bookName = OSIS_TO_BIBLE_API_BOOK[bookCode];
  if (!bookName) {
    return { ok: false, error: `Unknown book: ${bookCode}`, data: null };
  }
  
  const url = `https://bible-api.com/data/${translationId}/${bookName.toUpperCase()}/${chapter}`;
  console.log(`[biblePassage] Fetching from bible-api.com: ${url}`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { ok: false, error: `API error: ${response.status}`, data: null };
    }
    
    const data = await response.json();
    
    if (!data.verses || data.verses.length === 0) {
      return { ok: false, error: 'No verses found', data: null };
    }
    
    // bible-api.com returns verses with { book, chapter, verse, text }
    const verses = data.verses.map(v => ({
      verse: v.verse,
      text: v.text
    }));
    
    return {
      ok: true,
      error: null,
      data: {
        reference: `${data.book} ${chapter}`,
        translationLabel: translationId.toUpperCase(),
        translationId: translationId,
        translationLanguage: "en",
        verses: verses
      }
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Request timeout', data: null };
    }
    return { ok: false, error: err.message || 'Fetch failed', data: null };
  }
}

// Parse verses from bible.helloao.org chapter format
function parseVerses(data) {
  if (!data || !data.chapter || !data.chapter.content) return [];

  const verseData = [];
  let currentVerse = null;
  let currentText = "";

  for (const item of data.chapter.content) {
    if (item.type === "verse") {
      if (currentVerse !== null && currentText.trim()) {
        verseData.push({ verse: currentVerse, text: currentText.trim() });
      }
      currentVerse = item.number;
      currentText = "";
    } else if (item.type === "text" && currentVerse !== null) {
      currentText += item.text;
    }
  }

  if (currentVerse !== null && currentText.trim()) {
    verseData.push({ verse: currentVerse, text: currentText.trim() });
  }

  return verseData;
}

// Safe fetch with JSON validation
async function safeFetch(url, timeoutMs = 10000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    // First check HTTP status
    if (!response.ok) {
      // Try to get error details
      const text = await response.text().catch(() => '');
      if (response.status === 404) {
        return { ok: false, error: 'Chapter not found', data: null, status: 404 };
      }
      return { ok: false, error: `API error: ${response.status}`, data: null, status: response.status };
    }
    
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    
    // Check for HTML response (error page)
    if (text.trim().startsWith('<') || text.trim().startsWith('<!')) {
      console.log('[biblePassage] Received HTML instead of JSON');
      return { ok: false, error: 'Translation temporarily unavailable', data: null };
    }
    
    // Try to parse JSON
    try {
      const data = JSON.parse(text);
      return { ok: true, error: null, data };
    } catch (parseErr) {
      console.log('[biblePassage] JSON parse error:', parseErr.message);
      return { ok: false, error: 'Invalid response from Bible API', data: null };
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Request timeout', data: null };
    }
    console.log('[biblePassage] Fetch error:', err.message);
    return { ok: false, error: err.message || 'Fetch failed', data: null };
  }
}

// Main handler logic
async function safeRun(req) {
  // Handle self-test mode FIRST
  const reqUrl = new URL(req.url);
  if (reqUrl.searchParams.get('_selfTest') === '1') {
    return { 
      ok: true, 
      selfTest: true, 
      function: 'biblePassage',
      message: 'biblePassage is operational'
    };
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user) {
    return { ok: false, error: 'Unauthorized', data: null };
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return { ok: false, error: 'Invalid JSON body', data: null };
  }

  const { translationId, bookCode, chapter, verses, _selfTest } = body;

  // Also support self-test via body
  if (_selfTest) {
    return { ok: true, selfTest: true, message: 'biblePassage is operational', data: null };
  }

  if (!bookCode || !chapter) {
    return { ok: false, error: 'Missing book or chapter', data: { verses: [] } };
  }

  const apiTranslation = normalizeTranslationId(translationId);
  const bookId = getBookId(bookCode);
  
  // STRATEGY: Use bible-api.com for KJV/ASV/WEB, use bible.helloao.org for everything else
  if (isBibleApiComTranslation(translationId)) {
    console.log(`[biblePassage] Using bible-api.com for ${translationId}`);
    const result = await fetchFromBibleApiCom(apiTranslation, bookCode, chapter);
    
    if (result.ok) {
      // Filter to specific verses if requested
      if (verses && result.data.verses) {
        const [start, end] = verses.includes('-') 
          ? verses.split('-').map(Number)
          : [Number(verses), Number(verses)];
        result.data.verses = result.data.verses.filter(v => v.verse >= start && v.verse <= end);
        result.data.reference += `:${verses}`;
      }
      return result;
    }
    
    // If bible-api.com fails, don't fallback - report the actual error
    console.log(`[biblePassage] bible-api.com failed: ${result.error}`);
    return result;
  }
  
  // Use bible.helloao.org for other translations
  const apiUrl = `https://bible.helloao.org/api/${apiTranslation}/${bookId}/${chapter}.json`;
  console.log(`[biblePassage] Using bible.helloao.org: ${apiUrl}`);

  let result = await safeFetch(apiUrl);

  // If primary fails (404 or HTML error page), try KJV fallback via bible-api.com
  if (!result.ok) {
    console.log(`[biblePassage] Primary failed (${result.error}), trying KJV fallback`);
    const fallbackResult = await fetchFromBibleApiCom("kjv", bookCode, chapter);
    
    if (fallbackResult.ok) {
      // Determine reason for fallback
      let fallbackReason = `${translationId} not available for this chapter`;
      if (bookId === "GEN" || bookId === "EXO" || bookId === "LEV" || bookId === "NUM" || bookId === "DEU") {
        fallbackReason = `${translationId} may be New Testament only`;
      }
      
      return {
        ok: true,
        error: null,
        data: {
          ...fallbackResult.data,
          translationLabel: "KJV (fallback)",
          translationId: "kjv",
          fallbackUsed: true,
          originalTranslation: translationId,
          fallbackReason
        }
      };
    }
  }

  // Still failing - could be the external API is down
  if (!result.ok) {
    console.log(`[biblePassage] All attempts failed: ${result.error}`);
    return { ok: false, error: result.error || 'Bible API temporarily unavailable', data: { verses: [] } };
  }

  const verseData = parseVerses(result.data);

  if (verseData.length === 0) {
    return { ok: false, error: 'No verses found in this chapter', data: { verses: [] } };
  }

  // Filter to specific verses if requested
  let filteredVerses = verseData;
  if (verses) {
    const [start, end] = verses.includes('-') 
      ? verses.split('-').map(Number)
      : [Number(verses), Number(verses)];
    filteredVerses = verseData.filter(v => v.verse >= start && v.verse <= end);
  }

  return {
    ok: true,
    error: null,
    data: {
      reference: `${result.data.book?.name || bookId} ${chapter}${verses ? `:${verses}` : ''}`,
      translationLabel: result.data.translation?.name || apiTranslation,
      translationId: apiTranslation,
      translationLanguage: result.data.translation?.language || "en",
      verses: filteredVerses
    }
  };
}

// Unified envelope handler
Deno.serve(async (req) => {
  try {
    const result = await safeRun(req);
    
    // For self-test, return as-is
    if (result.selfTest) {
      return Response.json(result);
    }
    
    // Standard envelope
    return Response.json(result);
  } catch (err) {
    console.error("[biblePassage] CRITICAL ERROR:", err);
    return Response.json({
      ok: false,
      error: err?.message ?? "Unknown error",
      data: null
    });
  }
});