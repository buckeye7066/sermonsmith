import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Free Bible APIs:
// - bible-api.com (KJV, ASV, YLT, WEB)
// - api.scripture.api.bible (multiple translations with API key)
// - bolls.life/api (multiple translations)

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can import Bible data
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        error: 'Admin access required'
      }, { status: 403 });
    }

    const { translation = 'KJV', book, startChapter, endChapter, _selfTest } = await req.json();

    // Self-test mode for system diagnostics
    if (_selfTest) {
      return Response.json({ ok: true, selfTest: true, message: 'importBibleData is operational' });
    }

    console.log(`📖 Starting Bible import: ${translation} - ${book} chapters ${startChapter}-${endChapter}`);

    const versesToInsert = [];
    let totalVerses = 0;

    // Import from bible-api.com (supports KJV)
    for (let chapter = startChapter; chapter <= endChapter; chapter++) {
      try {
        const response = await fetch(`https://bible-api.com/${book}+${chapter}?translation=${translation.toLowerCase()}`);
        const data = await response.json();

        if (data.verses) {
          for (const verse of data.verses) {
            versesToInsert.push({
              book_name: verse.book_name,
              chapter: verse.chapter,
              verse: verse.verse,
              text: verse.text,
              translation: translation
            });
            totalVerses++;
          }
        }

        // Insert in batches of 100
        if (versesToInsert.length >= 100) {
          await base44.asServiceRole.entities.Verse.bulkCreate(versesToInsert);
          console.log(`✅ Inserted ${versesToInsert.length} verses`);
          versesToInsert.length = 0; // Clear array
        }

        // Rate limiting - wait 100ms between chapters
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error importing ${book} ${chapter}:`, error);
      }
    }

    // Insert remaining verses
    if (versesToInsert.length > 0) {
      await base44.asServiceRole.entities.Verse.bulkCreate(versesToInsert);
      console.log(`✅ Inserted final ${versesToInsert.length} verses`);
    }

    return Response.json({
      success: true,
      message: `Imported ${totalVerses} verses from ${book} (${translation})`,
      totalVerses
    });

  } catch (error) {
    console.error('❌ Error importing Bible data:', error);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});