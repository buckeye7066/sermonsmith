import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * FIND ALL FUNCTIONS
 * 
 * Returns a complete registry of all backend functions in the app.
 * Since we cannot scan filesystem at runtime in Deno Deploy,
 * we maintain a hardcoded registry that MUST be kept up-to-date.
 */

const FUNCTION_REGISTRY = [
  // Core Bible Functions
  { id: 'biblePassage', filePath: 'functions/biblePassage.js' },
  { id: 'getPassageMultiSource', filePath: 'functions/getPassageMultiSource.js' },
  { id: 'listAvailableTranslations', filePath: 'functions/listAvailableTranslations.js' },
  
  // Export Functions
  { id: 'exportToPDF', filePath: 'functions/exportToPDF.js' },
  { id: 'exportToPPTX', filePath: 'functions/exportToPPTX.js' },
  
  // Stripe/Payment Functions
  { id: 'createCheckoutSession', filePath: 'functions/createCheckoutSession.js' },
  { id: 'stripe-webhook', filePath: 'functions/stripe-webhook.js' },
  
  // User/Admin Functions
  { id: 'listUsers', filePath: 'functions/listUsers.js' },
  { id: 'grantMePremium', filePath: 'functions/grantMePremium.js' },
  { id: 'grantFamilyAccess', filePath: 'functions/grantFamilyAccess.js' },
  
  // Content Functions
  { id: 'createShareableLink', filePath: 'functions/createShareableLink.js' },
  { id: 'promptSuggestions', filePath: 'functions/promptSuggestions.js' },
  
  // System Functions
  { id: 'findAllFunctions', filePath: 'functions/findAllFunctions.js' },
  { id: 'testAllFunctions', filePath: 'functions/testAllFunctions.js' },
  { id: 'getCodeSnippet', filePath: 'functions/getCodeSnippet.js' }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ ok: false, error: 'Authentication required', data: null });
    }
    
    if (user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Admin access required', data: null });
    }

    // Build the function list with required metadata
    const functions = FUNCTION_REGISTRY.map(fn => ({
      id: fn.id,
      runId: fn.id,
      filePath: fn.filePath,
      required: true
    }));

    if (functions.length === 0) {
      return Response.json({
        ok: false,
        error: 'No functions found in registry',
        data: null
      });
    }

    return Response.json({
      ok: true,
      error: null,
      data: {
        functions,
        total: functions.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('[findAllFunctions] CRITICAL:', err);
    return Response.json({
      ok: false,
      error: err?.message ?? 'Unknown error',
      data: null
    });
  }
});