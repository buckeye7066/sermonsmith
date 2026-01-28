import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[TEST TICK] Starting diagnostic test...');

    // Step 1: Check ImportJob entities exist
    const jobs = await base44.asServiceRole.entities.ImportJob.filter({}, '-updated_date', 5);
    console.log('[TEST TICK] Found', jobs.length, 'import jobs');

    if (jobs.length === 0) {
      return Response.json({
        success: false,
        error: 'No ImportJob entities found',
        fix: 'Click "Initialize Import Jobs" first'
      });
    }

    // Step 2: Find a pending job
    const pendingJob = jobs.find(j => j.status === 'pending');
    if (!pendingJob) {
      return Response.json({
        success: false,
        error: 'No pending jobs',
        jobs: jobs.map(j => ({ id: j.translation_id, status: j.status }))
      });
    }

    console.log('[TEST TICK] Testing with:', pendingJob.translation_id);

    // Step 3: Test API fetch
    const testUrl = `https://bible-api.com/John+1?translation=${pendingJob.translation_id.toLowerCase()}`;
    console.log('[TEST TICK] Fetching:', testUrl);
    
    const apiResponse = await fetch(testUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'SermonSmith/2.0',
        'Accept': 'application/json'
      }
    });

    if (!apiResponse.ok) {
      return Response.json({
        success: false,
        error: 'API fetch failed',
        status: apiResponse.status,
        translation: pendingJob.translation_id
      });
    }

    const apiData = await apiResponse.json();
    console.log('[TEST TICK] API returned', apiData.verses?.length || 0, 'verses');

    // Step 4: Test database write
    if (apiData.verses && apiData.verses.length > 0) {
      const testVerse = {
        translation_id: pendingJob.translation_id,
        book_name: 'John',
        chapter: 1,
        verse: apiData.verses[0].verse,
        text: apiData.verses[0].text,
        source_hash: `${pendingJob.translation_id}-John-1-${apiData.verses[0].verse}-test`
      };

      await base44.asServiceRole.entities.Verse.create(testVerse);
      console.log('[TEST TICK] Successfully wrote test verse to database');

      // Clean up test verse
      const cleanup = await base44.asServiceRole.entities.Verse.filter({
        source_hash: testVerse.source_hash
      });
      if (cleanup.length > 0) {
        await base44.asServiceRole.entities.Verse.delete(cleanup[0].id);
        console.log('[TEST TICK] Cleaned up test verse');
      }
    }

    // Step 5: Update job status
    await base44.asServiceRole.entities.ImportJob.update(pendingJob.id, {
      last_heartbeat: new Date().toISOString(),
      progress: {
        current_book: 'TEST',
        current_chapter: 1,
        total_chapters_imported: 0,
        total_verses_imported: 0,
        books_completed: []
      }
    });

    console.log('[TEST TICK] ✅ All systems operational');

    return Response.json({
      success: true,
      message: 'All systems working!',
      tested_translation: pendingJob.translation_id,
      api_verses_fetched: apiData.verses?.length || 0,
      database_write: 'OK',
      job_update: 'OK',
      ready_to_import: true
    });

  } catch (error) {
    console.error('[TEST TICK] Error:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});