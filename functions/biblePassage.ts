import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// OSIS to USFM book code mapping
const osisToUsfm = {
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

// Translation ID normalization - HelloAO uses specific IDs
const TRANSLATION_MAP = {
  "kjv": "eng-kjv2006",
  "KJV": "eng-kjv2006",
  "eng-kjv": "eng-kjv2006",
  "eng-kjv2006": "eng-kjv2006",
  
  "web": "ENGWEBP",
  "WEB": "ENGWEBP",
  "ENGWEBP": "ENGWEBP",
  
  "bsb": "BSB",
  "BSB": "BSB",
  
  "asv": "eng-asv",
  "ASV": "eng-asv",
  "eng-asv": "eng-asv",
  
  "rst": "rus-synodal",
  "rus-synodal": "rus-synodal"
};

function getApiTranslationId(translationId) {
  if (!translationId) return "eng-kjv2006";
  return TRANSLATION_MAP[translationId] || TRANSLATION_MAP[translationId.toLowerCase()] || "eng-kjv2006";
}

function getBookCode(bookCode) {
  // Convert OSIS to USFM if needed
  if (osisToUsfm[bookCode]) {
    return osisToUsfm[bookCode];
  }
  return bookCode;
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

    const apiTranslationId = getApiTranslationId(translationId);
    const book = getBookCode(bookCode);
    
    // Fetch from HelloAO Bible API (free, no API key required)
    const url = `https://bible.helloao.org/api/${apiTranslationId}/${book}/${chapter}.json`;
    
    console.log(`Fetching: ${url}`);
    
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return Response.json({ 
          error: `Chapter not available in this translation. Try KJV or BSB.`,
          verses: []
        }, { status: 404 });
      }
      return Response.json({ 
        error: `Bible API error: ${response.status}`,
        verses: []
      }, { status: 500 });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return Response.json({ 
        error: `Invalid response from Bible API.`,
        verses: []
      }, { status: 500 });
    }

    const data = await response.json();
    
    if (!data.chapter || !data.chapter.content) {
      return Response.json({ 
        error: 'Chapter not found',
        verses: []
      }, { status: 404 });
    }

    // Parse verses - HelloAO format has verse items with content arrays
    const verseData = [];
    
    for (const item of data.chapter.content) {
      if (item.type === "verse" && item.number && item.content) {
        let verseText = "";
        
        for (const part of item.content) {
          if (typeof part === "string") {
            verseText += part;
          } else if (part && typeof part === "object") {
            if (part.text) {
              verseText += part.text;
            }
            if (part.lineBreak) {
              verseText += " ";
            }
          }
        }
        
        if (verseText.trim()) {
          verseData.push({
            verse: item.number,
            text: verseText.trim()
          });
        }
      }
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
      reference: `${book} ${chapter}${verses ? `:${verses}` : ''}`,
      translationLabel: data.translation?.name || translationId,
      translationLanguage: data.translation?.language || "eng",
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