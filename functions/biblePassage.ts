import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * UNIFIED RESPONSE ENVELOPE:
 * All responses follow: { ok: boolean, error: string|null, data: any }
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

// Common English translation aliases
const ENGLISH_TRANSLATION_ALIASES = {
  "kjv": "engKJV", "KJV": "engKJV", "en-kjv": "engKJV",
  "asv": "engASV", "ASV": "engASV", "en-asv": "engASV",
  "web": "ENGWEBP", "WEB": "ENGWEBP", "en-web": "ENGWEBP",
  "bsb": "BSB", "BSB": "BSB", "en-bsb": "BSB"
};

function getBookId(bookCode) {
  if (OSIS_TO_BOOK_ID[bookCode]) return OSIS_TO_BOOK_ID[bookCode];
  return bookCode;
}

function normalizeTranslationId(translationId) {
  if (!translationId) return "engKJV";
  if (ENGLISH_TRANSLATION_ALIASES[translationId]) return ENGLISH_TRANSLATION_ALIASES[translationId];
  return translationId;
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
  
  // bible.helloao.org - the translation ID in the URL must match exactly what's returned from available_translations
  // Some IDs are case-sensitive (engKJV vs ENGWEBP)
  const apiUrl = `https://bible.helloao.org/api/${apiTranslation}/${bookId}/${chapter}.json`;

  console.log(`[biblePassage] Fetching: ${apiUrl} (trans: ${translationId} -> ${apiTranslation})`);

  let result = await safeFetch(apiUrl);

  // If primary fails (404 or HTML error page), try KJV fallback
  if (!result.ok && apiTranslation !== "engKJV") {
    console.log(`[biblePassage] Primary failed (${result.error}), trying KJV fallback`);
    const fallbackUrl = `https://bible.helloao.org/api/engKJV/${bookId}/${chapter}.json`;
    result = await safeFetch(fallbackUrl);
    
    if (result.ok) {
      const verseData = parseVerses(result.data);
      return {
        ok: true,
        error: null,
        data: {
          reference: `${result.data.book?.name || bookId} ${chapter}`,
          translationLabel: "KJV (fallback)",
          translationId: "engKJV",
          translationLanguage: "en",
          verses: verseData,
          fallbackUsed: true,
          originalTranslation: translationId,
          fallbackReason: `${translationId} returned error: ${result.error}`
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