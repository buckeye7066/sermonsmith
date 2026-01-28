import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[HEALTH CHECK] Checking worker health...');

    // Get all jobs
    const jobs = await base44.asServiceRole.entities.ImportJob.filter({}, '-updated_date');
    
    // Check for active jobs
    const activeJobs = jobs.filter(j => j.status === 'in_progress' || j.status === 'retrying');
    
    // Check for stalled jobs (no heartbeat in last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString();
    const stalledJobs = activeJobs.filter(j => !j.last_heartbeat || j.last_heartbeat < fiveMinutesAgo);
    
    // Get recent verses to see if data is actually being written
    const recentVerses = await base44.asServiceRole.entities.Verse.filter({}, '-created_date', 5);
    
    const health = {
      timestamp: new Date().toISOString(),
      total_jobs: jobs.length,
      completed: jobs.filter(j => j.status === 'completed').length,
      active: activeJobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      stalled: stalledJobs.length,
      recent_verses_written: recentVerses.length,
      latest_verse_time: recentVerses[0]?.created_date || null,
      active_job_details: activeJobs.map(j => ({
        translation: j.translation_id,
        last_heartbeat: j.last_heartbeat,
        current_book: j.progress?.current_book,
        current_chapter: j.progress?.current_chapter,
        chapters_imported: j.progress?.total_chapters_imported || 0
      }))
    };

    console.log('[HEALTH CHECK] Result:', JSON.stringify(health, null, 2));

    return Response.json(health);

  } catch (error) {
    console.error('[HEALTH CHECK] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});