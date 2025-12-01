import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * GET FUNCTION DETAILS
 * 
 * Returns full source code and metadata for a specific function.
 * Uses a static registry since Base44/Deno Deploy cannot scan filesystem.
 * 
 * PORTABLE: Works in any Base44 app with the functionRegistry.js file.
 */

// Static registry (must match components/functionRegistry.js)
const KNOWN_FUNCTIONS = [
  { functionId: "biblePassage", filePath: "functions/biblePassage.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "bible" },
  { functionId: "getPassageMultiSource", filePath: "functions/getPassageMultiSource.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "bible" },
  { functionId: "listAvailableTranslations", filePath: "functions/listAvailableTranslations.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "bible" },
  { functionId: "exportToPDF", filePath: "functions/exportToPDF.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "export" },
  { functionId: "exportToPPTX", filePath: "functions/exportToPPTX.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "export" },
  { functionId: "createCheckoutSession", filePath: "functions/createCheckoutSession.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "payment" },
  { functionId: "stripe-webhook", filePath: "functions/stripe-webhook.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "payment" },
  { functionId: "listUsers", filePath: "functions/listUsers.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "admin" },
  { functionId: "grantMePremium", filePath: "functions/grantMePremium.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "admin" },
  { functionId: "grantFamilyAccess", filePath: "functions/grantFamilyAccess.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "admin" },
  { functionId: "createShareableLink", filePath: "functions/createShareableLink.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "content" },
  { functionId: "promptSuggestions", filePath: "functions/promptSuggestions.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "content" },
  { functionId: "importBibleData", filePath: "functions/importBibleData.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "import" },
  { functionId: "importFullBible", filePath: "functions/importFullBible.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "import" },
  { functionId: "importFromScriptureAPI", filePath: "functions/importFromScriptureAPI.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "import" },
  { functionId: "findAllFunctions", filePath: "functions/findAllFunctions.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "system" },
  { functionId: "testAllFunctions", filePath: "functions/testAllFunctions.js", exportType: "default", namedExports: [], dependencyPaths: ["functions/findAllFunctions.js", "functions/getCodeSnippet.js"], category: "system" },
  { functionId: "getCodeSnippet", filePath: "functions/getCodeSnippet.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "system" },
  { functionId: "getFunctionDetails", filePath: "functions/getFunctionDetails.js", exportType: "default", namedExports: [], dependencyPaths: [], category: "system" }
];

// Embedded source code cache (populated at build time or manually)
// This is necessary because Deno Deploy cannot read arbitrary files at runtime
const SOURCE_CACHE = {};

async function safeRun(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user) {
    return { ok: false, error: 'Authentication required', data: null };
  }
  
  if (user.role !== 'admin') {
    return { ok: false, error: 'Admin access required', data: null };
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return { ok: false, error: 'Invalid JSON body', data: null };
  }

  const { functionId, _selfTest } = body;

  if (_selfTest) {
    return { 
      ok: true, 
      selfTest: true, 
      message: 'getFunctionDetails is operational',
      data: { totalFunctions: KNOWN_FUNCTIONS.length }
    };
  }

  // If no functionId, return list of all functions
  if (!functionId) {
    return {
      ok: true,
      error: null,
      data: {
        functions: KNOWN_FUNCTIONS.map(f => ({
          functionId: f.functionId,
          filePath: f.filePath,
          exportType: f.exportType,
          category: f.category,
          dependencyCount: f.dependencyPaths.length
        })),
        total: KNOWN_FUNCTIONS.length
      }
    };
  }

  // Find the function in registry
  const funcEntry = KNOWN_FUNCTIONS.find(f => f.functionId === functionId);
  
  if (!funcEntry) {
    return { 
      ok: false, 
      error: `Function "${functionId}" not found in registry`,
      data: { 
        availableFunctions: KNOWN_FUNCTIONS.map(f => f.functionId)
      }
    };
  }

  // Try to get source code from cache
  let sourceCode = SOURCE_CACHE[funcEntry.filePath] || null;
  
  // If not in cache, provide a helpful message
  if (!sourceCode) {
    sourceCode = `// Source code for ${funcEntry.filePath}\n// Not available in runtime cache.\n// \n// To view source code:\n// 1. Open the Base44 dashboard\n// 2. Navigate to Code > Functions\n// 3. Select ${funcEntry.functionId}\n//\n// Or use the AI assistant to read the file directly.`;
  }

  // Load dependency source codes
  const dependencies = [];
  for (const depPath of funcEntry.dependencyPaths) {
    const depCode = SOURCE_CACHE[depPath] || `// ${depPath}\n// Source not available in cache`;
    dependencies.push({
      filePath: depPath,
      code: depCode
    });
  }

  return {
    ok: true,
    error: null,
    data: {
      functionId: funcEntry.functionId,
      filePath: funcEntry.filePath,
      exportType: funcEntry.exportType,
      namedExports: funcEntry.namedExports,
      category: funcEntry.category,
      dependencies,
      sourceCode,
      // Safe JSON serialization
      _serialized: true
    }
  };
}

Deno.serve(async (req) => {
  try {
    const result = await safeRun(req);
    return Response.json(result);
  } catch (err) {
    console.error('[getFunctionDetails] CRITICAL:', err);
    return Response.json({
      ok: false,
      error: err?.message ?? 'Unknown error',
      data: null
    });
  }
});