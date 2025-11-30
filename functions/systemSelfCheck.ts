import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * SYSTEM SELF-CHECK v4.0 - DEEP DIAGNOSTICS
 * 
 * Features:
 * - Discovers all functions via systemListAllFunctions
 * - Deep self-check with { selfCheck: true }
 * - Collects code snippets for failures
 * - Returns unified JSON report
 */

const REQUIRED_ENV_VARS = ['BASE44_APP_ID'];
const OPTIONAL_ENV_VARS = ['STRIPE_API_KEY', 'STRIPE_WEBHOOK_SECRET', 'BIBLE_API_KEY'];

const KNOWN_ENTITIES = [
  'User', 'Sermon', 'BibleStudy', 'Quiz', 'Highlight', 'Note',
  'SermonSeries', 'ReadingPlan', 'StudyNote', 'Message',
  'UserActivity', 'StripeEvent', 'SystemCheckLog'
];

// Hardcoded code snippets for error context (since we can't read files at runtime)
const CODE_SNIPPETS = {
  'biblePassage': `async function safeRun(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return { ok: false, error: 'Unauthorized' };
  // ... fetches from bible.helloao.org ...
}`,
  'createCheckoutSession': `async function safeRun(req) {
  const stripeKey = Deno.env.get("STRIPE_API_KEY");
  if (!stripeKey) return { ok: false, error: 'STRIPE_API_KEY not configured' };
  // ... creates Stripe checkout session ...
}`,
  'stripe-webhook': `Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  // Validates Stripe webhook signature
  // Updates user subscription status
});`,
  'exportToPDF': `async function safeRun(req) {
  // Generates PDF from sermon/study content
  const doc = new jsPDF();
  // ... adds content to PDF ...
}`,
  'exportToPPTX': `async function safeRun(req) {
  // Generates PowerPoint from sermon/study content
  const pptx = new PptxGenJS();
  // ... adds slides ...
}`,
  'listUsers': `async function safeRun(req) {
  // Requires admin role
  const users = await base44.asServiceRole.entities.User.list();
  return { ok: true, data: { users } };
}`,
  'promptSuggestions': `async function safeRun(req) {
  const SUGGESTIONS = { sermon: [...], study: [...], quiz: [...] };
  return { ok: true, data: SUGGESTIONS[type] || SUGGESTIONS.sermon };
}`,
  'default': `// No code snippet available for this function
// Check functions/<name>.js for implementation`
};

async function testFunction(base44, fn, timeoutMs = 10000) {
  const result = {
    functionId: fn.id,
    path: fn.path,
    filePath: fn.filePath,
    category: fn.category,
    ok: false,
    errorMessage: null,
    stack: null,
    codeSnippet: CODE_SNIPPETS[fn.id] || CODE_SNIPPETS['default'],
    responseTime: 0,
    skipped: fn.skip || false
  };

  if (fn.skip) {
    result.ok = true;
    result.errorMessage = `Skipped (${fn.category})`;
    return result;
  }

  const startTime = Date.now();

  try {
    const response = await Promise.race([
      base44.functions.invoke(fn.id, { selfCheck: true, _selfTest: true }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);

    result.responseTime = Date.now() - startTime;

    // Check for HTML response (error page)
    if (typeof response.data === 'string') {
      const trimmed = response.data.trim();
      if (trimmed.startsWith('<') || trimmed.startsWith('<!')) {
        result.ok = false;
        result.errorMessage = 'Function returned HTML instead of JSON (server error page)';
        return result;
      }
    }

    // Validate envelope
    const data = response.data;
    if (data && typeof data === 'object') {
      if (data.selfTest === true || data.ok === true) {
        result.ok = true;
      } else if (data.ok === false) {
        result.ok = false;
        result.errorMessage = data.error || 'Function returned ok:false';
      } else {
        // No envelope but successful HTTP
        result.ok = response.status >= 200 && response.status < 400;
        if (!result.ok) {
          result.errorMessage = `Non-envelope response with status ${response.status}`;
        }
      }
    } else {
      result.ok = response.status >= 200 && response.status < 400;
    }

  } catch (err) {
    result.responseTime = Date.now() - startTime;
    result.ok = false;
    result.errorMessage = err.message || 'Unknown error';
    result.stack = err.stack || null;
  }

  return result;
}

function checkEnvironment() {
  const results = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = Deno.env.get(envVar);
    results.push({
      name: envVar,
      required: true,
      present: !!value,
      ok: !!value,
      error: value ? null : `Required: ${envVar} is missing`
    });
  }

  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = Deno.env.get(envVar);
    let validation = null;
    
    if (envVar === 'STRIPE_API_KEY' && value && !value.startsWith('sk_')) {
      validation = 'Invalid format: expected sk_*';
    }
    
    results.push({
      name: envVar,
      required: false,
      present: !!value,
      ok: !validation,
      error: validation
    });
  }

  return results;
}

async function testEntity(base44, entityName) {
  try {
    await base44.entities[entityName].list('-created_date', 1);
    return { name: entityName, ok: true, error: null };
  } catch (err) {
    if (err.message?.includes('permission') || err.message?.includes('denied')) {
      return { name: entityName, ok: true, error: 'RLS protected (expected)' };
    }
    return { name: entityName, ok: false, error: err.message };
  }
}

async function discoverFunctions(base44) {
  try {
    const response = await base44.functions.invoke('systemListAllFunctions', {});
    if (response.data?.ok === false) {
      return { ok: false, error: response.data.error, functions: [] };
    }
    return { 
      ok: true, 
      functions: response.data?.data?.functions || response.data?.functions || []
    };
  } catch (err) {
    return { ok: false, error: err.message, functions: [] };
  }
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    // Handle self-check mode
    const url = new URL(req.url);
    if (url.searchParams.get('_selfTest') === '1') {
      return Response.json({ 
        ok: true, 
        selfTest: true, 
        function: 'systemSelfCheck',
        message: 'systemSelfCheck is operational'
      });
    }

    let body = {};
    try {
      body = await req.json();
    } catch {
      // No body is fine
    }

    if (body._selfTest || body.selfCheck) {
      return Response.json({ 
        ok: true, 
        selfTest: true, 
        function: 'systemSelfCheck',
        message: 'systemSelfCheck is operational'
      });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ ok: false, error: 'Authentication required', data: null });
    }

    if (user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Admin access required', data: null });
    }

    const autoRetry = url.searchParams.get('autoRetry') === '1';
    const retryDelayMs = parseInt(url.searchParams.get('retryDelayMs') || '2000', 10);

    console.log('═'.repeat(60));
    console.log('🔬 SYSTEM SELF-CHECK v4.0 - DEEP DIAGNOSTICS');
    console.log('═'.repeat(60));

    // Step 1: Discover all functions
    console.log('\n📡 DISCOVERING FUNCTIONS...');
    const discovery = await discoverFunctions(base44);
    
    if (!discovery.ok) {
      return Response.json({
        ok: false,
        error: `Function discovery failed: ${discovery.error}`,
        data: {
          checked: 0,
          passed: 0,
          failed: 1,
          skipped: 0,
          failures: [{
            functionId: 'systemListAllFunctions',
            path: '/functions/systemListAllFunctions',
            filePath: 'functions/systemListAllFunctions.js',
            errorMessage: discovery.error,
            stack: null,
            codeSnippet: 'Function discovery failed - check systemListAllFunctions.js'
          }]
        }
      });
    }

    const functions = discovery.functions;
    console.log(`  Found ${functions.length} functions`);

    // Step 2: Environment checks
    const envResults = checkEnvironment();
    console.log('\n📋 ENVIRONMENT');
    envResults.forEach(e => console.log(`  ${e.ok ? '✅' : '❌'} ${e.name}`));

    // Step 3: Entity checks
    console.log('\n🗄️ ENTITIES');
    const entityResults = [];
    for (const entity of KNOWN_ENTITIES) {
      const result = await testEntity(base44, entity);
      entityResults.push(result);
      console.log(`  ${result.ok ? '✅' : '❌'} ${entity}`);
    }

    // Step 4: Test all functions with deep self-check
    console.log('\n⚡ FUNCTION SELF-CHECKS');
    const functionResults = [];
    
    for (const fn of functions) {
      const result = await testFunction(base44, fn);
      functionResults.push(result);
      
      if (result.skipped) {
        console.log(`  ⏭️ ${fn.id}: Skipped (${fn.category})`);
      } else {
        console.log(`  ${result.ok ? '✅' : '❌'} ${fn.id}: ${result.responseTime}ms${result.errorMessage ? ` - ${result.errorMessage}` : ''}`);
      }
    }

    // Step 5: Auto-retry failed functions
    if (autoRetry) {
      const failed = functionResults.filter(r => !r.ok && !r.skipped);
      if (failed.length > 0) {
        console.log(`\n🔄 RETRYING ${failed.length} FAILED...`);
        await new Promise(r => setTimeout(r, retryDelayMs));
        
        for (const f of failed) {
          const fn = functions.find(x => x.id === f.functionId);
          if (fn) {
            const retry = await testFunction(base44, fn);
            const idx = functionResults.findIndex(x => x.functionId === fn.id);
            if (idx >= 0) {
              functionResults[idx] = { ...retry, retried: true };
            }
            console.log(`  ${retry.ok ? '✅' : '❌'} ${fn.id} (retry)`);
          }
        }
      }
    }

    // Step 6: Collect failures
    const failures = functionResults.filter(r => !r.ok && !r.skipped).map(f => ({
      functionId: f.functionId,
      path: f.path,
      filePath: f.filePath,
      errorMessage: f.errorMessage,
      stack: f.stack,
      codeSnippet: f.codeSnippet
    }));

    // Add env failures
    const envFailures = envResults.filter(r => !r.ok && r.required);
    for (const ef of envFailures) {
      failures.push({
        functionId: `ENV:${ef.name}`,
        path: 'environment',
        filePath: 'N/A',
        errorMessage: ef.error,
        stack: null,
        codeSnippet: `// Missing required environment variable: ${ef.name}`
      });
    }

    // Summary
    const checked = functionResults.filter(r => !r.skipped).length;
    const passed = functionResults.filter(r => r.ok && !r.skipped).length;
    const failed = failures.length;
    const skipped = functionResults.filter(r => r.skipped).length;

    const overallOk = failed === 0;

    console.log('\n' + '═'.repeat(60));
    console.log(`🎯 ${overallOk ? '✅ ALL SYSTEMS OK' : `❌ ${failed} ISSUE(S) FOUND`}`);
    console.log(`Checked: ${checked} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);

    // Build combined error report
    let combinedErrorReport = '';
    if (failures.length > 0) {
      combinedErrorReport = `
╔══════════════════════════════════════════════════════════════╗
║           COMBINED ERROR REPORT (${failures.length} FAILURES)                  ║
╚══════════════════════════════════════════════════════════════╝

${failures.map((f, i) => `
────────────────────────────────────────────────────────────────
FAILURE #${i + 1}: ${f.functionId}
────────────────────────────────────────────────────────────────
PATH: ${f.path}
FILE: ${f.filePath}
ERROR: ${f.errorMessage}
${f.stack ? `STACK:\n${f.stack}` : ''}

CODE SNIPPET:
\`\`\`javascript
${f.codeSnippet}
\`\`\`
`).join('\n')}
`;
    } else {
      combinedErrorReport = '✅ NO ERRORS - ALL SYSTEMS OPERATIONAL';
    }

    // Log to database
    try {
      await base44.asServiceRole.entities.SystemCheckLog.create({
        timestamp: new Date().toISOString(),
        user_email: user.email,
        app_name: 'SermonSmith',
        summary: { checked, passed, failed, skipped },
        checks: functionResults,
        overall_ok: overallOk
      });
    } catch (e) {
      console.log('⚠️ Could not log:', e.message);
    }

    return Response.json({
      ok: overallOk,
      error: overallOk ? null : `Self-check failed for ${failed} function(s). See data.failures for details.`,
      data: {
        checked,
        passed,
        failed,
        skipped,
        failures,
        functionResults,
        envResults,
        entityResults,
        combinedErrorReport,
        elapsedTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('❌ SELF-CHECK CRASHED:', err);
    return Response.json({
      ok: false,
      error: err?.message ?? 'Unknown error',
      data: {
        checked: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        failures: [{
          functionId: 'systemSelfCheck',
          path: '/functions/systemSelfCheck',
          filePath: 'functions/systemSelfCheck.js',
          errorMessage: err?.message ?? 'Unknown crash',
          stack: err?.stack || null,
          codeSnippet: '// Self-check crashed unexpectedly'
        }]
      }
    });
  }
});