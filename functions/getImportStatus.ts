import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[getImportStatus] Fetching translations and verses...');

    // Get all translations
    const translations = await base44.asServiceRole.entities.Translation.filter({ enabled: true });
    
    // Get ALL verses by fetching in batches
    console.log('[getImportStatus] Fetching all verses...');
    let allVerses = [];
    let skip = 0;
    const batchSize = 1000;
    
    while (true) {
      const batch = await base44.asServiceRole.entities.Verse.list('-created_date', batchSize, skip);
      if (batch.length === 0) break;
      allVerses = allVerses.concat(batch);
      skip += batchSize;
      console.log(`[getImportStatus] Fetched ${allVerses.length} verses so far...`);
      if (batch.length < batchSize) break; // Last batch
    }
    
    console.log(`[getImportStatus] Total verses fetched: ${allVerses.length}`);
    
    // Group by translation
    const byTranslation = {};
    for (const verse of allVerses) {
      if (!byTranslation[verse.translation_id]) {
        byTranslation[verse.translation_id] = {
          verses: 0,
          chapters: new Set(),
          books: new Set()
        };
      }
      byTranslation[verse.translation_id].verses++;
      byTranslation[verse.translation_id].chapters.add(`${verse.book_name}-${verse.chapter}`);
      byTranslation[verse.translation_id].books.add(verse.book_name);
    }
    
    console.log(`[getImportStatus] Processing ${Object.keys(byTranslation).length} translations with data`);
    
    // Format results
    const results = [];
    for (const trans of translations) {
      const data = byTranslation[trans.id] || { verses: 0, chapters: new Set(), books: new Set() };
      results.push({
        id: trans.id,
        name: trans.name,
        verses: data.verses,
        chapters: data.chapters.size,
        books: data.books.size,
        complete: data.verses > 30000 // Full Bible has ~31k verses
      });
    }
    
    // Sort by verse count descending to show active imports first
    results.sort((a, b) => b.verses - a.verses);
    
    const completed = results.filter(r => r.complete).length;
    const inProgress = results.filter(r => r.verses > 0 && !r.complete).length;
    const totalVerses = allVerses.length;
    
    console.log(`[getImportStatus] Summary: ${completed} complete, ${inProgress} in progress, ${totalVerses} total verses`);
    
    return Response.json({
      success: true,
      totalTranslations: translations.length,
      completedTranslations: completed,
      inProgressTranslations: inProgress,
      totalVerses: totalVerses,
      translations: results,
      summary: `${completed}/${translations.length} translations complete • ${inProgress} in progress • ${totalVerses.toLocaleString()} verses imported`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[getImportStatus] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});