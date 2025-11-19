import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Map translation IDs to bible-api.com identifiers
const translationMap = {
  "en-kjv": "kjv",
  "en-web": "web"
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { translationId, bookCode, chapter, verses } = await req.json();

    const apiTranslationId = translationMap[translationId] || "kjv";
    
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
      translationLabel: translationId === "en-kjv" ? "King James Version (KJV)" : "World English Bible (WEB)",
      verses: verseData
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});