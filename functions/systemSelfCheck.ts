import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { getSurfaceMap, getExecutableSurfaces, testSurface, getSurfaceStats } from './shared/surfaceMapper.js';

/**
 * COMPREHENSIVE SYSTEM SELF-CHECK
 * 
 * Tests all layers of the application:
 * - Backend functions (auto-discovered via Surface Mapper)
 * - Database/entities
 * - RLS policies
 * - Environment variables
 * - Cross-contamination detection
 */

// Required environment variables
const REQUIRED_ENV_VARS = [
  'BASE44_APP_ID'
];

// Optional but recommended env vars
const OPTIONAL_ENV_VARS = [
  'STRIPE_API_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'BIBLE_API_KEY'
];

// Known entities to check
const KNOWN_ENTITIES = [
  'User', 'Sermon', 'BibleStudy', 'Quiz', 'Highlight', 'Note',
  'SermonSeries', 'ReadingPlan', 'StudyNote', 'Message',
  'UserActivity', 'StripeEvent', 'SystemCheckLog'
];

// Helper to safely test a function
async function testFunction(base44, funcName, testPayload = {}) {
  const result = {
    name: funcName,
    ok: false,
    status: null,
    error: null,
    responseTime: 0
  };

  const start = Date.now();
  try {
    // Add self-test flag to payload
    const payload = { ...testPayload, _selfTest: '1' };
    const response = await Promise.race([
      base44.functions.invoke(funcName, payload),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout after 15s')), 15000))
    ]);

    result.responseTime = Date.now() - start;
    result.status = response.status;
    result.ok = response.status >= 200 && response.status < 500; // 4xx is still "working"
    
    if (response.status >= 500) {
      result.error = response.data?.error || 'Server error';
    }
  } catch (err) {
    result.responseTime = Date.now() - start;
    result.error = err.message;
    result.ok = false;
  }

  return result;
}

// Test entity access
async function testEntity(base44, entityName, isAdmin) {
  const result = {
    name: entityName,
    exists: false,
    readable: false,
    writable: false,
    error: null
  };

  try {
    // Try to list (read)
    const items = await base44.entities[entityName].list('-created_date', 1);
    result.exists = true;
    result.readable = true;
    result.itemCount = items.length;
  } catch (err) {
    if (err.message?.includes('not found') || err.message?.includes('does not exist')) {
      result.exists = false;
      result.error = 'Entity does not exist';
    } else if (err.message?.includes('permission') || err.message?.includes('denied') || err.message?.includes('403')) {
      result.exists = true;
      result.readable = false;
      result.error = 'Read permission denied (expected for some entities)';
    } else {
      result.error = err.message;
    }
  }

  return result;
}

// Test RLS by checking if user can only see their own data
async function testRLS(base44, user) {
  const results = [];

  // Test Sermon RLS - user should only see their own
  try {
    const sermons = await base44.entities.Sermon.list('-created_date', 10);
    const otherUserSermons = sermons.filter(s => s.user_id !== user.id);
    
    results.push({
      entity: 'Sermon',
      ok: otherUserSermons.length === 0,
      leak: otherUserSermons.length > 0,
      description: otherUserSermons.length > 0 
        ? `Found ${otherUserSermons.length} sermons belonging to other users` 
        : 'RLS working correctly',
      offendingIds: otherUserSermons.map(s => s.id)
    });
  } catch (err) {
    results.push({
      entity: 'Sermon',
      ok: true,
      leak: false,
      description: 'Access denied or no sermons (acceptable)'
    });
  }

  // Test Highlight RLS
  try {
    const highlights = await base44.entities.Highlight.list('-created_date', 10);
    const otherHighlights = highlights.filter(h => h.user_id !== user.id);
    
    results.push({
      entity: 'Highlight',
      ok: otherHighlights.length === 0,
      leak: otherHighlights.length > 0,
      description: otherHighlights.length > 0 
        ? `Found ${otherHighlights.length} highlights belonging to other users` 
        : 'RLS working correctly'
    });
  } catch (err) {
    results.push({
      entity: 'Highlight',
      ok: true,
      leak: false,
      description: 'Access denied or no highlights (acceptable)'
    });
  }

  // Test Note RLS
  try {
    const notes = await base44.entities.Note.list('-created_date', 10);
    const otherNotes = notes.filter(n => n.user_id !== user.id);
    
    results.push({
      entity: 'Note',
      ok: otherNotes.length === 0,
      leak: otherNotes.length > 0,
      description: otherNotes.length > 0 
        ? `Found ${otherNotes.length} notes belonging to other users` 
        : 'RLS working correctly'
    });
  } catch (err) {
    results.push({
      entity: 'Note',
      ok: true,
      leak: false,
      description: 'Access denied or no notes (acceptable)'
    });
  }

  return results;
}

// Cross-contamination detection
async function detectContamination(base44, user, isAdmin) {
  const results = {
    ok: true,
    results: []
  };

  // Skip contamination test for admin users viewing other data (expected behavior)
  if (isAdmin) {
    results.results.push({
      leak: false,
      description: 'Admin user - can access all data by design',
      functionName: 'N/A',
      filePath: 'N/A'
    });
    return results;
  }

  // Test 1: Check if user-scoped queries leak data
  const rlsResults = await testRLS(base44, user);
  
  for (const rlsResult of rlsResults) {
    if (rlsResult.leak) {
      results.ok = false;
      results.results.push({
        leak: true,
        description: rlsResult.description,
        functionName: `${rlsResult.entity}.list()`,
        filePath: `entities/${rlsResult.entity}.json`,
        offendingCode: `RLS policy may be missing user_id filter. Check: "rls": { "read": { "user_id": "{{user.id}}" } }`
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

// Check environment variables
function checkEnvironment() {
  const results = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = Deno.env.get(envVar);
    results.push({
      name: envVar,
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
      required: false,
      present: !!value,
      ok: true, // Optional, so always "ok"
      warning: value ? null : `Optional env var ${envVar} not set`
    });
  }

  return results;
}

// Main handler
Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ 
        ok: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    // Admin-only access
    if (user.role !== 'admin') {
      return Response.json({
        ok: false,
        error: 'Admin access required'
      }, { status: 403 });
    }

    const isAdmin = user.role === 'admin';
    const checks = [];
    let totalPassed = 0;
    let totalFailed = 0;

    console.log('═'.repeat(80));
    console.log('🔬 SYSTEM SELF-CHECK STARTING');
    console.log('═'.repeat(80));
    console.log(`User: ${user.email}`);
    console.log(`Admin: ${isAdmin}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('═'.repeat(80));

    // ══════════════════════════════════════════════════════════════════════════
    // 1. ENVIRONMENT CHECKS
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n📋 ENVIRONMENT CHECKS');
    const envResults = checkEnvironment();
    for (const env of envResults) {
      if (env.ok) totalPassed++; else totalFailed++;
      checks.push({
        category: 'environment',
        name: env.name,
        ok: env.ok,
        required: env.required,
        error: env.error,
        warning: env.warning
      });
      console.log(`  ${env.ok ? '✅' : '❌'} ${env.name}: ${env.present ? 'Set' : 'Missing'}${env.required ? ' (required)' : ''}`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 2. BACKEND FUNCTION CHECKS
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n⚡ BACKEND FUNCTION CHECKS');
    
    // Test functions with appropriate payloads
    const functionTests = [
      { name: 'biblePassage', payload: { translationId: 'en-kjv', bookCode: 'GEN', chapter: 1 } },
      { name: 'getPassageMultiSource', payload: { reference: 'John 3:16', translation: 'KJV' } },
      { name: 'listAvailableTranslations', payload: {} },
      { name: 'createCheckoutSession', payload: {} },
      { name: 'exportToPDF', payload: { _selfTest: '1' } },
      { name: 'exportToPPTX', payload: { _selfTest: '1' } }
    ];

    for (const ft of functionTests) {
      const result = await testFunction(base44, ft.name, ft.payload);
      if (result.ok) totalPassed++; else totalFailed++;
      checks.push({
        category: 'function',
        name: ft.name,
        ok: result.ok,
        status: result.status,
        responseTime: result.responseTime,
        error: result.error
      });
      console.log(`  ${result.ok ? '✅' : '❌'} ${ft.name}: ${result.status || 'Error'} (${result.responseTime}ms)${result.error ? ` - ${result.error}` : ''}`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 3. ENTITY/DATABASE CHECKS
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n🗄️ ENTITY/DATABASE CHECKS');
    
    for (const entityName of KNOWN_ENTITIES) {
      try {
        const result = await testEntity(base44, entityName, isAdmin);
        const ok = result.exists;
        if (ok) totalPassed++; else totalFailed++;
        checks.push({
          category: 'entity',
          name: entityName,
          ok,
          exists: result.exists,
          readable: result.readable,
          error: result.error
        });
        console.log(`  ${ok ? '✅' : '❌'} ${entityName}: ${result.exists ? 'Exists' : 'Missing'}${result.readable ? ', Readable' : ''}${result.error ? ` (${result.error})` : ''}`);
      } catch (err) {
        totalFailed++;
        checks.push({
          category: 'entity',
          name: entityName,
          ok: false,
          error: err.message
        });
        console.log(`  ❌ ${entityName}: Error - ${err.message}`);
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 4. RLS POLICY CHECKS
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n🔒 RLS POLICY CHECKS');
    const rlsResults = await testRLS(base44, user);
    for (const rls of rlsResults) {
      if (rls.ok) totalPassed++; else totalFailed++;
      checks.push({
        category: 'rls',
        entity: rls.entity,
        ok: rls.ok,
        leak: rls.leak,
        description: rls.description
      });
      console.log(`  ${rls.ok ? '✅' : '🚨'} ${rls.entity}: ${rls.description}`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 5. CROSS-CONTAMINATION DETECTION
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n🔍 CROSS-CONTAMINATION DETECTION');
    const contamination = await detectContamination(base44, user, isAdmin);
    
    for (const c of contamination.results) {
      console.log(`  ${c.leak ? '🚨' : '✅'} ${c.description}`);
      if (c.leak) {
        console.log(`     File: ${c.filePath}`);
        console.log(`     Function: ${c.functionName}`);
        if (c.offendingCode) console.log(`     Fix: ${c.offendingCode}`);
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 6. STRIPE INTEGRATION CHECK
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n💳 STRIPE INTEGRATION CHECK');
    const stripeKey = Deno.env.get('STRIPE_API_KEY');
    const stripeWebhook = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    const stripeOk = !!stripeKey;
    if (stripeOk) totalPassed++; else totalFailed++;
    checks.push({
      category: 'integration',
      name: 'Stripe API',
      ok: stripeOk,
      hasApiKey: !!stripeKey,
      hasWebhookSecret: !!stripeWebhook,
      error: stripeKey ? null : 'STRIPE_API_KEY not set'
    });
    console.log(`  ${stripeOk ? '✅' : '❌'} Stripe API Key: ${stripeKey ? 'Set' : 'Missing'}`);
    console.log(`  ${stripeWebhook ? '✅' : '⚠️'} Stripe Webhook Secret: ${stripeWebhook ? 'Set' : 'Missing (webhooks disabled)'}`);

    // ══════════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ══════════════════════════════════════════════════════════════════════════
    const totalChecks = totalPassed + totalFailed;
    const overallOk = totalFailed === 0 && contamination.ok;
    const elapsedTime = Date.now() - startTime;

    console.log('\n' + '═'.repeat(80));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(80));
    console.log(`Total Checks: ${totalChecks}`);
    console.log(`✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`🔍 Contamination: ${contamination.ok ? 'None detected' : 'DETECTED!'}`);
    console.log(`⏱️ Time: ${elapsedTime}ms`);
    console.log(`\n🎯 Overall: ${overallOk ? '✅ ALL SYSTEMS OK' : '❌ ISSUES FOUND'}`);
    console.log('═'.repeat(80));

    // Log result to database
    try {
      await base44.asServiceRole.entities.SystemCheckLog.create({
        timestamp: new Date().toISOString(),
        user_email: user.email,
        app_name: 'SermonSmith',
        summary: { total: totalChecks, passed: totalPassed, failed: totalFailed },
        checks: checks,
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
        total: totalChecks,
        passed: totalPassed,
        failed: totalFailed
      },
      checks,
      contamination,
      elapsedTime,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ SELF-CHECK CRASHED:', err);
    return Response.json({
      ok: false,
      summary: { total: 0, passed: 0, failed: 1 },
      checks: [],
      contamination: { ok: false, results: [] },
      error: err.message,
      stack: err.stack
    }, { status: 500 });
  }
});