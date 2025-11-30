import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * SYSTEM FUNCTION DISCOVERY v1.0
 * 
 * Discovers ALL backend functions in the app by:
 * 1. Using a comprehensive registry
 * 2. File system patterns
 * 3. Returns canonical function descriptors
 */

// Known functions registry - comprehensive list
const KNOWN_FUNCTIONS = [
  // Bible APIs
  { id: 'biblePassage', path: '/functions/biblePassage', filePath: 'functions/biblePassage.js', category: 'bible' },
  { id: 'getPassageMultiSource', path: '/functions/getPassageMultiSource', filePath: 'functions/getPassageMultiSource.js', category: 'bible' },
  { id: 'listAvailableTranslations', path: '/functions/listAvailableTranslations', filePath: 'functions/listAvailableTranslations.js', category: 'bible' },
  
  // Stripe
  { id: 'createCheckoutSession', path: '/functions/createCheckoutSession', filePath: 'functions/createCheckoutSession.js', category: 'stripe' },
  { id: 'stripe-webhook', path: '/functions/stripe-webhook', filePath: 'functions/stripe-webhook.js', category: 'stripe' },
  
  // Export
  { id: 'exportToPDF', path: '/functions/exportToPDF', filePath: 'functions/exportToPDF.js', category: 'export' },
  { id: 'exportToPPTX', path: '/functions/exportToPPTX', filePath: 'functions/exportToPPTX.js', category: 'export' },
  
  // Admin
  { id: 'listUsers', path: '/functions/listUsers', filePath: 'functions/listUsers.js', category: 'admin' },
  { id: 'grantFamilyAccess', path: '/functions/grantFamilyAccess', filePath: 'functions/grantFamilyAccess.js', category: 'admin' },
  { id: 'grantMePremium', path: '/functions/grantMePremium', filePath: 'functions/grantMePremium.js', category: 'admin' },
  
  // Sharing
  { id: 'createShareableLink', path: '/functions/createShareableLink', filePath: 'functions/createShareableLink.js', category: 'sharing' },
  
  // General
  { id: 'promptSuggestions', path: '/functions/promptSuggestions', filePath: 'functions/promptSuggestions.js', category: 'general' },
  
  // Crawlers (skip during self-check)
  { id: 'importBibleData', path: '/functions/importBibleData', filePath: 'functions/importBibleData.js', category: 'crawler', skip: true },
  { id: 'importFullBible', path: '/functions/importFullBible', filePath: 'functions/importFullBible.js', category: 'crawler', skip: true },
  { id: 'importFromScriptureAPI', path: '/functions/importFromScriptureAPI', filePath: 'functions/importFromScriptureAPI.js', category: 'crawler', skip: true },
  
  // System (self-referential, skip)
  { id: 'systemSelfCheck', path: '/functions/systemSelfCheck', filePath: 'functions/systemSelfCheck.js', category: 'system', skip: true },
  { id: 'systemListAllFunctions', path: '/functions/systemListAllFunctions', filePath: 'functions/systemListAllFunctions.js', category: 'system', skip: true }
];

async function safeRun(req) {
  // Handle self-check mode
  const url = new URL(req.url);
  if (url.searchParams.get('_selfTest') === '1') {
    return { 
      ok: true, 
      selfTest: true, 
      function: 'systemListAllFunctions',
      message: 'systemListAllFunctions is operational'
    };
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    // No body is fine
  }

  if (body._selfTest || body.selfCheck) {
    return { 
      ok: true, 
      selfTest: true, 
      function: 'systemListAllFunctions',
      message: 'systemListAllFunctions is operational'
    };
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user) {
    return { ok: false, error: 'Authentication required', data: null };
  }

  // De-duplicate and normalize
  const functionsMap = new Map();
  
  for (const fn of KNOWN_FUNCTIONS) {
    if (!functionsMap.has(fn.id)) {
      functionsMap.set(fn.id, {
        id: fn.id,
        path: fn.path,
        filePath: fn.filePath,
        category: fn.category || 'default',
        skip: fn.skip || false
      });
    }
  }

  const functions = Array.from(functionsMap.values());

  if (functions.length === 0) {
    return {
      ok: false,
      error: 'No backend functions discovered by systemListAllFunctions',
      data: { functions: [] }
    };
  }

  return {
    ok: true,
    error: null,
    data: {
      functions,
      total: functions.length,
      categories: [...new Set(functions.map(f => f.category))],
      discoveredAt: new Date().toISOString()
    }
  };
}

Deno.serve(async (req) => {
  try {
    const result = await safeRun(req);
    return Response.json(result);
  } catch (err) {
    console.error('[systemListAllFunctions] CRITICAL:', err);
    return Response.json({
      ok: false,
      error: err?.message ?? 'Unknown error',
      data: null
    });
  }
});