import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Book name to USFM/OSIS code mapping
const bookCodeMap = {
  "Genesis": "GEN", "Exodus": "EXO", "Leviticus": "LEV", "Numbers": "NUM",
  "Deuteronomy": "DEU", "Joshua": "JOS", "Judges": "JDG", "Ruth": "RUT",
  "1 Samuel": "1SA", "2 Samuel": "2SA", "1 Kings": "1KI", "2 Kings": "2KI",
  "1 Chronicles": "1CH", "2 Chronicles": "2CH", "Ezra": "EZR", "Nehemiah": "NEH",
  "Esther": "EST", "Job": "JOB", "Psalms": "PSA", "Proverbs": "PRO",
  "Ecclesiastes": "ECC", "Song of Solomon": "SNG", "Isaiah": "ISA", "Jeremiah": "JER",
  "Lamentations": "LAM", "Ezekiel": "EZK", "Daniel": "DAN", "Hosea": "HOS",
  "Joel": "JOL", "Amos": "AMO", "Obadiah": "OBA", "Jonah": "JON",
  "Micah": "MIC", "Nahum": "NAM", "Habakkuk": "HAB", "Zephaniah": "ZEP",
  "Haggai": "HAG", "Zechariah": "ZEC", "Malachi": "MAL",
  "Matthew": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN",
  "Acts": "ACT", "Romans": "ROM", "1 Corinthians": "1CO", "2 Corinthians": "2CO",
  "Galatians": "GAL", "Ephesians": "EPH", "Philippians": "PHP", "Colossians": "COL",
  "1 Thessalonians": "1TH", "2 Thessalonians": "2TH", "1 Timothy": "1TI", "2 Timothy": "2TI",
  "Titus": "TIT", "Philemon": "PHM", "Hebrews": "HEB", "James": "JAS",
  "1 Peter": "1PE", "2 Peter": "2PE", "1 John": "1JN", "2 John": "2JN",
  "3 John": "3JN", "Jude": "JUD", "Revelation": "REV"
};

// Reverse mapping for incoming OSIS codes
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

// Normalize translation IDs from various formats to actual HelloAO API IDs
// The API uses specific IDs like "eng-kjv2006", "BSB", "ENGWEBP" etc.
const TRANSLATION_NORMALIZE_MAP = {
  // KJV variations -> actual API ID
  "en-kjv": "eng-kjv2006", "kjv": "eng-kjv2006", "k-j-v": "eng-kjv2006", 
  "king james": "eng-kjv2006", "kingjames": "eng-kjv2006",
  
  // WEB variations -> actual API ID  
  "en-web": "ENGWEBP", "web": "ENGWEBP", "world english bible": "ENGWEBP",
  
  // BSB is correct as-is
  "en-bsb": "BSB", "bsb": "BSB", "berean": "BSB",
  
  // Other English translations
  "en-asv": "eng-asv", "asv": "eng-asv",
  "en-darby": "eng-darby", "darby": "eng-darby",
  "en-ylt": "eng-ylt", "ylt": "eng-ylt",
  
  // Russian translations
  "ru-rst": "rus-synodal", "rst": "rus-synodal", "ru-synodal": "rus-synodal", 
  "synodal": "rus-synodal", "russian": "rus-synodal"
};

function normalizeTranslationId(translationId) {
  if (!translationId) return "eng-kjv2006";
  
  const lower = translationId.toLowerCase().trim();
  
  // Check direct mapping first
  if (TRANSLATION_NORMALIZE_MAP[lower]) {
    return TRANSLATION_NORMALIZE_MAP[lower];
  }
  
  // If already looks like an API ID (contains hyphen or matches known pattern), use as-is
  if (translationId.includes('-') || /^[A-Z]{2,}$/.test(translationId)) {
    return translationId;
  }
  
  // Default to KJV if unknown
  return "eng-kjv2006";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { translationId, bookCode, chapter, verses } = await req.json();

    // Validate required inputs
    if (!bookCode) {
      return Response.json({ 
        error: 'Missing required field: bookCode' 
      }, { status: 400 });
    }
    
    if (!chapter && chapter !== 0) {
      return Response.json({ 
        error: 'Missing required field: chapter' 
      }, { status: 400 });
    }

    // Convert the incoming bookCode to USFM format for bible.helloao.org
    const usfmBookCode = osisToUsfm[bookCode] || bookCode;
    
    // Normalize translation ID to API format
    const apiTranslationId = normalizeTranslationId(translationId);
    
    console.log(`Normalized translation: ${translationId} -> ${apiTranslationId}`);
    
    // Fetch chapter data from bible.helloao.org
    const url = `https://bible.helloao.org/api/${apiTranslationId}/${usfmBookCode}/${chapter}.json`;
    
    console.log(`Fetching: ${url}`);
    
    const response = await fetch(url);
    
    // Check content type before parsing
    const contentType = response.headers.get('content-type') || '';
    
    if (!response.ok) {
      // If translation not found, try to provide helpful error
      if (response.status === 404) {
        return Response.json({ 
          error: `This chapter is not available in the ${apiTranslationId} translation. Try KJV or BSB.`,
          translation_not_found: true
        }, { status: 404 });
      }
      return Response.json({ 
        error: `Failed to fetch Bible data: ${response.status} ${response.statusText}` 
      }, { status: 500 });
    }
    
    // Verify we got JSON, not HTML
    if (!contentType.includes('application/json')) {
      console.error(`Unexpected content type: ${contentType}`);
      return Response.json({ 
        error: `Invalid response from Bible API. Expected JSON but got ${contentType}. Try a different translation.` 
      }, { status: 500 });
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return Response.json({ 
        error: 'Failed to parse Bible data. The API returned invalid JSON.' 
      }, { status: 500 });
    }
    
    if (!data.chapter || !data.chapter.content) {
      return Response.json({ error: 'Chapter not found' }, { status: 404 });
    }

    // Parse the chapter content to extract verses
    // The helloao API returns content as an array of content items
    const verseData = [];
    let currentVerse = null;
    let currentText = "";
    
    for (const item of data.chapter.content) {
      if (item.type === "verse") {
        // Save previous verse if exists
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
      } else if (item.type === "line_break" && currentVerse !== null) {
        currentText += " ";
      }
    }
    
    // Don't forget the last verse
    if (currentVerse !== null && currentText.trim()) {
      verseData.push({
        verse: currentVerse,
        text: currentText.trim()
      });
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
      reference: `${bookCode} ${chapter}${verses ? `:${verses}` : ''}`,
      translationLabel: data.translation?.name || translationId,
      translationLanguage: data.translation?.language || "eng",
      verses: filteredVerses
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});