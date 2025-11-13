import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[getWorkerStatus] Fetching worker status...');

    // Get all worker status records
    const workers = await base44.asServiceRole.entities.WorkerStatus.list('-updated_date', 10);
    
    // Format worker data
    const workerData = [];
    for (let i = 1; i <= 5; i++) {
      const worker = workers.find(w => w.worker_id === i);
      
      if (worker) {
        workerData.push({
          workerId: worker.worker_id,
          status: worker.status,
          currentTranslation: worker.current_translation || null,
          currentBook: worker.current_book || null,
          currentChapter: worker.current_chapter || null,
          translationsAssigned: worker.translations_assigned || [],
          translationsCompleted: worker.translations_completed || [],
          totalVerses: worker.total_verses_imported || 0,
          totalChapters: worker.total_chapters_imported || 0,
          startedAt: worker.started_at,
          lastUpdate: worker.last_update,
          errorMessage: worker.error_message || null,
          progressPercentage: worker.progress_percentage || 0,
          statusId: worker.id
        });
      } else {
        // Worker not started yet
        workerData.push({
          workerId: i,
          status: 'idle',
          currentTranslation: null,
          currentBook: null,
          currentChapter: null,
          translationsAssigned: [],
          translationsCompleted: [],
          totalVerses: 0,
          totalChapters: 0,
          startedAt: null,
          lastUpdate: null,
          errorMessage: null,
          progressPercentage: 0,
          statusId: null
        });
      }
    }

    // Calculate summary stats
    const activeWorkers = workerData.filter(w => w.status === 'running').length;
    const completedWorkers = workerData.filter(w => w.status === 'completed').length;
    const totalVerses = workerData.reduce((sum, w) => sum + w.totalVerses, 0);
    const allTranslations = workerData.flatMap(w => w.translationsAssigned);
    const completedTranslations = workerData.flatMap(w => w.translationsCompleted);

    return Response.json({
      success: true,
      workers: workerData,
      summary: {
        activeWorkers,
        completedWorkers,
        totalVerses,
        totalTranslations: allTranslations.length,
        completedTranslations: completedTranslations.length,
        overallProgress: allTranslations.length > 0 
          ? Math.round((completedTranslations.length / allTranslations.length) * 100)
          : 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[getWorkerStatus] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});