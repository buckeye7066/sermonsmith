import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Book name to API book ID mapping
const BOOK_ID_MAP = {
  "GEN": "GEN", "EXO": "EXO", "LEV": "LEV", "NUM": "NUM", "DEU": "DEU",
  "JOS": "JOS", "JDG": "JDG", "RUT": "RUT", "1SA": "1SA", "2SA": "2SA",
  "1KI": "1KI", "2KI": "2KI", "1CH": "1CH", "2CH": "2CH", "EZR": "EZR",
  "NEH": "NEH", "EST": "EST", "JOB": "JOB", "PSA": "PSA", "PRO": "PRO",
  "ECC": "ECC", "SNG": "SNG", "ISA": "ISA", "JER": "JER", "LAM": "LAM",
  "EZK": "EZK", "DAN": "DAN", "HOS": "HOS", "JOL": "JOL", "AMO": "AMO",
  "OBA": "OBA", "JON": "JON", "MIC": "MIC", "NAM": "NAM", "HAB": "HAB",
  "ZEP": "ZEP", "HAG": "HAG", "ZEC": "ZEC", "MAL": "MAL",
  "MAT": "MAT", "MRK": "MRK", "LUK": "LUK", "JHN": "JHN", "ACT": "ACT",
  "ROM": "ROM", "1CO": "1CO", "2CO": "2CO", "GAL": "GAL", "EPH": "EPH",
  "PHP": "PHP", "COL": "COL", "1TH": "1TH", "2TH": "2TH", "1TI": "1TI",
  "2TI": "2TI", "TIT": "TIT", "PHM": "PHM", "HEB": "HEB", "JAS": "JAS",
  "1PE": "1PE", "2PE": "2PE", "1JN": "1JN", "2JN": "2JN", "3JN": "3JN",
  "JUD": "JUD", "REV": "REV"
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

// Translation ID to API Bible ID mapping
const TRANSLATION_TO_BIBLE_ID = {
  // English translations
  "eng-kjv2006": "de4e12af7f28f599-02",
  "kjv": "de4e12af7f28f599-02",
  "eng-kjv": "de4e12af7f28f599-02",
  "KJV": "de4e12af7f28f599-02",
  
  "eng-esv": "06125adad2d5898a-01",
  "esv": "06125adad2d5898a-01",
  "ESV": "06125adad2d5898a-01",
  
  "eng-asv": "06125adad2d5898a-01", // fallback to ESV if ASV not available
  "asv": "06125adad2d5898a-01",
  "ASV": "06125adad2d5898a-01",
  
  "BSB": "bba9f40183526463-01",
  "bsb": "bba9f40183526463-01",
  
  "ENGWEBP": "9879dbb7cfe39e4d-04",
  "web": "9879dbb7cfe39e4d-04",
  "WEB": "9879dbb7cfe39e4d-04",
  
  // Russian translations
  "ru-rst": "bba9f40183526463-01",
  "rst": "bba9f40183526463-01",
  "rus-synodal": "bba9f40183526463-01"
};

function getBibleId(translationId) {
  if (!translationId) return "de4e12af7f28f599-02"; // Default to KJV
  
  // Check direct mapping
  if (TRANSLATION_TO_BIBLE_ID[translationId]) {
    return TRANSLATION_TO_BIBLE_ID[translationId];
  }
  
  // Check lowercase
  const lower = translationId.toLowerCase();
  if (TRANSLATION_TO_BIBLE_ID[lower]) {
    return TRANSLATION_TO_BIBLE_ID[lower];
  }
  
  // If it already looks like a Bible ID (contains hyphen with numbers), use as-is
  if (/^[a-f0-9]+-[a-f0-9]+$/.test(translationId)) {
    return translationId;
  }
  
  // Default to KJV
  return "de4e12af7f28f599-02";
}

function getBookCode(bookCode) {
  // If it's an OSIS code, convert it
  if (osisToBookCode[bookCode]) {
    return osisToBookCode[bookCode];
  }
  // If it's already a standard code, use it
  if (BOOK_ID_MAP[bookCode]) {
    return bookCode;
  }
  // Return as-is and let API handle it
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

    // Sanity check for required fields
    if (!bookCode || !chapter) {
      return Response.json({ 
        success: false,
        error: true,
        message: "Missing book or chapter.",
        verses: []
      }, { status: 400 });
    }

    const apiKey = Deno.env.get("BIBLE_API_KEY");
    if (!apiKey) {
      return Response.json({ 
        success: false,
        error: true,
        message: "Bible API key not configured.",
        verses: []
      }, { status: 500 });
    }

    // Get the Bible ID for the translation
    const bibleId = getBibleId(translationId);
    const book = getBookCode(bookCode);
    
    // Build the passage ID (e.g., "GEN.1" for Genesis chapter 1)
    const passageId = `${book}.${chapter}`;
    
    console.log(`Fetching: bibleId=${bibleId}, passageId=${passageId}`);
    
    // Fetch from scripture.api.bible
    const url = `https://api.scripture.api.bible/v1/bibles/${bibleId}/chapters/${passageId}?content-type=json&include-verse-numbers=true`;
    
    const response = await fetch(url, {
      headers: {
        "api-key": apiKey,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[biblePassage] API error:", response.status, errorData);
      
      if (response.status === 404) {
        return Response.json({ 
          success: false,
          error: true,
          message: `Chapter ${book} ${chapter} not found in this translation.`,
          verses: []
        }, { status: 404 });
      }
      
      return Response.json({ 
        success: false,
        error: true,
        message: errorData.message || `Bible API error: ${response.status}`,
        verses: []
      }, { status: response.status });
    }

    const data = await response.json();
    
    if (!data.data || !data.data.content) {
      return Response.json({ 
        success: false,
        error: true,
        message: "No content returned from Bible API.",
        verses: []
      }, { status: 404 });
    }

    // Parse verses from the API response
    const verseData = [];
    const content = data.data.content;
    
    // The API returns content as an array of blocks
    for (const block of content) {
      if (!block.items) continue;
      
      for (const item of block.items) {
        if (item.type === "verse" || item.attrs?.verseId) {
          const verseId = item.attrs?.verseId || item.verseId;
          if (!verseId) continue;
          
          // Extract verse number from verseId (format: "GEN.1.1")
          const parts = verseId.split(".");
          const verseNum = parseInt(parts[parts.length - 1], 10);
          
          // Extract text from item
          let text = "";
          if (item.text) {
            text = item.text;
          } else if (item.items) {
            // Nested items
            for (const subItem of item.items) {
              if (subItem.text) {
                text += subItem.text;
              } else if (subItem.items) {
                for (const subSubItem of subItem.items) {
                  if (subSubItem.text) {
                    text += subSubItem.text;
                  }
                }
              }
            }
          }
          
          if (text.trim() && !isNaN(verseNum)) {
            // Check if we already have this verse (avoid duplicates)
            const existing = verseData.find(v => v.verse === verseNum);
            if (existing) {
              existing.text += " " + text.trim();
            } else {
              verseData.push({
                verse: verseNum,
                text: text.trim()
              });
            }
          }
        } else if (item.items) {
          // Handle nested structure
          for (const subItem of item.items) {
            if (subItem.attrs?.verseId) {
              const verseId = subItem.attrs.verseId;
              const parts = verseId.split(".");
              const verseNum = parseInt(parts[parts.length - 1], 10);
              
              let text = "";
              if (subItem.text) {
                text = subItem.text;
              } else if (subItem.items) {
                for (const child of subItem.items) {
                  if (child.text) text += child.text;
                }
              }
              
              if (text.trim() && !isNaN(verseNum)) {
                const existing = verseData.find(v => v.verse === verseNum);
                if (existing) {
                  existing.text += " " + text.trim();
                } else {
                  verseData.push({
                    verse: verseNum,
                    text: text.trim()
                  });
                }
              }
            }
          }
        }
      }
    }
    
    // Sort verses by number
    verseData.sort((a, b) => a.verse - b.verse);
    
    // Filter to specific verses if requested
    let filteredVerses = verseData;
    if (verses) {
      const [start, end] = verses.includes('-') 
        ? verses.split('-').map(Number)
        : [Number(verses), Number(verses)];
      
      filteredVerses = verseData.filter(v => v.verse >= start && v.verse <= end);
    }

    return Response.json({
      success: true,
      reference: `${book} ${chapter}${verses ? `:${verses}` : ''}`,
      translationLabel: data.data.bibleId || translationId,
      translationLanguage: "eng",
      verses: filteredVerses
    });

  } catch (err) {
    console.error("[biblePassage] External API error:", err?.response?.data || err);
    
    return Response.json({
      success: false,
      error: true,
      message: err?.response?.data?.error || err.message || "Bible API error",
      verses: []
    }, { status: 500 });
  }
});