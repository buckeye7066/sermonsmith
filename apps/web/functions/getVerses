import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { translationId, book, chapter } = await req.json();

    // Always check cache first
    try {
      const verses = await base44.asServiceRole.entities.Verse.filter({
        translation_id: translationId,
        book_name: book,
        chapter: chapter
      }, 'verse');

      if (verses.length > 0) {
        return Response.json({ verses, cached: true });
      }
    } catch (e) {
      console.error('Cache lookup error:', e);
    }

    // No cache - try external fetch
    try {
      const verses = await fetchFromExternalAPI(translationId, book, chapter);
      
      // Try to cache for next time
      if (verses.length > 0) {
        try {
          const verseRecords = verses.map(v => ({
            translation_id: translationId,
            book_name: book,
            chapter: chapter,
            verse: v.verse,
            text: v.text,
            source_hash: `${translationId}-${book}-${chapter}-${v.verse}`
          }));

          // Insert in smaller batches to avoid timeout
          const batchSize = 10;
          for (let i = 0; i < verseRecords.length; i += batchSize) {
            const batch = verseRecords.slice(i, i + batchSize);
            await base44.asServiceRole.entities.Verse.bulkCreate(batch);
          }

          console.log(`✓ Cached ${verses.length} verses for ${translationId} ${book} ${chapter}`);
        } catch (e) {
          console.error('Cache insert error:', e.message);
        }
      }

      return Response.json({ verses, cached: false });
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      return Response.json({ 
        error: fetchError.message || 'Failed to fetch verses',
        verses: []
      }, { status: 200 });
    }

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message || 'Internal error',
      verses: []
    }, { status: 200 });
  }
});

async function fetchFromExternalAPI(translationId, book, chapter) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    // Encode book name for URL (handle spaces and special characters)
    const encodedBook = encodeURIComponent(book);
    const url = `https://bible-api.com/${encodedBook}+${chapter}?translation=${translationId.toLowerCase()}`;
    
    console.log(`Fetching: ${url}`);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'SermonSmith Bible App/1.0'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    
    // Handle both possible response formats
    let verses = [];
    
    if (data.verses && Array.isArray(data.verses)) {
      // Format 1: verses array
      verses = data.verses.map(v => ({
        verse: v.verse,
        text: v.text
      }));
    } else if (data.text) {
      // Format 2: single text with reference
      // Parse verse number from reference or use 1
      const verseMatch = data.reference?.match(/:(\d+)/);
      const verseNumber = verseMatch ? parseInt(verseMatch[1]) : 1;
      
      verses = [{
        verse: verseNumber,
        text: data.text
      }];
    } else {
      throw new Error('Invalid API response format');
    }

    if (verses.length === 0) {
      throw new Error('No verses returned from API');
    }

    return verses;

  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}