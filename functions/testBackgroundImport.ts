import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Simple test to verify background import can start
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  console.log('='.repeat(80));
  console.log('[TEST] Background import test started');
  console.log('[TEST] Request received at:', new Date().toISOString());
  
  try {
    const user = await base44.auth.me();
    console.log('[TEST] User authenticated:', user?.email);
    
    if (!user) {
      console.log('[TEST] ❌ No user - returning 401');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin check
    if (user.role !== 'admin') {
      console.log('[TEST] ❌ Not an admin - returning 403');
      return Response.json({ 
        error: 'Admin access required',
        user_email: user.email,
        user_role: user.role
      }, { status: 403 });
    }
    
    console.log('[TEST] ✅ Admin user:', user.email);

    const { translations } = await req.json();
    console.log('[TEST] Translations requested:', translations);
    
    if (!translations || translations.length === 0) {
      console.log('[TEST] ❌ No translations - returning 400');
      return Response.json({ error: 'No translations specified' }, { status: 400 });
    }

    console.log('[TEST] ✅ All checks passed - starting background test');

    // Start a simple background task
    testImportInBackground(base44, translations).catch(error => {
      console.error('[TEST] Background task error:', error);
    });

    console.log('[TEST] ✅ Returning success response');
    console.log('='.repeat(80));

    return Response.json({
      success: true,
      message: 'Test background import started',
      translations: translations,
      user: user.email,
      is_developer: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[TEST] ❌ Fatal error:', error);
    console.log('='.repeat(80));
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});

async function testImportInBackground(base44, translations) {
  console.log('\n' + '█'.repeat(80));
  console.log('[BACKGROUND] Test import task started');
  console.log('[BACKGROUND] Time:', new Date().toISOString());
  console.log('[BACKGROUND] Translations:', translations.join(', '));
  console.log('█'.repeat(80));

  try {
    // Test 1: Can we access the database?
    console.log('\n[BACKGROUND] TEST 1: Database Access');
    const testTranslation = await base44.asServiceRole.entities.Translation.filter({ 
      id: translations[0] 
    }, 'id', 1);
    console.log('[BACKGROUND] ✅ Database accessible, found:', testTranslation[0]?.id);

    // Test 2: Can we fetch from API?
    console.log('\n[BACKGROUND] TEST 2: API Fetch');
    try {
      const response = await fetch('https://bible-api.com/john+3:16?translation=kjv', {
        headers: { 'User-Agent': 'SermonSmith Test/1.0' }
      });
      const data = await response.json();
      console.log('[BACKGROUND] ✅ API accessible, got:', data.text?.substring(0, 50) + '...');
    } catch (apiError) {
      console.log('[BACKGROUND] ⚠️ API error:', apiError.message);
    }

    // Test 3: Can we write to database?
    console.log('\n[BACKGROUND] TEST 3: Database Write');
    const testVerse = {
      translation_id: 'TEST',
      book_name: 'TestBook',
      chapter: 1,
      verse: 1,
      text: `Test verse created at ${new Date().toISOString()}`,
      source_hash: `test-${Date.now()}`
    };
    
    await base44.asServiceRole.entities.Verse.create(testVerse);
    console.log('[BACKGROUND] ✅ Database write successful');

    // Test 4: Simulate import for first chapter only
    console.log('\n[BACKGROUND] TEST 4: Import Simulation');
    for (const translationId of translations.slice(0, 1)) { // Only first translation
      console.log(`[BACKGROUND] Simulating ${translationId}...`);
      
      const result = await testFetchChapter(base44, translationId, 'Genesis', 1);
      console.log(`[BACKGROUND] ${translationId} Genesis 1: ${result.success ? '✅' : '❌'}`);
      
      if (result.success) {
        console.log(`[BACKGROUND] Got ${result.verses?.length || 0} verses`);
      }
      
      // Only do one chapter for test
      break;
    }

    console.log('\n' + '█'.repeat(80));
    console.log('[BACKGROUND] ✅ All tests completed successfully!');
    console.log('[BACKGROUND] Background task is working properly');
    console.log('█'.repeat(80));

  } catch (error) {
    console.error('\n' + '█'.repeat(80));
    console.error('[BACKGROUND] ❌ Test failed:', error.message);
    console.error('[BACKGROUND] Stack:', error.stack);
    console.error('█'.repeat(80));
  }
}

async function testFetchChapter(base44, translationId, bookName, chapter) {
  try {
    // Check cache
    const cached = await base44.asServiceRole.entities.Verse.filter({
      translation_id: translationId,
      book_name: bookName,
      chapter: chapter
    }, 'verse', 1);

    if (cached.length > 0) {
      return { success: true, cached: true };
    }

    // Try to fetch
    const url = `https://bible-api.com/${encodeURIComponent(bookName)}+${chapter}?translation=${translationId.toLowerCase()}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SermonSmith Test/1.0' },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return { success: false, error: `API returned ${response.status}` };
    }

    const data = await response.json();
    const verses = data.verses || (data.text ? [{ verse: 1, text: data.text }] : []);

    return { 
      success: true, 
      cached: false, 
      verses: verses
    };

  } catch (error) {
    return { success: false, error: error.message };
  }
}