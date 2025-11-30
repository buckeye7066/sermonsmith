/**
 * FUNCTION MAPPER v2.0
 * 
 * Discovers all executable functions in the app.
 * In Base44/Deno Deploy, we maintain a registry since filesystem scanning isn't available.
 */

// Complete registry of all known functions in SermonSmith
const FUNCTION_REGISTRY = [
  // Core Bible functions
  { name: 'biblePassage', filePath: 'functions/biblePassage.js', kind: 'default', exported: true },
  { name: 'getPassageMultiSource', filePath: 'functions/getPassageMultiSource.js', kind: 'default', exported: true },
  { name: 'listAvailableTranslations', filePath: 'functions/listAvailableTranslations.js', kind: 'default', exported: true },
  
  // Payment functions
  { name: 'createCheckoutSession', filePath: 'functions/createCheckoutSession.js', kind: 'default', exported: true },
  { name: 'stripe-webhook', filePath: 'functions/stripe-webhook.js', kind: 'default', exported: true },
  
  // Export functions
  { name: 'exportToPDF', filePath: 'functions/exportToPDF.js', kind: 'default', exported: true },
  { name: 'exportToPPTX', filePath: 'functions/exportToPPTX.js', kind: 'default', exported: true },
  
  // Admin functions
  { name: 'listUsers', filePath: 'functions/listUsers.js', kind: 'default', exported: true },
  { name: 'grantFamilyAccess', filePath: 'functions/grantFamilyAccess.js', kind: 'default', exported: true },
  { name: 'grantMePremium', filePath: 'functions/grantMePremium.js', kind: 'default', exported: true },
  
  // Content functions
  { name: 'createShareableLink', filePath: 'functions/createShareableLink.js', kind: 'default', exported: true },
  { name: 'prompt-suggestions', filePath: 'functions/prompt-suggestions.js', kind: 'default', exported: true },
  
  // Import functions (external crawlers - skip full execution in self-test)
  { name: 'importBibleData', filePath: 'functions/importBibleData.js', kind: 'default', exported: true, isExternalCrawler: true },
  { name: 'importFullBible', filePath: 'functions/importFullBible.js', kind: 'default', exported: true, isExternalCrawler: true },
  { name: 'importFromScriptureAPI', filePath: 'functions/importFromScriptureAPI.js', kind: 'default', exported: true, isExternalCrawler: true },
  
  // Self-check (will be skipped to avoid recursion)
  { name: 'systemSelfCheck', filePath: 'functions/systemSelfCheck.js', kind: 'default', exported: true, isSelfCheck: true },
];

// Test payloads for each function
const TEST_PAYLOADS = {
  'biblePassage': { translationId: 'engKJV', bookCode: 'GEN', chapter: 1, _selfTest: true },
  'getPassageMultiSource': { reference: 'John 3:16', translation: 'KJV', _selfTest: true },
  'listAvailableTranslations': { _selfTest: true },
  'createCheckoutSession': { _selfTest: true },
  'stripe-webhook': { _selfTest: true },
  'exportToPDF': { resourceType: 'sermon', resourceId: 'test-selfcheck', _selfTest: true },
  'exportToPPTX': { resourceType: 'sermon', resourceId: 'test-selfcheck', _selfTest: true },
  'listUsers': { _selfTest: true },
  'grantFamilyAccess': { _selfTest: true },
  'grantMePremium': { _selfTest: true },
  'createShareableLink': { _selfTest: true },
  'prompt-suggestions': { _selfTest: true },
  'importBibleData': { _selfTest: true },
  'importFullBible': { _selfTest: true },
  'importFromScriptureAPI': { _selfTest: true },
};

/**
 * Get all mapped functions
 * @returns {Array<FunctionSurface>}
 */
export function mapAllFunctions() {
  return FUNCTION_REGISTRY.map(fn => ({
    ...fn,
    testPayload: TEST_PAYLOADS[fn.name] || { _selfTest: true }
  }));
}

/**
 * Get executable functions (excludes self-check and shared modules)
 */
export function getExecutableFunctions() {
  return mapAllFunctions().filter(fn => 
    !fn.isSelfCheck && 
    fn.exported && 
    fn.kind === 'default'
  );
}

/**
 * Get function statistics
 */
export function getFunctionStats() {
  const all = mapAllFunctions();
  return {
    total: all.length,
    executable: all.filter(f => !f.isSelfCheck).length,
    crawlers: all.filter(f => f.isExternalCrawler).length,
    byKind: {
      default: all.filter(f => f.kind === 'default').length,
      named: all.filter(f => f.kind === 'named').length,
      internal: all.filter(f => f.kind === 'internal').length
    }
  };
}

export default {
  mapAllFunctions,
  getExecutableFunctions,
  getFunctionStats
};