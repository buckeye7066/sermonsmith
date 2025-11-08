import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { translationId, book, chapter } = await req.json();

    // ALWAYS check database cache first
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
      console.error('Cache lookup error:', e);
    }

    // Not in cache - try fetching from external API with AGGRESSIVE retry logic
    console.log(`[FETCH] ${translationId} ${book} ${chapter} - Not cached, fetching...`);
    
    try {
      const verses = await fetchWithRetry(translationId, book, chapter, 5);
      
      if (verses.length > 0) {
        // Cache it for future use
        try {
          const verseRecords = verses.map(v => ({
            translation_id: translationId,
            book_name: book,
            chapter: chapter,
            verse: v.verse,
            text: v.text,
            source_hash: `${translationId}-${book}-${chapter}-${v.verse}`
          }));

          // Insert in smaller batches
          const batchSize = 10;
          for (let i = 0; i < verseRecords.length; i += batchSize) {
            const batch = verseRecords.slice(i, i + batchSize);
            await base44.asServiceRole.entities.Verse.bulkCreate(batch);
          }

          console.log(`[CACHE] ✓ Stored ${verses.length} verses for ${translationId} ${book} ${chapter}`);
        } catch (e) {
          console.error('[CACHE] Insert error:', e.message);
          // Still return verses even if caching fails
        }
      }

      return Response.json({ 
        verses, 
        cached: false,
        source: 'api'
      });
      
    } catch (fetchError) {
      console.error('[FETCH] All retry attempts failed:', fetchError.message);
      
      // Return helpful error message
      return Response.json({ 
        error: 'Failed to fetch verses after multiple retries',
        details: fetchError.message,
        verses: [],
        translationId,
        book,
        chapter,
        suggestion: 'This chapter may not be available in this translation or the API is experiencing issues'
      }, { status: 200 }); // Return 200 so import continues
    }

  } catch (error) {
    console.error('[ERROR]:', error);
    return Response.json({ 
      error: error.message || 'Internal error',
      verses: []
    }, { status: 200 }); // Return 200 so import continues
  }
});

async function fetchWithRetry(translationId, book, chapter, maxRetries = 5) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[FETCH] Attempt ${attempt}/${maxRetries}: ${translationId} ${book} ${chapter}`);
      
      const verses = await fetchFromExternalAPI(translationId, book, chapter);
      
      if (verses.length > 0) {
        console.log(`[FETCH] ✓ Success on attempt ${attempt}`);
        return verses;
      }
      
      throw new Error('No verses returned from API');
      
    } catch (error) {
      lastError = error;
      console.error(`[FETCH] ✗ Attempt ${attempt} failed:`, error.message);
      
      // Don't retry if it's a clear "not found" error
      if (error.message.includes('404') || error.message.includes('not found')) {
        throw new Error(`Translation ${translationId} does not support ${book} ${chapter}`);
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
        console.log(`[FETCH] Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

async function fetchFromExternalAPI(translationId, book, chapter) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // Increased to 15 seconds

  try {
    // Try multiple API endpoints for better reliability
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
      // Add more API fallbacks here in the future
    ];

    for (const api of apis) {
      try {
        console.log(`[API] Trying ${api.name}...`);
        
        const response = await fetch(api.url, { 
          signal: controller.signal,
          headers: {
            'User-Agent': 'SermonSmith Bible App/1.0',
            'Accept': 'application/json'
          }
        });

        clearTimeout(timeout);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`404 - Translation or chapter not found`);
          }
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        const verses = api.parseResponse(data);
        
        if (verses.length === 0) {
          throw new Error('No verses in API response');
        }

        console.log(`[API] ✓ Got ${verses.length} verses from ${api.name}`);
        return verses;

      } catch (apiError) {
        console.error(`[API] ${api.name} failed:`, apiError.message);
        // Continue to next API
      }
    }

    throw new Error('All API endpoints failed');

  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 15 seconds');
    }
    throw error;
  }
}