import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all translations
    const translations = await base44.asServiceRole.entities.Translation.filter({ enabled: true });
    
    // Get all verses
    const allVerses = await base44.asServiceRole.entities.Verse.list('-created_date', 5000);
    
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
    
    const completed = results.filter(r => r.complete).length;
    const totalVerses = allVerses.length;
    
    return Response.json({
      success: true,
      totalTranslations: translations.length,
      completedTranslations: completed,
      totalVerses: totalVerses,
      translations: results,
      summary: `${completed}/${translations.length} translations complete (${totalVerses.toLocaleString()} verses)`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});