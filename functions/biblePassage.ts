import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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
  "kjv": "engKJV",
  "KJV": "engKJV",
  "en-kjv": "engKJV",
  "asv": "engASV", 
  "ASV": "engASV",
  "en-asv": "engASV",
  "web": "ENGWEBP",
  "WEB": "ENGWEBP",
  "en-web": "ENGWEBP",
  "bsb": "BSB",
  "BSB": "BSB",
  "en-bsb": "BSB"
};

function getBookId(bookCode) {
  // If it's an OSIS code, convert it
  if (OSIS_TO_BOOK_ID[bookCode]) {
    return OSIS_TO_BOOK_ID[bookCode];
  }
  // If it's already a standard code, return as-is
  return bookCode;
}

function normalizeTranslationId(translationId) {
  if (!translationId) return "engKJV";
  
  // Check aliases first
  if (ENGLISH_TRANSLATION_ALIASES[translationId]) {
    return ENGLISH_TRANSLATION_ALIASES[translationId];
  }
  
  // Return as-is for direct translation IDs (like agd_wbt)
  return translationId;
}

Deno.serve(async (req) => {
  try {
    // Handle self-test mode FIRST (before auth to allow quick health checks)
    const reqUrl = new URL(req.url);
    if (reqUrl.searchParams.get('_selfTest') === '1') {
      return Response.json({ 
        ok: true, 
        selfTest: true, 
        function: 'biblePassage',
        message: 'biblePassage is operational',
        preview: 'Genesis 1:1 (self-test)'
      });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { translationId, bookCode, chapter, verses, _selfTest } = body;

    // Also support self-test via body
    if (_selfTest) {
      return Response.json({ ok: true, selfTest: true, message: 'biblePassage is operational' });
    }

    if (!bookCode || !chapter) {
      return Response.json({ 
        error: "Missing book or chapter.",
        verses: []
      }, { status: 400 });
    }

    const apiTranslation = normalizeTranslationId(translationId);
    const bookId = getBookId(bookCode);
    
    // Use bible.helloao.org API (free, 1000+ translations, no API key)
    const apiUrl = `https://bible.helloao.org/api/${apiTranslation}/${bookId}/${chapter}.json`;
    
    console.log(`Fetching: ${url}`);
    
    const response = await fetch(url);

    // Check if response is JSON (sometimes API returns HTML error pages)
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.log(`Non-JSON response for ${apiTranslation}, falling back to KJV`);
      // Fallback to KJV
      const fallbackUrl = `https://bible.helloao.org/api/engKJV/${bookId}/${chapter}.json`;
      const fallbackResponse = await fetch(fallbackUrl);

      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        const verseData = parseVerses(fallbackData);

        return Response.json({
          reference: `${fallbackData.book?.name || bookId} ${chapter}`,
          translationLabel: "KJV (fallback)",
          translationId: "engKJV",
          translationLanguage: "en",
          verses: verseData,
          fallbackUsed: true,
          originalTranslation: translationId
        });
      }

      return Response.json({ 
        error: `Translation ${apiTranslation} is not available. Please try a different translation.`,
        verses: []
      }, { status: 404 });
    }

    if (!response.ok) {
      // Try fallback to KJV if translation not found
      if (response.status === 404 && apiTranslation !== "engKJV") {
        console.log(`Translation ${apiTranslation} not found, falling back to KJV`);
        const fallbackUrl = `https://bible.helloao.org/api/engKJV/${bookId}/${chapter}.json`;
        const fallbackResponse = await fetch(fallbackUrl);
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          const verseData = parseVerses(fallbackData);
          
          return Response.json({
            reference: `${fallbackData.book?.name || bookId} ${chapter}`,
            translationLabel: "KJV (fallback)",
            translationId: "engKJV",
            translationLanguage: "en",
            verses: verseData,
            fallbackUsed: true,
            originalTranslation: translationId
          });
        }
      }
      
      if (response.status === 404) {
        return Response.json({ 
          error: `This passage is not available in ${apiTranslation}. Try a different translation.`,
          verses: []
        }, { status: 404 });
      }
      return Response.json({ 
        error: `Bible API error: ${response.status}`,
        verses: []
      }, { status: 500 });
    }

    const data = await response.json();
    const verseData = parseVerses(data);

    if (verseData.length === 0) {
      return Response.json({ 
        error: 'No verses found in this chapter.',
        verses: []
      }, { status: 404 });
    }

    // Filter to specific verses if requested
    let filteredVerses = verseData;
    if (verses) {
      const [start, end] = verses.includes('-') 
        ? verses.split('-').map(Number)
        : [Number(verses), Number(verses)];
      
      filteredVerses = verseData.filter(v => v.verse >= start && v.verse <= end);
    }

    return Response.json({
      reference: `${data.book?.name || bookId} ${chapter}${verses ? `:${verses}` : ''}`,
      translationLabel: data.translation?.name || apiTranslation,
      translationId: apiTranslation,
      translationLanguage: data.translation?.language || "en",
      verses: filteredVerses
    });

  } catch (err) {
    console.error("[biblePassage] Error:", err);
    return Response.json({
      error: err.message || "Bible API error",
      verses: []
    }, { status: 500 });
  }
});

// Parse verses from bible.helloao.org chapter format
function parseVerses(data) {
  if (!data || !data.chapter || !data.chapter.content) {
    return [];
  }

  const verseData = [];
  let currentVerse = null;
  let currentText = "";

  for (const item of data.chapter.content) {
    if (item.type === "verse") {
      // Save previous verse
      if (currentVerse !== null && currentText.trim()) {
        verseData.push({ 
          verse: currentVerse, 
          text: currentText.trim() 
        });
      }
      currentVerse = item.number;
      currentText = "";
    } else if (item.type === "text" && currentVerse !== null) {
      currentText += item.text;
    }
  }

  // Don't forget the last verse
  if (currentVerse !== null && currentText.trim()) {
    verseData.push({ 
      verse: currentVerse, 
      text: currentText.trim() 
    });
  }

  return verseData;
}