import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * AUTO-DISCOVER FUNCTIONS
 * 
 * Scans the functions directory via GitHub API to discover all backend functions.
 * Returns metadata for each function found.
 */

const GITHUB_REPO = "buckeye7066/Bible-app";
const GITHUB_BRANCH = "main";

// Category detection based on filename patterns
function detectCategory(filename) {
  const name = filename.toLowerCase();
  if (name.includes('bible') || name.includes('passage') || name.includes('translation')) return 'bible';
  if (name.includes('export') || name.includes('pdf') || name.includes('pptx')) return 'export';
  if (name.includes('stripe') || name.includes('checkout') || name.includes('payment')) return 'payment';
  if (name.includes('admin') || name.includes('user') || name.includes('grant')) return 'admin';
  if (name.includes('import')) return 'import';
  if (name.includes('share') || name.includes('prompt') || name.includes('suggestion')) return 'content';
  return 'system';
}

// Extract description from file content (looks for JSDoc or first comment)
function extractDescription(content) {
  // Try to find JSDoc @description or first line comment
  const jsdocMatch = content.match(/\/\*\*[\s\S]*?\*\//);
  if (jsdocMatch) {
    const descMatch = jsdocMatch[0].match(/\*\s*([A-Z][^@*\n]+)/);
    if (descMatch) return descMatch[1].trim();
    
    // Try to get first meaningful line after /**
    const lines = jsdocMatch[0].split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/^[\s*\/]+/, '').trim();
      if (cleaned && !cleaned.startsWith('@') && cleaned.length > 10) {
        return cleaned;
      }
    }
  }
  
  // Try single-line comment at top
  const singleMatch = content.match(/^\/\/\s*(.+)/m);
  if (singleMatch) return singleMatch[1].trim();
  
  return 'No description available';
}

async function fetchGitHubDirectory(token, path = 'functions') {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`;
  
  const res = await fetch(url, {
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Base44-DiscoverFunctions"
    }
  });
  
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${error}`);
  }
  
  return res.json();
}

async function fetchFileContent(token, path) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`;
  
  const res = await fetch(url, {
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Base44-DiscoverFunctions"
    }
  });
  
  if (!res.ok) return null;
  
  const data = await res.json();
  if (data.content) {
    return atob(data.content.replace(/\n/g, ''));
  }
  return null;
}

async function safeRun(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user) return { ok: false, error: 'Authentication required', data: null };
  if (user.role !== 'admin') return { ok: false, error: 'Admin access required', data: null };

  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) return { ok: false, error: 'GITHUB_TOKEN not configured', data: null };

  let body = {};
  try { body = await req.json(); } catch { /* empty body is ok */ }

  const { _selfTest, includeContent = false } = body;

  if (_selfTest) {
    return { ok: true, selfTest: true, message: 'discoverFunctions operational', data: null };
  }

  // Fetch all files in functions directory
  const files = await fetchGitHubDirectory(token, 'functions');
  
  const functions = [];
  
  for (const file of files) {
    if (file.type !== 'file' || !file.name.endsWith('.js')) continue;
    
    const functionId = file.name.replace('.js', '');
    const filePath = `functions/${file.name}`;
    
    let description = 'No description available';
    let content = null;
    
    // Fetch content to extract description
    if (includeContent || true) { // Always fetch to get description
      content = await fetchFileContent(token, filePath);
      if (content) {
        description = extractDescription(content);
      }
    }
    
    functions.push({
      functionId,
      filePath,
      exportType: 'default',
      namedExports: [],
      dependencyPaths: [],
      category: detectCategory(functionId),
      description,
      sha: file.sha,
      size: file.size,
      ...(includeContent && content ? { sourceCode: content } : {})
    });
  }

  // Sort by category then name
  functions.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.functionId.localeCompare(b.functionId);
  });

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
    console.error('[discoverFunctions] CRITICAL:', err);
    return Response.json({ ok: false, error: err?.message ?? 'Unknown error', data: null });
  }
});