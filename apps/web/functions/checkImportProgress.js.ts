import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get latest verses from database
    const latestVerses = await base44.asServiceRole.entities.Verse.filter(
      {}, 
      '-created_date', 
      10
    );

    // Get count of verses per translation
    const translations = ['KJV', 'Nuova Riveduta', 'Svenska Bibeln', 'Det Norsk Bibelselskap'];
    const counts = {};
    
    for (const trans of translations) {
      try {
        const verses = await base44.asServiceRole.entities.Verse.filter({
          translation_id: trans
        }, 'id', 1);
        counts[trans] = verses.length > 0 ? 'Has data' : 'Empty';
      } catch (e) {
        counts[trans] = 'Error: ' + e.message;
      }
    }

    // Test if we can write to database
    let canWrite = false;
    try {
      const testVerse = await base44.asServiceRole.entities.Verse.create({
        translation_id: 'TEST',
        book_name: 'Test',
        chapter: 1,
        verse: 1,
        text: 'Test verse at ' + new Date().toISOString(),
        source_hash: 'test-' + Date.now()
      });
      
      // Clean up test verse
      await base44.asServiceRole.entities.Verse.delete(testVerse.id);
      canWrite = true;
    } catch (e) {
      canWrite = 'Error: ' + e.message;
    }

    return Response.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      latest_verses: latestVerses.map(v => ({
        translation: v.translation_id,
        book: v.book_name,
        chapter: v.chapter,
        verse: v.verse,
        created: v.created_date
      })),
      translation_counts: counts,
      can_write_to_db: canWrite,
      total_verses: latestVerses.length
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});