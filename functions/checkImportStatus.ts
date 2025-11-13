import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ 
        error: 'Forbidden - Admin access required',
        user_email: user.email,
        user_role: user.role
      }, { status: 403 });
    }

    console.log('📊 Checking import status...');

    // Count total verses
    const allVerses = await base44.asServiceRole.entities.Verse.list('created_date', 1000);
    
    // Group by translation
    const byTranslation = {};
    for (const verse of allVerses) {
      if (!byTranslation[verse.translation_id]) {
        byTranslation[verse.translation_id] = {
          count: 0,
          books: new Set(),
          chapters: new Set()
        };
      }
      byTranslation[verse.translation_id].count++;
      byTranslation[verse.translation_id].books.add(verse.book_name);
      byTranslation[verse.translation_id].chapters.add(`${verse.book_name}-${verse.chapter}`);
    }

    // Format results
    const results = {};
    for (const [trans, data] of Object.entries(byTranslation)) {
      results[trans] = {
        totalVerses: data.count,
        uniqueBooks: data.books.size,
        uniqueChapters: data.chapters.size,
        percentComplete: Math.round((data.count / 31102) * 100) // Full Bible has ~31,102 verses
      };
    }

    return Response.json({
      success: true,
      totalVerses: allVerses.length,
      translations: results,
      message: allVerses.length > 0 
        ? `✅ You have ${allVerses.length} verses imported!` 
        : '⚠️ No verses imported yet',
      nextSteps: allVerses.length > 0
        ? 'Go to Bible Reader to read your verses!'
        : 'Run bulk import from the BulkImport page'
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});