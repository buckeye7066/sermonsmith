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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { translationId, bookCode, chapter, verses } = await req.json();

    // Convert the incoming bookCode to USFM format for bible.helloao.org
    const usfmBookCode = osisToUsfm[bookCode] || bookCode;
    
    // The helloao API uses translation IDs directly (BSB, KJV, RUSV, etc.)
    // The translationId should come directly from the API list
    const apiTranslationId = translationId;
    
    // Fetch chapter data from bible.helloao.org
    const url = `https://bible.helloao.org/api/${apiTranslationId}/${usfmBookCode}/${chapter}.json`;
    
    console.log(`Fetching: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      // If translation not found, try to provide helpful error
      if (response.status === 404) {
        return Response.json({ 
          error: `This chapter is not available in the ${translationId} translation. Try KJV or BSB.`,
          translation_not_found: true
        }, { status: 404 });
      }
      throw new Error(`Failed to fetch Bible data: ${response.statusText}`);
    }

    const data = await response.json();
    
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