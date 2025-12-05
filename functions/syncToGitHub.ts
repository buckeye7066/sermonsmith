import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * SYNC TO GITHUB
 * 
 * Pushes any app files (functions, pages, components, layout, entities) to GitHub.
 * Supports single file, batch operations, and parallel uploads.
 */

const GITHUB_REPO = "buckeye7066/Bible-app";
const GITHUB_BRANCH = "main";
const MAX_PARALLEL = 5; // Concurrent uploads to avoid rate limits

async function getFileSha(token, filePath) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Base44-SyncToGitHub"
      }
    });
    if (res.ok) {
      const data = await res.json();
      return data.sha;
    }
    return null; // File doesn't exist yet
  } catch {
    return null;
  }
}

async function pushFileToGitHub(token, filePath, content, message) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;
  
  // Get existing file SHA if it exists (required for updates)
  const sha = await getFileSha(token, filePath);
  
  // Handle both string content and already-encoded content
  let encodedContent;
  if (typeof content === 'string') {
    encodedContent = btoa(unescape(encodeURIComponent(content)));
  } else {
    encodedContent = content; // Already base64
  }
  
  const body = {
    message: message || `Update ${filePath}`,
    content: encodedContent,
    branch: GITHUB_BRANCH
  };
  
  if (sha) {
    body.sha = sha; // Required for updating existing files
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Base44-SyncToGitHub",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, error: `GitHub API error ${res.status}: ${error}`, filePath };
  }

  const data = await res.json();
  return { 
    ok: true, 
    sha: data.content.sha,
    url: data.content.html_url,
    isNew: !sha,
    filePath
  };
}

// Process files in parallel batches
async function pushFilesInParallel(token, files, message) {
  const results = [];
  
  for (let i = 0; i < files.length; i += MAX_PARALLEL) {
    const batch = files.slice(i, i + MAX_PARALLEL);
    const batchPromises = batch.map(f => 
      pushFileToGitHub(token, f.path, f.content, f.message || message)
        .then(result => ({ ...result, path: f.path }))
        .catch(err => ({ ok: false, error: err.message, path: f.path }))
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

async function safeRun(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user) return { ok: false, error: 'Authentication required', data: null };
  if (user.role !== 'admin') return { ok: false, error: 'Admin access required', data: null };

  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) return { ok: false, error: 'GITHUB_TOKEN not configured', data: null };

  let body;
  try { body = await req.json(); } catch { return { ok: false, error: 'Invalid JSON', data: null }; }

  const { _selfTest, files, file, content, message } = body;

  if (_selfTest) {
    return { 
      ok: true, 
      selfTest: true, 
      message: 'syncToGitHub operational',
      data: { repo: GITHUB_REPO, branch: GITHUB_BRANCH }
    };
  }

  // Single file mode
  if (file && content) {
    const result = await pushFileToGitHub(token, file, content, message);
    return {
      ok: result.ok,
      error: result.error || null,
      data: result.ok ? {
        file,
        sha: result.sha,
        url: result.url,
        isNew: result.isNew
      } : null
    };
  }

  // Batch mode with parallel processing
  if (files && Array.isArray(files)) {
    // Validate files first
    const validFiles = [];
    const invalidResults = [];

    for (const f of files) {
      if (!f.path || !f.content) {
        invalidResults.push({ path: f.path || 'unknown', ok: false, error: 'Missing path or content' });
      } else {
        validFiles.push(f);
      }
    }

    // Process valid files in parallel
    const uploadResults = await pushFilesInParallel(token, validFiles, message);
    const allResults = [...invalidResults, ...uploadResults];

    const successCount = allResults.filter(r => r.ok).length;
    const failCount = allResults.filter(r => !r.ok).length;

    return {
      ok: failCount === 0,
      error: failCount > 0 ? `${failCount} file(s) failed` : null,
      data: {
        total: files.length,
        success: successCount,
        failed: failCount,
        parallel: true,
        batchSize: MAX_PARALLEL,
        results: allResults
      }
    };
  }

  return { ok: false, error: 'Provide either {file, content} or {files: [{path, content}]}', data: null };
}

Deno.serve(async (req) => {
  try {
    const result = await safeRun(req);
    return Response.json(result);
  } catch (err) {
    console.error('[syncToGitHub] CRITICAL:', err);
    return Response.json({ ok: false, error: err?.message ?? 'Unknown error', data: null });
  }
});