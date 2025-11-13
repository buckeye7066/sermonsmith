import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

    console.log('[QuickStatus] Checking KJV import status...');

    // Just count KJV verses - quick and simple
    const kjvVerses = await base44.asServiceRole.entities.Verse.filter({
      translation_id: 'KJV'
    }, 'id', 100);

    // Count total chapters imported
    const uniqueChapters = new Set();
    const uniqueBooks = new Set();
    
    for (const verse of kjvVerses) {
      uniqueChapters.add(`${verse.book_name}-${verse.chapter}`);
      uniqueBooks.add(verse.book_name);
    }

    const totalVerses = kjvVerses.length;
    const isComplete = totalVerses > 31000; // KJV has 31,102 verses
    const percentComplete = Math.min(100, Math.round((totalVerses / 31102) * 100));

    return Response.json({
      success: true,
      translation: 'KJV',
      totalVerses,
      totalChapters: uniqueChapters.size,
      totalBooks: uniqueBooks.size,
      percentComplete,
      isComplete,
      message: isComplete 
        ? '✅ KJV Bible import complete!' 
        : `⏳ Import in progress: ${totalVerses.toLocaleString()} of 31,102 verses (${percentComplete}%)`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[QuickStatus] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});