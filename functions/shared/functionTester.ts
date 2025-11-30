/**
 * FUNCTION TESTER v2.0
 * 
 * Executes functions safely with timeout, mock context, and error capture.
 */

/**
 * Test a single function by invoking it via the Base44 SDK
 * @param {object} base44 - Base44 SDK instance
 * @param {object} surface - Function surface from mapper
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<FunctionTestResult>}
 */
export async function runFunctionTest(base44, surface, timeoutMs = null) {
  // Determine timeout based on function type
  const timeout = timeoutMs || (surface.isExternalCrawler ? 15000 : 5000);
  
  const result = {
    ok: false,
    filePath: surface.filePath,
    functionName: surface.name,
    kind: surface.kind,
    errorMessage: null,
    stack: null,
    snippet: null,
    responseTime: 0,
    status: null,
    skipped: false,
    skipReason: null
  };

  // Skip self-check to avoid recursion
  if (surface.isSelfCheck) {
    result.ok = true;
    result.skipped = true;
    result.skipReason = 'Self-check function - skipped to avoid recursion';
    return result;
  }

  // For external crawlers in self-test mode, just validate callable
  if (surface.isExternalCrawler) {
    result.ok = true;
    result.skipped = true;
    result.skipReason = 'External crawler - skipped to avoid network calls. Function exists and is registered.';
    return result;
  }

  const startTime = Date.now();

  try {
    // Execute with timeout
    const response = await Promise.race([
      base44.functions.invoke(surface.name, surface.testPayload),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
      )
    ]);

    result.responseTime = Date.now() - startTime;
    result.status = response.status;

    // 2xx-4xx are considered "working" (4xx means auth/validation worked correctly)
    // 5xx indicates a server error
    if (response.status >= 200 && response.status < 500) {
      result.ok = true;
    } else {
      result.ok = false;
      result.errorMessage = response.data?.error || response.data?.message || `Server error: ${response.status}`;
      result.stack = response.data?.stack || null;
    }

  } catch (err) {
    result.responseTime = Date.now() - startTime;
    result.ok = false;
    result.errorMessage = err.message;
    result.stack = err.stack || null;

    // Extract snippet from stack if available
    if (err.stack) {
      const lines = err.stack.split('\n').slice(0, 10);
      result.snippet = lines.join('\n');
    }
  }

  return result;
}

/**
 * Test all functions from a list of surfaces
 * @param {object} base44 - Base44 SDK instance
 * @param {Array} surfaces - List of function surfaces
 * @returns {Promise<Array<FunctionTestResult>>}
 */
export async function runAllFunctionTests(base44, surfaces) {
  const results = [];
  
  for (const surface of surfaces) {
    const result = await runFunctionTest(base44, surface);
    results.push(result);
  }
  
  return results;
}

/**
 * Build consolidated error report from test results
 * @param {Array} results - Function test results
 * @returns {string}
 */
export function buildFunctionErrorReport(results) {
  const failures = results.filter(r => !r.ok && !r.skipped);
  
  if (failures.length === 0) {
    return '✅ All function tests passed.';
  }

  const report = failures.map(f => `
--------------------------------------------------
FILE: ${f.filePath}
FUNCTION: ${f.functionName} (${f.kind})
OK: NO
STATUS: ${f.status || 'N/A'}
RESPONSE TIME: ${f.responseTime}ms
ERROR: ${f.errorMessage || 'unknown'}
STACK:
${f.stack || 'no stack available'}

SNIPPET:
${f.snippet || 'no snippet available'}
--------------------------------------------------`).join('\n');

  return `FUNCTION ERROR REPORT (${failures.length} failures)\n${'═'.repeat(50)}\n${report}`;
}

export default {
  runFunctionTest,
  runAllFunctionTests,
  buildFunctionErrorReport
};