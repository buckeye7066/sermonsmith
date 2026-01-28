import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  console.log('[TEST] Starting single chapter import test');
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[TEST] User authenticated:', user.email);

    // Test importing a single chapter
    const translation = 'KJV';
    const book = 'Genesis';
    const chapter = 1;

    console.log(`[TEST] Attempting to fetch ${translation} ${book} ${chapter}`);

    // Try the API
    const url = `https://bible-api.com/${encodeURIComponent(book)}+${chapter}?translation=${translation.toLowerCase()}`;
    console.log('[TEST] URL:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SermonSmith/2.0',
        'Accept': 'application/json'
      }
    });

    console.log('[TEST] API Response status:', response.status);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('[TEST] Got data, verses count:', data.verses?.length || 'unknown');

    let verses = [];
    if (data.verses && Array.isArray(data.verses)) {
      verses = data.verses.map(v => ({ verse: v.verse, text: v.text }));
    } else if (data.text) {
      verses = [{ verse: 1, text: data.text }];
    }

    console.log('[TEST] Processed verses:', verses.length);

    // Try to save to database
    if (verses.length > 0) {
      console.log('[TEST] Attempting to save to database...');
      
      const records = verses.map(v => ({
        translation_id: translation,
        book_name: book,
        chapter: chapter,
        verse: v.verse,
        text: v.text,
        source_hash: `${translation}-${book}-${chapter}-${v.verse}`
      }));

      console.log('[TEST] Creating', records.length, 'records');

      const created = await base44.asServiceRole.entities.Verse.bulkCreate(records);
      console.log('[TEST] Successfully created verses:', created.length);

      return Response.json({
        success: true,
        message: `Successfully imported ${translation} ${book} ${chapter}`,
        verses_count: verses.length,
        created_count: created.length,
        sample_verse: verses[0]
      });
    }

    return Response.json({
      success: false,
      message: 'No verses found',
      api_response: data
    });

  } catch (error) {
    console.error('[TEST] Error:', error.message);
    console.error('[TEST] Stack:', error.stack);
    
    return Response.json({ 
      success: false,
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});