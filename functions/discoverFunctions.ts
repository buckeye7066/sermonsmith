import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * AUTO-DISCOVER APP FILES
 * 
 * Scans the entire app via GitHub API to discover all files:
 * - functions/ (backend)
 * - pages/ (frontend)
 * - components/ (frontend)
 * - entities/ (data schemas)
 * - Layout.js, globals.css
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

// Recursively fetch directory contents
async function fetchDirectoryRecursive(token, path, results = []) {
  try {
    const items = await fetchGitHubDirectory(token, path);
    
    for (const item of items) {
      if (item.type === 'file') {
        results.push({
          path: item.path,
          name: item.name,
          sha: item.sha,
          size: item.size,
          type: 'file'
        });
      } else if (item.type === 'dir') {
        await fetchDirectoryRecursive(token, item.path, results);
      }
    }
  } catch (e) {
    // Directory might not exist
    console.log(`Could not fetch ${path}: ${e.message}`);
  }
  
  return results;
}

// Detect file type category
function detectFileType(filePath) {
  if (filePath.startsWith('functions/')) return 'function';
  if (filePath.startsWith('pages/')) return 'page';
  if (filePath.startsWith('components/')) return 'component';
  if (filePath.startsWith('entities/')) return 'entity';
  if (filePath === 'Layout.js') return 'layout';
  if (filePath === 'globals.css') return 'style';
  return 'other';
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

  const { _selfTest, includeContent = false, scope = 'all' } = body;

  if (_selfTest) {
    return { ok: true, selfTest: true, message: 'discoverFunctions operational', data: null };
  }

  // Determine which directories to scan
  const dirsToScan = scope === 'all' 
    ? ['functions', 'pages', 'components', 'entities']
    : [scope];
  
  // Also check for root files
  const rootFiles = ['Layout.js', 'globals.css'];

  const allFiles = [];

  // Scan directories
  for (const dir of dirsToScan) {
    const dirFiles = await fetchDirectoryRecursive(token, dir);
    allFiles.push(...dirFiles);
  }

  // Check root files
  for (const rootFile of rootFiles) {
    try {
      const content = await fetchFileContent(token, rootFile);
      if (content) {
        allFiles.push({
          path: rootFile,
          name: rootFile,
          sha: null, // Would need separate API call
          size: content.length,
          type: 'file'
        });
      }
    } catch { /* file doesn't exist */ }
  }

  // Process files
  const functions = [];
  const pages = [];
  const components = [];
  const entities = [];
  const other = [];

  for (const file of allFiles) {
    const fileType = detectFileType(file.path);
    const id = file.name.replace(/\.(js|jsx|json|css)$/, '');
    
    let description = 'No description available';
    let content = null;
    
    // Fetch content for functions to get description
    if (fileType === 'function' || includeContent) {
      content = await fetchFileContent(token, file.path);
      if (content && fileType === 'function') {
        description = extractDescription(content);
      }
    }
    
    const fileInfo = {
      id,
      name: file.name,
      path: file.path,
      sha: file.sha,
      size: file.size,
      type: fileType,
      ...(fileType === 'function' ? {
        category: detectCategory(id),
        description
      } : {}),
      ...(includeContent && content ? { content } : {})
    };
    
    switch (fileType) {
      case 'function': functions.push(fileInfo); break;
      case 'page': pages.push(fileInfo); break;
      case 'component': components.push(fileInfo); break;
      case 'entity': entities.push(fileInfo); break;
      default: other.push(fileInfo);
    }
  }

  // Sort functions by category then name
  functions.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.id.localeCompare(b.id);
  });

  // Sort others alphabetically
  pages.sort((a, b) => a.id.localeCompare(b.id));
  components.sort((a, b) => a.path.localeCompare(b.path));
  entities.sort((a, b) => a.id.localeCompare(b.id));

  return {
    ok: true,
    error: null,
    data: {
      functions,
      pages,
      components,
      entities,
      other,
      totals: {
        functions: functions.length,
        pages: pages.length,
        components: components.length,
        entities: entities.length,
        other: other.length,
        all: allFiles.length
      },
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