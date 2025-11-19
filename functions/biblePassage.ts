import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Bible source configurations
const bibleSources = {
  "en-kjv": {
    label: "King James Version (KJV)",
    remoteBaseUrl: "https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-kjv",
    bookSlugMap: {
      GEN: "genesis", EXO: "exodus", LEV: "leviticus", NUM: "numbers", DEU: "deuteronomy",
      JOS: "joshua", JDG: "judges", RUT: "ruth", "1SA": "1-samuel", "2SA": "2-samuel",
      "1KI": "1-kings", "2KI": "2-kings", "1CH": "1-chronicles", "2CH": "2-chronicles",
      EZR: "ezra", NEH: "nehemiah", EST: "esther", JOB: "job", PSA: "psalms",
      PRO: "proverbs", ECC: "ecclesiastes", SNG: "song-of-solomon", ISA: "isaiah",
      JER: "jeremiah", LAM: "lamentations", EZK: "ezekiel", DAN: "daniel",
      HOS: "hosea", JOL: "joel", AMO: "amos", OBA: "obadiah", JON: "jonah",
      MIC: "micah", NAM: "nahum", HAB: "habakkuk", ZEP: "zephaniah", HAG: "haggai",
      ZEC: "zechariah", MAL: "malachi", MAT: "matthew", MRK: "mark", LUK: "luke",
      JHN: "john", ACT: "acts", ROM: "romans", "1CO": "1-corinthians", "2CO": "2-corinthians",
      GAL: "galatians", EPH: "ephesians", PHP: "philippians", COL: "colossians",
      "1TH": "1-thessalonians", "2TH": "2-thessalonians", "1TI": "1-timothy", "2TI": "2-timothy",
      TIT: "titus", PHM: "philemon", HEB: "hebrews", JAS: "james", "1PE": "1-peter",
      "2PE": "2-peter", "1JN": "1-john", "2JN": "2-john", "3JN": "3-john",
      JUD: "jude", REV: "revelation"
    }
  },
  "en-web": {
    label: "World English Bible (WEB)",
    remoteBaseUrl: "https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-web",
    bookSlugMap: {
      GEN: "genesis", EXO: "exodus", LEV: "leviticus", NUM: "numbers", DEU: "deuteronomy",
      JOS: "joshua", JDG: "judges", RUT: "ruth", "1SA": "1-samuel", "2SA": "2-samuel",
      "1KI": "1-kings", "2KI": "2-kings", "1CH": "1-chronicles", "2CH": "2-chronicles",
      EZR: "ezra", NEH: "nehemiah", EST: "esther", JOB: "job", PSA: "psalms",
      PRO: "proverbs", ECC: "ecclesiastes", SNG: "song-of-solomon", ISA: "isaiah",
      JER: "jeremiah", LAM: "lamentations", EZK: "ezekiel", DAN: "daniel",
      HOS: "hosea", JOL: "joel", AMO: "amos", OBA: "obadiah", JON: "jonah",
      MIC: "micah", NAM: "nahum", HAB: "habakkuk", ZEP: "zephaniah", HAG: "haggai",
      ZEC: "zechariah", MAL: "malachi", MAT: "matthew", MRK: "mark", LUK: "luke",
      JHN: "john", ACT: "acts", ROM: "romans", "1CO": "1-corinthians", "2CO": "2-corinthians",
      GAL: "galatians", EPH: "ephesians", PHP: "philippians", COL: "colossians",
      "1TH": "1-thessalonians", "2TH": "2-thessalonians", "1TI": "1-timothy", "2TI": "2-timothy",
      TIT: "titus", PHM: "philemon", HEB: "hebrews", JAS: "james", "1PE": "1-peter",
      "2PE": "2-peter", "1JN": "1-john", "2JN": "2-john", "3JN": "3-john",
      JUD: "jude", REV: "revelation"
    }
  }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { translationId, bookCode, chapter, verses } = await req.json();

    const source = bibleSources[translationId || "en-kjv"];
    if (!source) {
      return Response.json({ error: 'Translation not found' }, { status: 404 });
    }

    const bookSlug = source.bookSlugMap[bookCode];
    if (!bookSlug) {
      return Response.json({ error: 'Invalid book code' }, { status: 400 });
    }

    const url = `${source.remoteBaseUrl}/${bookSlug}.json`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const data = await response.json();
    const chapterData = data.chapters?.find(c => c.chapter === parseInt(chapter));
    
    if (!chapterData) {
      return Response.json({ error: 'Chapter not found' }, { status: 404 });
    }

    let verseData = chapterData.verses || [];
    
    if (verses) {
      const [start, end] = verses.includes('-') 
        ? verses.split('-').map(Number)
        : [Number(verses), Number(verses)];
      
      verseData = verseData.filter(v => v.verse >= start && v.verse <= end);
    }

    return Response.json({
      reference: `${bookCode} ${chapter}${verses ? `:${verses}` : ''}`,
      translationLabel: source.label,
      verses: verseData
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});