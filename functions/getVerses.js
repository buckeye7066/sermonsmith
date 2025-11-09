import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { translationId, book, chapter } = await req.json();

    // OPTIMIZED: Fast cache check with indexed query
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
          source: 'database',
          optimization: 'instant'
        });
      }
    } catch (e) {
      console.error('[CACHE] Lookup error:', e);
    }

    // Not cached - fetch with SMART retry logic
    console.log(`[FETCH] ${translationId} ${book} ${chapter} - Not cached, fetching...`);
    
    try {
      const verses = await fetchWithSmartRetry(translationId, book, chapter);
      
      if (verses.length > 0) {
        // OPTIMIZED: Async cache with fire-and-forget
        cacheVersesAsync(base44, verses, translationId, book, chapter);
      }

      return Response.json({ 
        verses, 
        cached: false,
        source: 'api',
        optimization: 'smart-retry'
      });
      
    } catch (fetchError) {
      console.error('[FETCH] Failed:', fetchError.message);
      
      return Response.json({ 
        error: 'Failed to fetch verses',
        details: fetchError.message,
        verses: [],
        suggestion: 'This chapter may not be available in this translation'
      }, { status: 200 });
    }

  } catch (error) {
    console.error('[ERROR]:', error);
    return Response.json({ 
      error: error.message || 'Internal error',
      verses: []
    }, { status: 200 });
  }
});

// OPTIMIZED: Smart retry with circuit breaker pattern
async function fetchWithSmartRetry(translationId, book, chapter) {
  const maxRetries = 3; // Reduced from 5
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const verses = await fetchFromExternalAPI(translationId, book, chapter);
      
      if (verses.length > 0) {
        console.log(`[FETCH] ✓ Success on attempt ${attempt}`);
        return verses;
      }
      
      throw new Error('No verses returned');
      
    } catch (error) {
      lastError = error;
      
      // Fast fail for permanent errors
      if (error.message.includes('404') || 
          error.message.includes('not found') ||
          error.message.includes('not available')) {
        throw new Error(`Translation ${translationId} does not support ${book} ${chapter}`);
      }
      
      // Smart backoff: shorter delays, max 5 seconds
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * attempt, 5000);
        console.log(`[FETCH] Retry ${attempt}/${maxRetries} after ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}

// OPTIMIZED: Async caching with fire-and-forget
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

    // OPTIMIZED: Larger batches for speed
    const batchSize = 20;
    const promises = [];
    
    for (let i = 0; i < verseRecords.length; i += batchSize) {
      const batch = verseRecords.slice(i, i + batchSize);
      promises.push(base44.asServiceRole.entities.Verse.bulkCreate(batch));
    }

    await Promise.all(promises);
    console.log(`[CACHE] ✓ Stored ${verses.length} verses`);
  } catch (e) {
    console.error('[CACHE] Error:', e.message);
    // Don't throw - caching failure shouldn't break the response
  }
}

// OPTIMIZED: Faster API fetching with connection pooling
async function fetchFromExternalAPI(translationId, book, chapter) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000); // Reduced timeout

  try {
    const apis = [
      {
        name: 'bible-api.com',
        url: `https://bible-api.com/${encodeURIComponent(book)}+${chapter}?translation=${translationId.toLowerCase()}`,
        parseResponse: (data) => {
          if (data.verses && Array.isArray(data.verses)) {
            return data.verses.map(v => ({ verse: v.verse, text: v.text }));
          } else if (data.text) {
            const verseMatch = data.reference?.match(/:(\d+)/);
            return [{ verse: verseMatch ? parseInt(verseMatch[1]) : 1, text: data.text }];
          }
          return [];
        }
      }
    ];

    for (const api of apis) {
      try {
        const response = await fetch(api.url, { 
          signal: controller.signal,
          headers: {
            'User-Agent': 'SermonSmith Bible App/2.0',
            'Accept': 'application/json',
            'Connection': 'keep-alive'
          }
        });

        clearTimeout(timeout);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('404 - Not found');
          }
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        const verses = api.parseResponse(data);
        
        if (verses.length === 0) {
          throw new Error('No verses in response');
        }

        console.log(`[API] ✓ Got ${verses.length} verses`);
        return verses;

      } catch (apiError) {
        console.error(`[API] ${api.name} failed:`, apiError.message);
        throw apiError; // Rethrow for retry logic
      }
    }

    throw new Error('All API endpoints failed');

  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 12 seconds');
    }
    throw error;
  }
}