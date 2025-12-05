import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * GET FUNCTION DETAILS
 * 
 * Returns full source code and metadata for a specific function.
 * Fetches source code from GitHub repository.
 */

// GitHub configuration
const GITHUB_REPO = "buckeye7066/Bible-app";
const GITHUB_BRANCH = "main";

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

// Fetch file content from GitHub
async function fetchFromGitHub(filePath) {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) {
    return { ok: false, error: "GITHUB_TOKEN not configured" };
  }

  const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github.v3.raw",
        "User-Agent": "Base44-FunctionReviewer"
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { ok: false, error: `File not found: ${filePath}` };
      }
      return { ok: false, error: `GitHub API error: ${response.status}` };
    }

    const code = await response.text();
    return { ok: true, code };
  } catch (err) {
    return { ok: false, error: `Fetch error: ${err.message}` };
  }
}

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
    const token = Deno.env.get("GITHUB_TOKEN");
    return { 
      ok: true, 
      selfTest: true, 
      message: 'getFunctionDetails is operational',
      data: { 
        totalFunctions: KNOWN_FUNCTIONS.length,
        githubConfigured: !!token,
        repo: GITHUB_REPO
      }
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
        total: KNOWN_FUNCTIONS.length,
        repo: GITHUB_REPO
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

  // Fetch source code from GitHub
  const sourceResult = await fetchFromGitHub(funcEntry.filePath);
  let sourceCode = sourceResult.ok 
    ? sourceResult.code 
    : `// Error loading source code:\n// ${sourceResult.error}\n//\n// File: ${funcEntry.filePath}`;

  // Load dependency source codes from GitHub
  const dependencies = [];
  for (const depPath of funcEntry.dependencyPaths) {
    const depResult = await fetchFromGitHub(depPath);
    dependencies.push({
      filePath: depPath,
      code: depResult.ok ? depResult.code : `// Error: ${depResult.error}`
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
      repo: GITHUB_REPO,
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