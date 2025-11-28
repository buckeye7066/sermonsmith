import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Map translation IDs to bible-api.com identifiers
// bible-api.com supports: kjv, web, bbe (Bible in Basic English)
const bibleApiTranslations = {
  "en-kjv": "kjv",
  "en-web": "web"
};

// Translation names for display
const translationNames = {
  "en-kjv": "King James Version (KJV)",
  "en-web": "World English Bible (WEB)",
  "en-niv": "New International Version (NIV)",
  "en-esv": "English Standard Version (ESV)",
  "en-nlt": "New Living Translation (NLT)",
  "en-nkjv": "New King James Version (NKJV)",
  "en-nasb": "New American Standard Bible (NASB)",
  "es-rvr": "Reina-Valera (RVR)",
  "fr-lsg": "Louis Segond (LSG)",
  "de-lut": "Luther Bible (LUT)",
  "pt-arc": "Almeida Revista e Corrigida (ARC)",
  "zh-cnv": "Chinese Union Version (CNV)",
  "ru-rst": "Russian Synodal Translation (RST)",
  "he-wlc": "Westminster Leningrad Codex (Hebrew OT)",
  "el-grk": "Greek New Testament (Textus Receptus)",
  "arc-peshitta": "Peshitta (Aramaic)"
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { translationId, bookCode, chapter, verses } = await req.json();

    // Check if this is a supported translation via bible-api.com
    const apiTranslationId = bibleApiTranslations[translationId];
    
    if (!apiTranslationId) {
      // This translation is not available via bible-api.com
      // Return an error explaining the translation is not yet supported
      return Response.json({ 
        error: `The ${translationNames[translationId] || translationId} translation is not currently available. Please select KJV or WEB.`,
        unsupported_translation: true
      }, { status: 400 });
    }
    
    // Fetch chapter data from bible-api.com
    const url = `https://bible-api.com/data/${apiTranslationId}/${bookCode}/${chapter}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch Bible data: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.verses || data.verses.length === 0) {
      return Response.json({ error: 'Chapter not found' }, { status: 404 });
    }

    let verseData = data.verses.map(v => ({
      verse: v.verse,
      text: v.text
    }));
    
    // Filter to specific verses if requested
    if (verses) {
      const [start, end] = verses.includes('-') 
        ? verses.split('-').map(Number)
        : [Number(verses), Number(verses)];
      
      verseData = verseData.filter(v => v.verse >= start && v.verse <= end);
    }

    return Response.json({
      reference: `${bookCode} ${chapter}${verses ? `:${verses}` : ''}`,
      translationLabel: translationNames[translationId] || translationId,
      verses: verseData
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});