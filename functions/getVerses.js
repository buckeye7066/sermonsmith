import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { translationId, book, chapter } = await req.json();

    // Check cache
    try {
      const verses = await base44.asServiceRole.entities.Verse.filter({
        translation_id: translationId,
        book_name: book,
        chapter: chapter
      }, 'verse');

      if (verses.length > 0) {
        return Response.json({ verses, cached: true, source: 'database' });
      }
    } catch (e) {}

    // Not cached - try API
    console.log(`[FETCH] ${translationId} ${book} ${chapter}`);
    
    try {
      const verses = await fetchFromBibleAPI(translationId, book, chapter);
      
      if (verses.length > 0) {
        cacheAsync(base44, verses, translationId, book, chapter);
      }

      return Response.json({ verses, cached: false, source: 'api' });
      
    } catch (error) {
      console.error('[FETCH] Failed:', error.message);
      return Response.json({ 
        error: 'Not available',
        verses: [],
        cached: false
      }, { status: 200 });
    }

  } catch (error) {
    return Response.json({ error: error.message, verses: [] }, { status: 200 });
  }
});

async function cacheAsync(base44, verses, translationId, book, chapter) {
  try {
    const records = verses.map(v => ({
      translation_id: translationId,
      book_name: book,
      chapter: chapter,
      verse: v.verse,
      text: v.text,
      source_hash: `${translationId}-${book}-${chapter}-${v.verse}`
    }));

    const batchSize = 20;
    for (let i = 0; i < records.length; i += batchSize) {
      await base44.asServiceRole.entities.Verse.bulkCreate(records.slice(i, i + batchSize));
    }
  } catch (e) {}
}

async function fetchFromBibleAPI(translationId, book, chapter) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `https://bible-api.com/${encodeURIComponent(book)}+${chapter}?translation=${translationId.toLowerCase()}`;
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'SermonSmith/2.0',
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API ${response.status}`);
    }

    const data = await response.json();
    
    if (data.verses && Array.isArray(data.verses)) {
      return data.verses.map(v => ({ verse: v.verse, text: v.text }));
    } else if (data.text) {
      const verseMatch = data.reference?.match(/:(\d+)/);
      return [{ verse: verseMatch ? parseInt(verseMatch[1]) : 1, text: data.text }];
    }

    return [];

  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}