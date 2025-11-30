import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Uses scripture.api.bible (requires API key in environment variables)
// Sign up at: https://scripture.api.bible
// Free tier: 500 requests/day

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { bibleId = 'de4e12af7f28f599-02', _selfTest } = await req.json();

    // Self-test mode for system diagnostics
    if (_selfTest) {
      return Response.json({ ok: true, selfTest: true, message: 'importFromScriptureAPI is operational' });
    }

    const apiKey = Deno.env.get('SCRIPTURE_API_KEY');
    if (!apiKey) {
      return Response.json({ 
        error: 'SCRIPTURE_API_KEY not set. Get one from https://scripture.api.bible' 
      }, { status: 400 });
    } // KJV by default

    console.log(`📖 Importing from Scripture API: ${bibleId}`);

    // Get all books
    const booksResponse = await fetch(
      `https://api.scripture.api.bible/v1/bibles/${bibleId}/books`,
      { headers: { 'api-key': apiKey } }
    );
    const booksData = await booksResponse.json();
    
    let totalVerses = 0;
    const versesToInsert = [];

    for (const book of booksData.data) {
      console.log(`📚 Processing ${book.name}...`);
      
      // Get all chapters for this book
      const chaptersResponse = await fetch(
        `https://api.scripture.api.bible/v1/bibles/${bibleId}/books/${book.id}/chapters`,
        { headers: { 'api-key': apiKey } }
      );
      const chaptersData = await chaptersResponse.json();

      for (const chapter of chaptersData.data) {
        if (chapter.number === 'intro') continue;

        try {
          // Get verses for this chapter
          const versesResponse = await fetch(
            `https://api.scripture.api.bible/v1/bibles/${bibleId}/chapters/${chapter.id}/verses`,
            { headers: { 'api-key': apiKey } }
          );
          const versesData = await versesResponse.json();

          for (const verse of versesData.data) {
            versesToInsert.push({
              book_name: book.name,
              chapter: parseInt(chapter.number),
              verse: parseInt(verse.number),
              text: verse.text?.replace(/<[^>]*>/g, '') || '', // Strip HTML tags
              translation: 'KJV'
            });
            totalVerses++;

            // Batch insert every 100 verses
            if (versesToInsert.length >= 100) {
              await base44.asServiceRole.entities.Verse.bulkCreate(versesToInsert);
              console.log(`✅ Inserted ${versesToInsert.length} verses (total: ${totalVerses})`);
              versesToInsert.length = 0;
            }
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`Error importing ${book.name} ${chapter.number}:`, error);
        }
      }
    }

    // Insert remaining verses
    if (versesToInsert.length > 0) {
      await base44.asServiceRole.entities.Verse.bulkCreate(versesToInsert);
      console.log(`✅ Inserted final ${versesToInsert.length} verses`);
    }

    return Response.json({
      success: true,
      message: `Imported ${totalVerses} verses from Scripture API`,
      totalVerses
    });

  } catch (error) {
    console.error('❌ Error importing from Scripture API:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});