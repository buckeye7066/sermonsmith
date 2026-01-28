import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  console.log('[TEST SEED] Function invoked');
  
  try {
    const user = await base44.auth.me();
    console.log('[TEST SEED] User:', user?.email);
    
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Test 1: Can we read from Translation entity?
    let translations = [];
    try {
      translations = await base44.asServiceRole.entities.Translation.filter({}, 'id', 5);
      console.log('[TEST SEED] Translations found:', translations.length);
    } catch (e) {
      console.error('[TEST SEED] Translation read error:', e.message);
    }

    // Test 2: Can we read existing verses?
    let existingVerses = [];
    try {
      existingVerses = await base44.asServiceRole.entities.Verse.filter({}, 'id', 5);
      console.log('[TEST SEED] Existing verses:', existingVerses.length);
    } catch (e) {
      console.error('[TEST SEED] Verse read error:', e.message);
    }

    // Test 3: Can we create a test verse?
    let canWrite = false;
    let writeError = null;
    try {
      const testVerse = await base44.asServiceRole.entities.Verse.create({
        translation_id: 'TEST',
        book_name: 'TestBook',
        chapter: 1,
        verse: 1,
        text: 'This is a test verse created at ' + new Date().toISOString(),
        source_hash: 'test-' + Date.now()
      });
      
      console.log('[TEST SEED] Test verse created:', testVerse.id);
      
      // Clean up
      await base44.asServiceRole.entities.Verse.delete(testVerse.id);
      console.log('[TEST SEED] Test verse deleted');
      
      canWrite = true;
    } catch (e) {
      console.error('[TEST SEED] Write error:', e.message);
      writeError = e.message;
    }

    // Test 4: Can we fetch from bible-api.com?
    let apiFetch = false;
    let apiError = null;
    try {
      const response = await fetch('https://bible-api.com/John+3:16?translation=kjv', {
        headers: {
          'User-Agent': 'SermonSmith/2.0',
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[TEST SEED] API fetch success:', data.reference);
        apiFetch = true;
      } else {
        apiError = `API returned ${response.status}`;
      }
    } catch (e) {
      console.error('[TEST SEED] API fetch error:', e.message);
      apiError = e.message;
    }

    return Response.json({
      success: true,
      tests: {
        authentication: { passed: true, user: user.email },
        read_translations: { passed: translations.length > 0, count: translations.length },
        read_verses: { passed: true, count: existingVerses.length },
        write_verse: { passed: canWrite, error: writeError },
        api_fetch: { passed: apiFetch, error: apiError }
      },
      message: 'All tests completed',
      ready_to_seed: canWrite && apiFetch
    });

  } catch (error) {
    console.error('[TEST SEED] Fatal error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});