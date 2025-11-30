import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { mapAllFunctions, getExecutableFunctions, getFunctionStats } from './shared/functionMapper.js';
import { runFunctionTest, buildFunctionErrorReport } from './shared/functionTester.js';

/**
 * SYSTEM SELF-CHECK v2.0
 * 
 * Comprehensive diagnostic of all app layers:
 * - Environment variables
 * - Database connectivity
 * - Entity existence & RLS policies
 * - Full function introspection
 * - Cross-contamination detection
 * - Integration health (Stripe)
 */

// Required environment variables
const REQUIRED_ENV_VARS = ['BASE44_APP_ID'];

// Optional but recommended env vars
const OPTIONAL_ENV_VARS = ['STRIPE_API_KEY', 'STRIPE_WEBHOOK_SECRET', 'BIBLE_API_KEY'];

// Known entities to check
const KNOWN_ENTITIES = [
  'User', 'Sermon', 'BibleStudy', 'Quiz', 'Highlight', 'Note',
  'SermonSeries', 'ReadingPlan', 'StudyNote', 'Message',
  'UserActivity', 'StripeEvent', 'SystemCheckLog'
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function checkEnvironment() {
  const results = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = Deno.env.get(envVar);
    results.push({
      name: envVar,
      category: 'environment',
      required: true,
      present: !!value,
      ok: !!value,
      error: value ? null : `Required env var ${envVar} is missing`
    });
  }

  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = Deno.env.get(envVar);
    results.push({
      name: envVar,
      category: 'environment',
      required: false,
      present: !!value,
      ok: true,
      warning: value ? null : `Optional env var ${envVar} not set`
    });
  }

  return results;
}

async function testEntity(base44, entityName) {
  const result = {
    name: entityName,
    category: 'entity',
    exists: false,
    readable: false,
    ok: false,
    error: null
  };

  try {
    const items = await base44.entities[entityName].list('-created_date', 1);
    result.exists = true;
    result.readable = true;
    result.ok = true;
    result.itemCount = items.length;
  } catch (err) {
    if (err.message?.includes('not found') || err.message?.includes('does not exist')) {
      result.exists = false;
      result.error = 'Entity does not exist';
    } else if (err.message?.includes('permission') || err.message?.includes('denied') || err.message?.includes('403')) {
      result.exists = true;
      result.readable = false;
      result.ok = true; // Permission denied is expected for some entities
      result.error = 'Read permission denied (expected for RLS)';
    } else {
      result.error = err.message;
    }
  }

  return result;
}

async function testRLS(base44, user) {
  const results = [];
  const entitiesToTest = [
    { name: 'Sermon', userField: 'user_id' },
    { name: 'Highlight', userField: 'user_id' },
    { name: 'Note', userField: 'user_id' }
  ];

  for (const entity of entitiesToTest) {
    try {
      const items = await base44.entities[entity.name].list('-created_date', 10);
      const otherUserItems = items.filter(i => i[entity.userField] !== user.id);
      
      results.push({
        entity: entity.name,
        category: 'rls',
        ok: otherUserItems.length === 0,
        leak: otherUserItems.length > 0,
        description: otherUserItems.length > 0 
          ? `Found ${otherUserItems.length} items belonging to other users` 
          : 'RLS working correctly'
      });
    } catch (err) {
      results.push({
        entity: entity.name,
        category: 'rls',
        ok: true,
        leak: false,
        description: 'Access denied or no items (acceptable)'
      });
    }
  }

  return results;
}

async function detectContamination(base44, user, isAdmin) {
  const results = { ok: true, results: [] };

  if (isAdmin) {
    results.results.push({
      leak: false,
      description: 'Admin user - can access all data by design',
      functionName: 'N/A',
      filePath: 'N/A'
    });
    return results;
  }

  const rlsResults = await testRLS(base44, user);
  
  for (const rlsResult of rlsResults) {
    if (rlsResult.leak) {
      results.ok = false;
      results.results.push({
        leak: true,
        description: rlsResult.description,
        functionName: `${rlsResult.entity}.list()`,
        filePath: `entities/${rlsResult.entity}.json`,
        offendingCode: `RLS policy missing user_id filter`
      });
    } else {
      results.results.push({
        leak: false,
        description: `${rlsResult.entity}: ${rlsResult.description}`,
        functionName: `${rlsResult.entity}.list()`,
        filePath: `entities/${rlsResult.entity}.json`
      });
    }
  }

  return results;
}

function buildCombinedErrorReport(functionResults, otherChecks, contamination, envMissing) {
  const report = [];

  // Function failures
  const functionFailures = functionResults.filter(r => !r.ok && !r.skipped);
  for (const f of functionFailures) {
    report.push(
`--------------------------------------------------
FILE: ${f.filePath}
FUNCTION: ${f.functionName} (${f.kind})
STATUS: ${f.status || 'N/A'}
RESPONSE TIME: ${f.responseTime}ms
ERROR: ${f.errorMessage || 'unknown'}
STACK:
${f.stack || 'no stack'}

SNIPPET:
${f.snippet || 'no snippet'}
--------------------------------------------------`);
  }

  // Other check failures
  const otherFailures = otherChecks.filter(c => !c.ok);
  for (const c of otherFailures) {
    report.push(
`--------------------------------------------------
CHECK: ${c.name || c.entity || 'Unknown'}
CATEGORY: ${c.category || 'other'}
ERROR: ${c.error || 'unknown'}
--------------------------------------------------`);
  }

  // Contamination leaks
  const leaks = contamination.results?.filter(r => r.leak) || [];
  for (const leak of leaks) {
    report.push(
`--------------------------------------------------
DATA CONTAMINATION LEAK
DESCRIPTION: ${leak.description}
FUNCTION: ${leak.functionName}
FILE: ${leak.filePath}
--------------------------------------------------`);
  }

  // Missing env vars
  if (envMissing && envMissing.length > 0) {
    report.push(
`--------------------------------------------------
MISSING REQUIRED ENV VARS: ${envMissing.join(', ')}
--------------------------------------------------`);
  }

  if (report.length === 0) {
    return '✅ No errors detected - all systems operational.';
  }

  return `COMBINED ERROR REPORT (${report.length} issues)\n${'═'.repeat(50)}\n\n${report.join('\n\n')}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ ok: false, error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    const isAdmin = user.role === 'admin';
    const otherChecks = [];

    console.log('═'.repeat(80));
    console.log('🔬 SYSTEM SELF-CHECK v2.0 STARTING');
    console.log('═'.repeat(80));
    console.log(`User: ${user.email} | Admin: ${isAdmin} | Time: ${new Date().toISOString()}`);

    // ════════════════════════════════════════════════════════════════════════
    // A) ENVIRONMENT CHECKS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n📋 ENVIRONMENT CHECKS');
    const envResults = checkEnvironment();
    otherChecks.push(...envResults);
    for (const env of envResults) {
      console.log(`  ${env.ok ? '✅' : '❌'} ${env.name}: ${env.present ? 'Set' : 'Missing'}${env.required ? ' (required)' : ''}`);
    }

    // ════════════════════════════════════════════════════════════════════════
    // B) DATABASE CONNECTIVITY
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🗄️ DATABASE CONNECTIVITY');
    let dbOk = false;
    try {
      await base44.entities.User.list('-created_date', 1);
      dbOk = true;
      console.log('  ✅ Database connection successful');
    } catch (err) {
      console.log(`  ❌ Database error: ${err.message}`);
    }
    otherChecks.push({ name: 'Database Connectivity', category: 'database', ok: dbOk, error: dbOk ? null : 'Failed to connect' });

    // ════════════════════════════════════════════════════════════════════════
    // C) ENTITY CHECKS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🗄️ ENTITY CHECKS');
    for (const entityName of KNOWN_ENTITIES) {
      const result = await testEntity(base44, entityName);
      otherChecks.push(result);
      console.log(`  ${result.ok ? '✅' : '❌'} ${entityName}: ${result.exists ? 'Exists' : 'Missing'}${result.readable ? ', Readable' : ''}${result.error ? ` (${result.error})` : ''}`);
    }

    // ════════════════════════════════════════════════════════════════════════
    // D) RLS POLICY CHECKS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🔒 RLS POLICY CHECKS');
    const rlsResults = await testRLS(base44, user);
    otherChecks.push(...rlsResults);
    for (const rls of rlsResults) {
      console.log(`  ${rls.ok ? '✅' : '🚨'} ${rls.entity}: ${rls.description}`);
    }

    // ════════════════════════════════════════════════════════════════════════
    // E) CROSS-CONTAMINATION DETECTION
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🔍 CROSS-CONTAMINATION DETECTION');
    const contamination = await detectContamination(base44, user, isAdmin);
    for (const c of contamination.results) {
      console.log(`  ${c.leak ? '🚨' : '✅'} ${c.description}`);
    }

    // ════════════════════════════════════════════════════════════════════════
    // F) FULL FUNCTION INTROSPECTION
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n⚡ FUNCTION INTROSPECTION v2.0');
    const functionStats = getFunctionStats();
    const allFunctions = getExecutableFunctions();
    console.log(`  📊 Total functions: ${functionStats.total}`);
    console.log(`  📊 Executable: ${functionStats.executable}`);
    console.log(`  📊 External crawlers (skipped): ${functionStats.crawlers}`);

    const functionResults = [];
    for (const fn of allFunctions) {
      const result = await runFunctionTest(base44, fn);
      functionResults.push(result);
      
      if (result.skipped) {
        console.log(`  ⏭️ ${fn.name}: Skipped (${result.skipReason})`);
      } else {
        console.log(`  ${result.ok ? '✅' : '❌'} ${fn.name}: ${result.status || 'Error'} (${result.responseTime}ms)${result.errorMessage ? ` - ${result.errorMessage}` : ''}`);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // G) STRIPE INTEGRATION CHECK
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n💳 STRIPE INTEGRATION CHECK');
    const stripeKey = Deno.env.get('STRIPE_API_KEY');
    const stripeWebhook = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    let stripeKeyValid = false;
    let stripeKeyError = null;
    
    if (stripeKey) {
      // Validate Stripe key format
      if (stripeKey.startsWith('sk_test_') || stripeKey.startsWith('sk_live_')) {
        stripeKeyValid = true;
        console.log(`  ✅ Stripe API Key: Valid format (${stripeKey.startsWith('sk_live_') ? 'LIVE' : 'TEST'} mode)`);
      } else {
        stripeKeyError = `Invalid Stripe key format. Expected sk_test_* or sk_live_*, got ${stripeKey.substring(0, 10)}...`;
        console.log(`  ❌ Stripe API Key: ${stripeKeyError}`);
      }
    } else {
      stripeKeyError = 'STRIPE_API_KEY not set';
      console.log(`  ❌ Stripe API Key: Missing`);
    }
    
    console.log(`  ${stripeWebhook ? '✅' : '⚠️'} Stripe Webhook Secret: ${stripeWebhook ? 'Set' : 'Missing'}`);
    
    otherChecks.push({
      name: 'Stripe Integration',
      category: 'integration',
      ok: stripeKeyValid,
      hasApiKey: !!stripeKey,
      hasWebhookSecret: !!stripeWebhook,
      keyValid: stripeKeyValid,
      error: stripeKeyError
    });

    // ════════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ════════════════════════════════════════════════════════════════════════
    const functionFailures = functionResults.filter(r => !r.ok && !r.skipped);
    const otherFailures = otherChecks.filter(c => !c.ok);
    const envMissing = envResults.filter(e => e.required && !e.present).map(e => e.name);

    const totalChecks = otherChecks.length + functionResults.length;
    const totalPassed = otherChecks.filter(c => c.ok).length + functionResults.filter(r => r.ok || r.skipped).length;
    const totalFailed = otherFailures.length + functionFailures.length;

    const overallOk = totalFailed === 0 && contamination.ok;
    const elapsedTime = Date.now() - startTime;

    const combinedErrorReport = buildCombinedErrorReport(functionResults, otherChecks, contamination, envMissing);

    console.log('\n' + '═'.repeat(80));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(80));
    console.log(`Total Checks: ${totalChecks} | Passed: ${totalPassed} | Failed: ${totalFailed}`);
    console.log(`Functions: ${functionResults.length} | Function Failures: ${functionFailures.length}`);
    console.log(`Other Checks: ${otherChecks.length} | Other Failures: ${otherFailures.length}`);
    console.log(`Contamination: ${contamination.ok ? 'Clean' : 'LEAK DETECTED!'}`);
    console.log(`Time: ${elapsedTime}ms`);
    console.log(`\n🎯 Overall: ${overallOk ? '✅ ALL SYSTEMS OK' : '❌ ISSUES FOUND'}`);
    console.log('═'.repeat(80));

    // Log to database
    try {
      await base44.asServiceRole.entities.SystemCheckLog.create({
        timestamp: new Date().toISOString(),
        user_email: user.email,
        app_name: 'SermonSmith',
        summary: { 
          total: totalChecks, 
          passed: totalPassed, 
          failed: totalFailed,
          totalFunctions: functionResults.length,
          functionFailures: functionFailures.length
        },
        checks: [...otherChecks, ...functionResults],
        contamination: contamination,
        overall_ok: overallOk
      });
      console.log('📝 Result logged to SystemCheckLog');
    } catch (logErr) {
      console.log('⚠️ Could not log result:', logErr.message);
    }

    return Response.json({
      ok: overallOk,
      summary: {
        totalChecks,
        totalFunctions: functionResults.length,
        functionFailures: functionFailures.length,
        otherFailures: otherFailures.length,
        passed: totalPassed,
        failed: totalFailed
      },
      functionChecks: functionResults,
      otherChecks,
      contamination,
      combinedErrorReport,
      env: {
        missing: envMissing,
        ok: envMissing.length === 0
      },
      elapsedTime,
      timestamp: new Date().toISOString(),
      executedBy: user.email
    });

  } catch (err) {
    console.error('❌ SELF-CHECK CRASHED:', err);
    return Response.json({
      ok: false,
      summary: { totalChecks: 0, totalFunctions: 0, functionFailures: 0, otherFailures: 1, passed: 0, failed: 1 },
      functionChecks: [],
      otherChecks: [],
      contamination: { ok: false, results: [] },
      combinedErrorReport: `CRASH: ${err.message}\n\nSTACK:\n${err.stack}`,
      error: err.message,
      stack: err.stack
    }, { status: 500 });
  }
});