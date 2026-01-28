import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  console.log('\n🔍 MANUAL TICK TEST STARTED\n');
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('✅ User authenticated:', user.email);
    
    // Step 1: Check jobs exist
    const jobs = await base44.asServiceRole.entities.ImportJob.filter({});
    console.log(`📋 Found ${jobs.length} total jobs`);
    
    const pending = jobs.filter(j => j.status === 'pending');
    const active = jobs.filter(j => j.status === 'in_progress');
    const completed = jobs.filter(j => j.status === 'completed');
    
    console.log(`   - ${pending.length} pending`);
    console.log(`   - ${active.length} active`);
    console.log(`   - ${completed.length} completed`);
    
    if (pending.length === 0) {
      return Response.json({
        success: false,
        error: 'No pending jobs found',
        jobCounts: { pending: pending.length, active: active.length, completed: completed.length }
      });
    }
    
    // Step 2: Get next pending job
    const nextJob = pending[0];
    console.log(`\n📥 Next job: ${nextJob.translation_id}`);
    console.log(`   Status: ${nextJob.status}`);
    console.log(`   Retries: ${nextJob.retries}`);
    
    // Step 3: Test API fetch
    const testUrl = `https://bible-api.com/John+1?translation=${nextJob.translation_id.toLowerCase()}`;
    console.log(`\n🌐 Testing API: ${testUrl}`);
    
    const apiResponse = await fetch(testUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'SermonSmith/2.0',
        'Accept': 'application/json'
      }
    });
    
    console.log(`   API Status: ${apiResponse.status}`);
    
    if (!apiResponse.ok) {
      return Response.json({
        success: false,
        error: `API returned ${apiResponse.status}`,
        translation: nextJob.translation_id
      });
    }
    
    const apiData = await apiResponse.json();
    const verseCount = apiData.verses?.length || 0;
    console.log(`   ✅ API returned ${verseCount} verses`);
    
    // Step 4: Test database write
    console.log(`\n💾 Testing database write...`);
    
    if (verseCount > 0) {
      const testVerse = apiData.verses[0];
      const record = {
        translation_id: nextJob.translation_id,
        book_name: 'John',
        chapter: 1,
        verse: testVerse.verse,
        text: testVerse.text,
        source_hash: `${nextJob.translation_id}-John-1-${testVerse.verse}-test-${Date.now()}`
      };
      
      const created = await base44.asServiceRole.entities.Verse.create(record);
      console.log(`   ✅ Verse created with ID: ${created.id}`);
      
      // Clean up
      await base44.asServiceRole.entities.Verse.delete(created.id);
      console.log(`   ✅ Test verse deleted`);
    }
    
    console.log('\n✅ ALL TESTS PASSED - System is ready!\n');
    
    return Response.json({
      success: true,
      message: 'All systems operational',
      nextTranslation: nextJob.translation_id,
      apiTest: 'OK',
      databaseTest: 'OK',
      readyToImport: true
    });
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.error('Stack:', error.stack);
    
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});