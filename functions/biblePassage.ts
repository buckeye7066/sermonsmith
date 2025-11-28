import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Book name mapping for the wldeh/bible-api format (lowercase book names)
const BOOK_NAME_MAP = {
  "GEN": "genesis", "EXO": "exodus", "LEV": "leviticus", "NUM": "numbers", "DEU": "deuteronomy",
  "JOS": "joshua", "JDG": "judges", "RUT": "ruth", "1SA": "1-samuel", "2SA": "2-samuel",
  "1KI": "1-kings", "2KI": "2-kings", "1CH": "1-chronicles", "2CH": "2-chronicles", "EZR": "ezra",
  "NEH": "nehemiah", "EST": "esther", "JOB": "job", "PSA": "psalms", "PRO": "proverbs",
  "ECC": "ecclesiastes", "SNG": "song-of-solomon", "ISA": "isaiah", "JER": "jeremiah", "LAM": "lamentations",
  "EZK": "ezekiel", "DAN": "daniel", "HOS": "hosea", "JOL": "joel", "AMO": "amos",
  "OBA": "obadiah", "JON": "jonah", "MIC": "micah", "NAM": "nahum", "HAB": "habakkuk",
  "ZEP": "zephaniah", "HAG": "haggai", "ZEC": "zechariah", "MAL": "malachi",
  "MAT": "matthew", "MRK": "mark", "LUK": "luke", "JHN": "john", "ACT": "acts",
  "ROM": "romans", "1CO": "1-corinthians", "2CO": "2-corinthians", "GAL": "galatians", "EPH": "ephesians",
  "PHP": "philippians", "COL": "colossians", "1TH": "1-thessalonians", "2TH": "2-thessalonians", "1TI": "1-timothy",
  "2TI": "2-timothy", "TIT": "titus", "PHM": "philemon", "HEB": "hebrews", "JAS": "james",
  "1PE": "1-peter", "2PE": "2-peter", "1JN": "1-john", "2JN": "2-john", "3JN": "3-john",
  "JUD": "jude", "REV": "revelation"
};

// OSIS to standard book code mapping
const osisToBookCode = {
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

// Translation ID mapping - user-friendly to API format
const TRANSLATION_MAP = {
  "kjv": "en-kjv",
  "KJV": "en-kjv",
  "eng-kjv2006": "en-kjv",
  "asv": "en-asv",
  "ASV": "en-asv",
  "eng-asv": "en-asv",
  "web": "en-web",
  "WEB": "en-web",
  "ENGWEBP": "en-web",
  "bbe": "en-bbe",
  "BBE": "en-bbe",
  "bsb": "en-bsb",
  "BSB": "en-bsb"
};

function getApiTranslationId(translationId) {
  if (!translationId) return "en-kjv";
  return TRANSLATION_MAP[translationId] || TRANSLATION_MAP[translationId.toLowerCase()] || translationId;
}

function getBookName(bookCode) {
  // Convert OSIS to standard code if needed
  let code = bookCode;
  if (osisToBookCode[bookCode]) {
    code = osisToBookCode[bookCode];
  }
  return BOOK_NAME_MAP[code] || bookCode.toLowerCase();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { translationId, bookCode, chapter, verses } = await req.json();

    if (!bookCode || !chapter) {
      return Response.json({ 
        error: "Missing book or chapter.",
        verses: []
      }, { status: 400 });
    }

    const apiTranslation = getApiTranslationId(translationId);
    const bookName = getBookName(bookCode);
    
    // Use wldeh/bible-api via jsDelivr CDN (free, no API key required)
    const url = `https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/${apiTranslation}/books/${bookName}/chapters/${chapter}.json`;
    
    console.log(`Fetching: ${url}`);
    
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return Response.json({ 
          error: `${bookName} chapter ${chapter} is not available in ${apiTranslation}. Try a different translation (KJV, ASV, WEB, BBE).`,
          verses: []
        }, { status: 404 });
      }
      return Response.json({ 
        error: `Bible API error: ${response.status}`,
        verses: []
      }, { status: 500 });
    }

    const data = await response.json();
    
    if (!data || !data.data || data.data.length === 0) {
      return Response.json({ 
        error: 'No verses found in this chapter.',
        verses: []
      }, { status: 404 });
    }

    // Parse verses from the response
    // Format: { data: [{ book, chapter, verse, text }, ...] }
    // Remove duplicates (API sometimes returns duplicates)
    const seen = new Set();
    const verseData = data.data
      .filter(v => {
        const key = `${v.verse}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(v => ({
        verse: parseInt(v.verse, 10),
        text: v.text
      }));

    // Filter to specific verses if requested
    let filteredVerses = verseData;
    if (verses) {
      const [start, end] = verses.includes('-') 
        ? verses.split('-').map(Number)
        : [Number(verses), Number(verses)];
      
      filteredVerses = verseData.filter(v => v.verse >= start && v.verse <= end);
    }

    return Response.json({
      reference: `${data.book || bookName} ${chapter}${verses ? `:${verses}` : ''}`,
      translationLabel: apiTranslation.toUpperCase(),
      translationLanguage: apiTranslation.split('-')[0],
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