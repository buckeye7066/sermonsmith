import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    console.log('[DIAG] Step 1: Auth check');
    const user = await base44.auth.me();
    console.log('[DIAG] ✅ User:', user.email);
    
    console.log('[DIAG] Step 2: Checking ImportJob entities');
    const jobs = await base44.asServiceRole.entities.ImportJob.filter({}, '-updated_date', 5);
    console.log(`[DIAG] Found ${jobs.length} jobs`);
    
    if (jobs.length === 0) {
      return Response.json({
        error: 'No jobs found',
        fix: 'Run "Initialize Import Jobs" first'
      });
    }
    
    console.log('[DIAG] First job:', JSON.stringify(jobs[0], null, 2));
    
    const pending = jobs.filter(j => j.status === 'pending');
    console.log(`[DIAG] ${pending.length} pending jobs`);
    
    if (pending.length > 0) {
      const next = pending[0];
      console.log(`[DIAG] Next job: ${next.translation_id}`);
      
      // Test if translation_id is valid
      console.log('[DIAG] Step 3: Testing API for', next.translation_id);
      const testUrl = `https://bible-api.com/John+1?translation=${next.translation_id.toLowerCase()}`;
      console.log('[DIAG] URL:', testUrl);
      
      try {
        const response = await fetch(testUrl, {
          signal: AbortSignal.timeout(10000),
          headers: {
            'User-Agent': 'SermonSmith/2.0',
            'Accept': 'application/json'
          }
        });
        
        console.log(`[DIAG] API Status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`[DIAG] ✅ Got ${data.verses?.length || 0} verses`);
          
          return Response.json({
            success: true,
            message: 'System ready',
            nextJob: next.translation_id,
            pendingCount: pending.length,
            apiTest: 'OK'
          });
        } else {
          return Response.json({
            error: `API returned ${response.status}`,
            translation: next.translation_id,
            suggestion: 'Translation code might be invalid'
          });
        }
        
      } catch (fetchError) {
        console.error('[DIAG] API Error:', fetchError);
        return Response.json({
          error: 'API fetch failed',
          details: fetchError.message
        });
      }
    }
    
    return Response.json({
      message: 'No pending jobs',
      completed: jobs.filter(j => j.status === 'completed').length,
      total: jobs.length
    });
    
  } catch (error) {
    console.error('[DIAG] Error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});