import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[BATCH IMPORT] Starting batch import of all translations...');

    // Get all enabled translations
    const translations = await base44.asServiceRole.entities.Translation.filter({ enabled: true });
    console.log(`[BATCH IMPORT] Found ${translations.length} translations to import`);

    // Start all imports in parallel (non-blocking)
    const importPromises = translations.map(trans => {
      return base44.functions.invoke('importSingleTranslation', { 
        translationId: trans.id 
      }).catch(error => {
        console.error(`[BATCH IMPORT] Failed to start ${trans.id}:`, error.message);
        return { error: error.message, translationId: trans.id };
      });
    });

    // Don't wait - return immediately
    Promise.all(importPromises).then(results => {
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => r.error).length;
      console.log(`[BATCH IMPORT] ✅ Complete: ${successful} succeeded, ${failed} failed`);
    });

    return Response.json({
      success: true,
      message: `Started import for ${translations.length} translations`,
      translations: translations.map(t => t.id),
      note: 'Imports running in background. Check status in a few minutes.'
    });

  } catch (error) {
    console.error('[BATCH IMPORT] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});