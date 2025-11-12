import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[WORKER START] Import worker initialization requested by:', user.email);

    // Get enabled translations
    const translations = await base44.asServiceRole.entities.Translation.filter({ enabled: true });
    
    if (translations.length === 0) {
      return Response.json({ error: 'No enabled translations found' }, { status: 400 });
    }

    console.log(`[WORKER START] Found ${translations.length} enabled translations`);

    // Check for existing jobs
    const existingJobs = await base44.asServiceRole.entities.ImportJob.filter({});
    
    // Create jobs for any missing translations
    // FIX: Use translation.data.id (the code like "BBE") not translation.id (entity ID)
    const existingTranslationIds = new Set(existingJobs.map(j => j.translation_id));
    const newJobs = [];
    
    for (const trans of translations) {
      // CRITICAL FIX: Use trans.data.id (the translation code) not trans.id
      const translationCode = trans.data.id; // e.g., "BBE", "KJV", "ESV"
      
      if (!existingTranslationIds.has(translationCode)) {
        newJobs.push({
          translation_id: translationCode,  // This is now "BBE", "ESV", etc.
          status: 'pending',
          retries: 0,
          progress: {
            total_chapters_imported: 0,
            total_verses_imported: 0,
            books_completed: []
          },
          error_log: []
        });
      }
    }

    if (newJobs.length > 0) {
      await base44.asServiceRole.entities.ImportJob.bulkCreate(newJobs);
      console.log(`[WORKER START] Created ${newJobs.length} new import jobs`);
    }

    // Reset any stalled jobs (in_progress for more than 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 600000).toISOString();
    const stalledJobs = existingJobs.filter(j => 
      j.status === 'in_progress' && 
      (!j.last_heartbeat || j.last_heartbeat < tenMinutesAgo)
    );

    for (const job of stalledJobs) {
      await base44.asServiceRole.entities.ImportJob.update(job.id, {
        status: 'retrying',
        retries: job.retries + 1
      });
      console.log(`[WORKER START] Reset stalled job: ${job.translation_id}`);
    }

    return Response.json({
      success: true,
      message: 'Import jobs initialized',
      translations: translations.length,
      newJobs: newJobs.length,
      stalledReset: stalledJobs.length
    });

  } catch (error) {
    console.error('[WORKER START] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});