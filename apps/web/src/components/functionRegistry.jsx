/**
 * FUNCTION REGISTRY
 * 
 * Static registry of all backend functions and helper modules in this app.
 * This registry MUST be manually maintained when adding/removing functions.
 * 
 * PORTABLE: Copy this file to any SermonSmith deployment and update the entries.
 */

export const KNOWN_FUNCTIONS = [
  // === Core Bible Functions ===
  {
    functionId: "biblePassage",
    filePath: "functions/biblePassage.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "bible",
    description: "Fetches Bible passages from multiple APIs with fallback support"
  },
  {
    functionId: "getPassageMultiSource",
    filePath: "functions/getPassageMultiSource.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "bible",
    description: "Multi-source Bible passage fetcher with normalization"
  },
  {
    functionId: "listAvailableTranslations",
    filePath: "functions/listAvailableTranslations.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "bible",
    description: "Lists all available Bible translations with premium filtering"
  },

  // === Export Functions ===
  {
    functionId: "exportToPDF",
    filePath: "functions/exportToPDF.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "export",
    description: "Exports sermons and studies to PDF format"
  },
  {
    functionId: "exportToPPTX",
    filePath: "functions/exportToPPTX.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "export",
    description: "Exports sermons and studies to PowerPoint format"
  },

  // === Stripe/Payment Functions ===
  {
    functionId: "createCheckoutSession",
    filePath: "services/api/src/routes/functions.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "payment",
    description: "Creates Stripe checkout session for premium subscription"
  },
  {
    functionId: "stripe-webhook",
    filePath: "services/api/src/routes/functions.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "payment",
    description: "Handles Stripe webhook events for subscription management"
  },

  // === User/Admin Functions ===
  {
    functionId: "listUsers",
    filePath: "functions/listUsers.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "admin",
    description: "Lists all users with subscription stats (admin only)"
  },
  {
    functionId: "grantMePremium",
    filePath: "functions/grantMePremium.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "admin",
    description: "Grants premium access to the current user"
  },
  {
    functionId: "grantFamilyAccess",
    filePath: "functions/grantFamilyAccess.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "admin",
    description: "Grants premium access to family members (admin only)"
  },

  // === Content Functions ===
  {
    functionId: "createShareableLink",
    filePath: "functions/createShareableLink.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "content",
    description: "Creates shareable links for sermons and studies"
  },
  {
    functionId: "promptSuggestions",
    filePath: "functions/promptSuggestions.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "content",
    description: "Returns AI prompt suggestions by content type"
  },
  {
    functionId: "prompt-suggestions",
    filePath: "functions/prompt-suggestions.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "content",
    description: "Returns AI prompt suggestions (alternate endpoint)"
  },

  // === Import Functions ===
  {
    functionId: "importBibleData",
    filePath: "functions/importBibleData.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "import",
    description: "Imports Bible data from bible-api.com"
  },
  {
    functionId: "importFullBible",
    filePath: "functions/importFullBible.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "import",
    description: "Imports complete Bible (all 66 books)"
  },
  {
    functionId: "importFromScriptureAPI",
    filePath: "functions/importFromScriptureAPI.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "import",
    description: "Imports from Scripture API (requires API key)"
  },

  // === System Functions ===
  {
    functionId: "findAllFunctions",
    filePath: "functions/findAllFunctions.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "system",
    description: "Returns registry of all backend functions"
  },
  {
    functionId: "testAllFunctions",
    filePath: "functions/testAllFunctions.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: ["functions/findAllFunctions.js", "functions/getCodeSnippet.js"],
    category: "system",
    description: "Runs automated tests on all functions"
  },
  {
    functionId: "getCodeSnippet",
    filePath: "functions/getCodeSnippet.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "system",
    description: "Extracts code snippets for error debugging"
  },
  {
    functionId: "getFunctionDetails",
    filePath: "functions/getFunctionDetails.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: ["components/functionRegistry.js"],
    category: "system",
    description: "Returns full source code and metadata for a function"
  },
  {
    functionId: "syncToGitHub",
    filePath: "functions/syncToGitHub.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "system",
    description: "Syncs frontend files to GitHub repository"
  },
  {
    functionId: "_ADMIN_AUTH_TEMPLATE",
    filePath: "functions/_ADMIN_AUTH_TEMPLATE.js",
    exportType: "default",
    namedExports: [],
    dependencyPaths: [],
    category: "system",
    description: "Template for admin-only backend functions"
  }
];

/**
 * Get all functions
 */
export function getAllFunctions() {
  return KNOWN_FUNCTIONS;
}

/**
 * Get function by ID
 */
export function getFunctionById(functionId) {
  return KNOWN_FUNCTIONS.find(f => f.functionId === functionId);
}

/**
 * Get functions by category
 */
export function getFunctionsByCategory(category) {
  return KNOWN_FUNCTIONS.filter(f => f.category === category);
}

/**
 * Get all categories
 */
export function getAllCategories() {
  return [...new Set(KNOWN_FUNCTIONS.map(f => f.category))];
}

/**
 * Search functions
 */
export function searchFunctions(query) {
  const q = query.toLowerCase();
  return KNOWN_FUNCTIONS.filter(f => 
    f.functionId.toLowerCase().includes(q) ||
    f.description.toLowerCase().includes(q) ||
    f.category.toLowerCase().includes(q)
  );
}
