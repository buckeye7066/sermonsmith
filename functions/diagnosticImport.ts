import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  console.log('\n' + '='.repeat(80));
  console.log('[DIAGNOSTIC] Starting comprehensive import diagnostic');
  console.log('='.repeat(80));
  
  try {
    // Step 1: Verify authentication
    console.log('\n[STEP 1] Verifying authentication...');
    const user = await base44.auth.me();
    console.log('✅ User authenticated:', user.email);
    
    // Step 2: Check enabled translations
    console.log('\n[STEP 2] Checking enabled translations...');
    const translations = await base44.asServiceRole.entities.Translation.filter({ enabled: true });
    console.log(`✅ Found ${translations.length} enabled translations:`, translations.map(t => t.id).join(', '));
    
    if (translations.length === 0) {
      return Response.json({
        success: false,
        error: 'No enabled translations found',
        fix: 'Enable at least one translation in the Translation entity'
      });
    }
    
    // Step 3: Check existing verses
    console.log('\n[STEP 3] Checking existing verses...');
    const existingVerses = await base44.asServiceRole.entities.Verse.filter({}, 'id', 10);
    console.log(`📊 Found ${existingVerses.length} existing verses in database`);
    
    // Step 4: Test API connectivity
    console.log('\n[STEP 4] Testing bible-api.com connectivity...');
    const testUrl = 'https://bible-api.com/John+3:16?translation=kjv';
    const testResponse = await fetch(testUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'SermonSmith/2.0',
        'Accept': 'application/json'
      }
    });
    
    if (!testResponse.ok) {
      console.log('❌ API test failed:', testResponse.status);
      return Response.json({
        success: false,
        error: 'Bible API unreachable',
        statusCode: testResponse.status
      });
    }
    
    const testData = await testResponse.json();
    console.log('✅ API connectivity OK:', testData.reference);
    
    // Step 5: Test database write
    console.log('\n[STEP 5] Testing database write...');
    const testVerse = await base44.asServiceRole.entities.Verse.create({
      translation_id: 'TEST',
      book_name: 'TestBook',
      chapter: 1,
      verse: 1,
      text: 'Test verse created at ' + new Date().toISOString(),
      source_hash: 'test-' + Date.now()
    });
    console.log('✅ Write test successful, verse ID:', testVerse.id);
    
    // Clean up test verse
    await base44.asServiceRole.entities.Verse.delete(testVerse.id);
    console.log('✅ Test verse deleted');
    
    // Step 6: Try importing ONE chapter as a test
    console.log('\n[STEP 6] Testing import of Genesis 1 (KJV)...');
    const testImportUrl = 'https://bible-api.com/Genesis+1?translation=kjv';
    const importResponse = await fetch(testImportUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'SermonSmith/2.0',
        'Accept': 'application/json'
      }
    });
    
    if (!importResponse.ok) {
      console.log('❌ Import test failed:', importResponse.status);
      return Response.json({
        success: false,
        error: 'Failed to fetch test chapter',
        statusCode: importResponse.status
      });
    }
    
    const chapterData = await importResponse.json();
    console.log(`✅ Fetched ${chapterData.verses?.length || 0} verses from Genesis 1`);
    
    // Try to save these verses
    if (chapterData.verses && chapterData.verses.length > 0) {
      const records = chapterData.verses.map(v => ({
        translation_id: 'KJV',
        book_name: 'Genesis',
        chapter: 1,
        verse: v.verse,
        text: v.text,
        source_hash: `KJV-Genesis-1-${v.verse}`
      }));
      
      // Check if already exists
      const existing = await base44.asServiceRole.entities.Verse.filter({
        translation_id: 'KJV',
        book_name: 'Genesis',
        chapter: 1
      }, 'id', 1);
      
      if (existing.length > 0) {
        console.log('⚠️ Genesis 1 already exists in database');
      } else {
        await base44.asServiceRole.entities.Verse.bulkCreate(records);
        console.log(`✅ Successfully imported ${records.length} verses from Genesis 1`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('[DIAGNOSTIC] All checks passed ✅');
    console.log('='.repeat(80));
    
    return Response.json({
      success: true,
      message: 'All diagnostic checks passed - system ready for import',
      details: {
        user: user.email,
        enabledTranslations: translations.length,
        existingVerses: existingVerses.length,
        apiConnectivity: 'OK',
        databaseWrite: 'OK',
        testImport: 'OK'
      }
    });
    
  } catch (error) {
    console.error('\n❌ DIAGNOSTIC FAILED:', error);
    console.error('Stack:', error.stack);
    
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});