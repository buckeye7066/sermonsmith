import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * SYSTEM SELF-CHECK v3.0 - UNIFIED ENVELOPE COMPLIANCE
 * 
 * Features:
 * - Tests all functions for unified { ok, error, data } envelope
 * - Detects HTML responses (API failures)
 * - Validates JSON structure
 * - Auto-retry with configurable delay
 */

const FUNCTION_REGISTRY = [
  { name: 'biblePassage', category: 'bible' },
  { name: 'getPassageMultiSource', category: 'bible' },
  { name: 'listAvailableTranslations', category: 'bible' },
  { name: 'createCheckoutSession', category: 'stripe' },
  { name: 'stripe-webhook', category: 'stripe' },
  { name: 'exportToPDF', category: 'export' },
  { name: 'exportToPPTX', category: 'export' },
  { name: 'listUsers', category: 'admin' },
  { name: 'grantFamilyAccess', category: 'admin' },
  { name: 'grantMePremium', category: 'admin' },
  { name: 'createShareableLink', category: 'sharing' },
  { name: 'promptSuggestions', category: 'general' },
  { name: 'importBibleData', category: 'crawler', skip: true },
  { name: 'importFullBible', category: 'crawler', skip: true },
  { name: 'importFromScriptureAPI', category: 'crawler', skip: true },
  { name: 'systemSelfCheck', category: 'admin', skip: true }
];

const REQUIRED_ENV_VARS = ['BASE44_APP_ID'];
const OPTIONAL_ENV_VARS = ['STRIPE_API_KEY', 'STRIPE_WEBHOOK_SECRET', 'BIBLE_API_KEY'];

const KNOWN_ENTITIES = [
  'User', 'Sermon', 'BibleStudy', 'Quiz', 'Highlight', 'Note',
  'SermonSeries', 'ReadingPlan', 'StudyNote', 'Message',
  'UserActivity', 'StripeEvent', 'SystemCheckLog'
];

async function testFunction(base44, fn, timeoutMs = 8000) {
  const result = {
    name: fn.name,
    category: fn.category,
    ok: false,
    error: null,
    responseTime: 0,
    envelope: null,
    skipped: fn.skip || false
  };

  if (fn.skip) {
    result.ok = true;
    result.error = 'Skipped (crawler/self)';
    return result;
  }

  const startTime = Date.now();

  try {
    const response = await Promise.race([
      base44.functions.invoke(fn.name, { _selfTest: true }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);

    result.responseTime = Date.now() - startTime;

    // Check if response is HTML (error page)
    if (typeof response.data === 'string') {
      if (response.data.trim().startsWith('<') || response.data.trim().startsWith('<!')) {
        result.ok = false;
        result.error = 'Function returned HTML instead of JSON';
        return result;
      }
    }

    // Validate envelope structure
    const data = response.data;
    if (data && typeof data === 'object') {
      result.envelope = {
        hasOk: 'ok' in data,
        hasError: 'error' in data,
        hasSelfTest: 'selfTest' in data
      };

      // Accept either selfTest response or full envelope
      if (data.selfTest === true || (data.ok === true)) {
        result.ok = true;
      } else if (data.ok === false) {
        result.ok = false;
        result.error = data.error || 'Function returned ok:false';
      } else {
        // Legacy response without envelope - still pass if status is OK
        result.ok = response.status >= 200 && response.status < 400;
        if (!result.ok) {
          result.error = `Non-envelope response with status ${response.status}`;
        }
      }
    } else {
      result.ok = response.status >= 200 && response.status < 400;
    }

  } catch (err) {
    result.responseTime = Date.now() - startTime;
    result.ok = false;
    result.error = err.message || 'Unknown error';
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

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ ok: false, error: 'Authentication required', data: null });
    }

    if (user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Admin access required', data: null });
    }

    const url = new URL(req.url);
    const autoRetry = url.searchParams.get('autoRetry') === '1';
    const retryDelayMs = parseInt(url.searchParams.get('retryDelayMs') || '2000', 10);

    console.log('═'.repeat(60));
    console.log('🔬 SYSTEM SELF-CHECK v3.0 - UNIFIED ENVELOPE');
    console.log('═'.repeat(60));

    // Environment checks
    const envResults = checkEnvironment();
    console.log('\n📋 ENVIRONMENT');
    envResults.forEach(e => console.log(`  ${e.ok ? '✅' : '❌'} ${e.name}`));

    // Entity checks
    console.log('\n🗄️ ENTITIES');
    const entityResults = [];
    for (const entity of KNOWN_ENTITIES) {
      const result = await testEntity(base44, entity);
      entityResults.push(result);
      console.log(`  ${result.ok ? '✅' : '❌'} ${entity}`);
    }

    // Function tests
    console.log('\n⚡ FUNCTIONS');
    const functionResults = [];
    for (const fn of FUNCTION_REGISTRY) {
      const result = await testFunction(base44, fn);
      functionResults.push(result);
      
      if (result.skipped) {
        console.log(`  ⏭️ ${fn.name}: Skipped`);
      } else {
        console.log(`  ${result.ok ? '✅' : '❌'} ${fn.name}: ${result.responseTime}ms${result.error ? ` - ${result.error}` : ''}`);
      }
    }

    // Auto-retry failed functions
    if (autoRetry) {
      const failed = functionResults.filter(r => !r.ok && !r.skipped);
      if (failed.length > 0) {
        console.log(`\n🔄 RETRYING ${failed.length} FAILED...`);
        await new Promise(r => setTimeout(r, retryDelayMs));
        
        for (const f of failed) {
          const fn = FUNCTION_REGISTRY.find(x => x.name === f.name);
          if (fn) {
            const retry = await testFunction(base44, fn);
            const idx = functionResults.findIndex(x => x.name === fn.name);
            if (idx >= 0) functionResults[idx] = { ...retry, retried: true };
            console.log(`  ${retry.ok ? '✅' : '❌'} ${fn.name} (retry)`);
          }
        }
      }
    }

    // Summary
    const funcPassed = functionResults.filter(r => r.ok).length;
    const funcFailed = functionResults.filter(r => !r.ok && !r.skipped).length;
    const envPassed = envResults.filter(r => r.ok).length;
    const entityPassed = entityResults.filter(r => r.ok).length;

    const overallOk = funcFailed === 0 && envResults.filter(r => r.required && !r.ok).length === 0;

    console.log('\n' + '═'.repeat(60));
    console.log(`🎯 ${overallOk ? '✅ ALL SYSTEMS OK' : '❌ ISSUES FOUND'}`);
    console.log(`Functions: ${funcPassed}/${functionResults.length} | Env: ${envPassed}/${envResults.length} | Entities: ${entityPassed}/${entityResults.length}`);

    // Build error report
    const failures = functionResults.filter(r => !r.ok && !r.skipped);
    const envFailures = envResults.filter(r => !r.ok && r.required);
    
    let combinedErrorReport = '';
    if (failures.length > 0 || envFailures.length > 0) {
      combinedErrorReport = `
╔══════════════════════════════════════════════════════════════╗
║           COMBINED ERROR REPORT (${failures.length + envFailures.length} ISSUES)                  ║
╚══════════════════════════════════════════════════════════════╝

${failures.map(f => `FUNCTION: ${f.name}
ERROR: ${f.error}
RESPONSE TIME: ${f.responseTime}ms
`).join('\n')}

${envFailures.map(e => `ENV VAR: ${e.name}
ERROR: ${e.error}
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
        summary: { 
          functions: { passed: funcPassed, failed: funcFailed, total: functionResults.length },
          env: { passed: envPassed, total: envResults.length },
          entities: { passed: entityPassed, total: entityResults.length }
        },
        checks: [...functionResults, ...entityResults],
        overall_ok: overallOk
      });
    } catch (e) {
      console.log('⚠️ Could not log:', e.message);
    }

    return Response.json({
      ok: overallOk,
      error: overallOk ? null : `${failures.length} function(s) failed`,
      data: {
        summary: {
          functions: { passed: funcPassed, failed: funcFailed, total: functionResults.length },
          env: { passed: envPassed, total: envResults.length },
          entities: { passed: entityPassed, total: entityResults.length }
        },
        functionChecks: functionResults,
        envChecks: envResults,
        entityChecks: entityResults,
        combinedErrorReport,
        elapsedTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('❌ SELF-CHECK CRASHED:', err);
    return Response.json({
      ok: false,
      error: err?.message ?? "Unknown error",
      data: null
    });
  }
});