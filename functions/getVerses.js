import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { translationId, book, chapter } = await req.json();

    // FAST: Cache check first
    try {
      const verses = await base44.asServiceRole.entities.Verse.filter({
        translation_id: translationId,
        book_name: book,
        chapter: chapter
      }, 'verse');

      if (verses.length > 0) {
        return Response.json({ 
          verses, 
          cached: true,
          source: 'database'
        });
      }
    } catch (e) {
      console.error('[CACHE] Error:', e);
    }

    // Not cached - try to fetch
    console.log(`[FETCH] ${translationId} ${book} ${chapter} - Fetching...`);
    
    // CRITICAL: Only bible-api.com supports KJV and WEB reliably
    const supportedTranslations = ['KJV', 'WEB'];
    
    if (!supportedTranslations.includes(translationId.toUpperCase())) {
      return Response.json({ 
        error: `Translation ${translationId} not yet available`,
        details: 'This translation requires manual upload. Currently only KJV and WEB are available for auto-import.',
        verses: [],
        cached: false,
        source: 'unavailable'
      }, { status: 200 });
    }
    
    try {
      const verses = await fetchFromBibleAPI(translationId, book, chapter);
      
      if (verses.length > 0) {
        // Cache for next time (fire and forget)
        cacheVersesAsync(base44, verses, translationId, book, chapter);
      }

      return Response.json({ 
        verses, 
        cached: false,
        source: 'api'
      });
      
    } catch (fetchError) {
      console.error('[FETCH] Failed:', fetchError.message);
      
      return Response.json({ 
        error: 'Failed to fetch verses',
        details: fetchError.message,
        verses: [],
        cached: false,
        source: 'error'
      }, { status: 200 });
    }

  } catch (error) {
    console.error('[ERROR]:', error);
    return Response.json({ 
      error: error.message || 'Internal error',
      verses: [],
      cached: false
    }, { status: 200 });
  }
});

async function cacheVersesAsync(base44, verses, translationId, book, chapter) {
  try {
    const verseRecords = verses.map(v => ({
      translation_id: translationId,
      book_name: book,
      chapter: chapter,
      verse: v.verse,
      text: v.text,
      source_hash: `${translationId}-${book}-${chapter}-${v.verse}`
    }));

    const batchSize = 20;
    for (let i = 0; i < verseRecords.length; i += batchSize) {
      const batch = verseRecords.slice(i, i + batchSize);
      await base44.asServiceRole.entities.Verse.bulkCreate(batch);
    }

    console.log(`[CACHE] ✓ Stored ${verses.length} verses`);
  } catch (e) {
    console.error('[CACHE] Error:', e.message);
  }
}

async function fetchFromBibleAPI(translationId, book, chapter) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const encodedBook = encodeURIComponent(book);
    const url = `https://bible-api.com/${encodedBook}+${chapter}?translation=${translationId.toLowerCase()}`;
    
    console.log(`[API] Fetching: ${url}`);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'SermonSmith Bible App/2.0',
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    
    let verses = [];
    
    if (data.verses && Array.isArray(data.verses)) {
      verses = data.verses.map(v => ({ verse: v.verse, text: v.text }));
    } else if (data.text) {
      const verseMatch = data.reference?.match(/:(\d+)/);
      verses = [{ verse: verseMatch ? parseInt(verseMatch[1]) : 1, text: data.text }];
    }

    console.log(`[API] ✓ Got ${verses.length} verses`);
    return verses;

  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}