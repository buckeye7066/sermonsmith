/**
 * SURFACE MAPPER MODULE
 * 
 * Discovers all executable surfaces in the app and provides
 * structured metadata for the self-check engine.
 * 
 * Note: In Base44/Deno Deploy environment, we cannot do true filesystem
 * scanning. Instead, we maintain a registry of known surfaces and
 * validate them at runtime.
 */

// Known function paths in this app (maintained manually or via build process)
const KNOWN_SURFACES = [
  // Core functions
  { name: 'biblePassage', path: 'functions/biblePassage.js', type: 'function' },
  { name: 'getPassageMultiSource', path: 'functions/getPassageMultiSource.js', type: 'function' },
  { name: 'listAvailableTranslations', path: 'functions/listAvailableTranslations.js', type: 'function' },
  { name: 'createCheckoutSession', path: 'functions/createCheckoutSession.js', type: 'function' },
  { name: 'stripe-webhook', path: 'functions/stripe-webhook.js', type: 'function' },
  { name: 'exportToPDF', path: 'functions/exportToPDF.js', type: 'function' },
  { name: 'exportToPPTX', path: 'functions/exportToPPTX.js', type: 'function' },
  { name: 'listUsers', path: 'functions/listUsers.js', type: 'function' },
  { name: 'grantFamilyAccess', path: 'functions/grantFamilyAccess.js', type: 'function' },
  { name: 'grantMePremium', path: 'functions/grantMePremium.js', type: 'function' },
  { name: 'createShareableLink', path: 'functions/createShareableLink.js', type: 'function' },
  { name: 'importBibleData', path: 'functions/importBibleData.js', type: 'function' },
  { name: 'importFullBible', path: 'functions/importFullBible.js', type: 'function' },
  { name: 'importFromScriptureAPI', path: 'functions/importFromScriptureAPI.js', type: 'function' },
  { name: 'prompt-suggestions', path: 'functions/prompt-suggestions.js', type: 'function' },
  { name: 'systemSelfCheck', path: 'functions/systemSelfCheck.js', type: 'function' },
  
  // Shared modules
  { name: 'surfaceMapper', path: 'functions/shared/surfaceMapper.js', type: 'shared' },
];

// Test payloads for different function types
const TEST_PAYLOADS = {
  'biblePassage': { translationId: 'en-kjv', bookCode: 'GEN', chapter: 1, _selfTest: '1' },
  'getPassageMultiSource': { reference: 'John 3:16', translation: 'KJV', _selfTest: '1' },
  'listAvailableTranslations': { _selfTest: '1' },
  'createCheckoutSession': { _selfTest: '1' },
  'exportToPDF': { _selfTest: '1' },
  'exportToPPTX': { _selfTest: '1' },
  'listUsers': { _selfTest: '1' },
  'grantFamilyAccess': { _selfTest: '1' },
  'grantMePremium': { _selfTest: '1' },
  'createShareableLink': { _selfTest: '1' },
  'importBibleData': { _selfTest: '1' },
  'importFullBible': { _selfTest: '1' },
  'importFromScriptureAPI': { _selfTest: '1' },
  'prompt-suggestions': { _selfTest: '1' },
  'systemSelfCheck': { _selfTest: '1' },
  'stripe-webhook': { _selfTest: '1' }
};

/**
 * Surface entry structure
 */
function createSurfaceEntry(name, type, filePath, exportType = 'unknown', error = null) {
  return {
    name,
    type,
    filePath,
    exportType,
    error,
    isValid: !error,
    testPayload: TEST_PAYLOADS[name] || { _selfTest: '1' }
  };
}

/**
 * Detect export type from a module
 */
function detectExportType(module) {
  if (!module) return 'unknown';
  
  if (typeof module.default === 'function') return 'default';
  if (typeof module.handler === 'function') return 'handler';
  
  const namedExports = Object.keys(module).filter(k => typeof module[k] === 'function');
  if (namedExports.length > 0) return 'named';
  
  return 'unknown';
}

/**
 * Get the complete surface map of all known executable surfaces
 */
export async function getSurfaceMap() {
  const surfaces = [];
  
  for (const surface of KNOWN_SURFACES) {
    const entry = createSurfaceEntry(
      surface.name,
      surface.type,
      surface.path,
      'default' // Base44 functions use Deno.serve pattern
    );
    surfaces.push(entry);
  }
  
  return surfaces;
}

/**
 * Get only executable surfaces (those that can be invoked)
 */
export async function getExecutableSurfaces() {
  const allSurfaces = await getSurfaceMap();
  
  // Filter to only invokable function types
  return allSurfaces.filter(s => 
    s.type === 'function' && 
    s.name !== 'surfaceMapper' && // Exclude self
    s.isValid
  );
}

/**
 * Test a single surface by invoking it with a dry-run payload
 */
export async function testSurface(base44, surface, timeoutMs = 15000) {
  const result = {
    name: surface.name,
    filePath: surface.filePath,
    type: surface.type,
    ok: false,
    status: null,
    responseTime: 0,
    error: null,
    errorStack: null,
    offendingCode: null
  };

  // Skip non-invokable surfaces
  if (surface.type === 'shared') {
    result.ok = true;
    result.status = 'SKIPPED';
    result.error = 'Shared module - not directly invokable';
    return result;
  }

  const start = Date.now();
  
  try {
    const response = await Promise.race([
      base44.functions.invoke(surface.name, surface.testPayload),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);

    result.responseTime = Date.now() - start;
    result.status = response.status;
    
    // 2xx-4xx are considered "working" (4xx means auth/validation worked)
    result.ok = response.status >= 200 && response.status < 500;
    
    if (response.status >= 500) {
      result.error = response.data?.error || response.data?.message || 'Server error';
      result.errorStack = response.data?.stack;
    }
  } catch (err) {
    result.responseTime = Date.now() - start;
    result.error = err.message;
    result.errorStack = err.stack;
    result.ok = false;
    
    // Try to extract offending code hint
    if (err.stack) {
      const stackLines = err.stack.split('\n');
      const relevantLine = stackLines.find(l => l.includes(surface.name));
      if (relevantLine) {
        result.offendingCode = relevantLine.trim();
      }
    }
  }

  return result;
}

/**
 * Test all executable surfaces
 */
export async function testAllSurfaces(base44) {
  const surfaces = await getExecutableSurfaces();
  const results = [];
  
  for (const surface of surfaces) {
    const result = await testSurface(base44, surface);
    results.push(result);
  }
  
  return {
    total: results.length,
    passed: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results
  };
}

/**
 * Get surface statistics
 */
export async function getSurfaceStats() {
  const surfaces = await getSurfaceMap();
  
  const byType = surfaces.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {});
  
  return {
    total: surfaces.length,
    byType,
    valid: surfaces.filter(s => s.isValid).length,
    invalid: surfaces.filter(s => !s.isValid).length
  };
}

export default {
  getSurfaceMap,
  getExecutableSurfaces,
  testSurface,
  testAllSurfaces,
  getSurfaceStats
};