import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * TEST ALL FUNCTIONS - Heavyweight Function Tester
 * 
 * 1. Discovers all functions via findAllFunctions
 * 2. Loads test payloads from FunctionTestPayload entity
 * 3. Runs each function with its required payload
 * 4. Captures all failures with full error details
 * 5. Enriches failures with code snippets
 * 6. Returns unified failure report
 */

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

    console.log('═'.repeat(60));
    console.log('🔬 HEAVYWEIGHT FUNCTION TESTER v1.0');
    console.log('═'.repeat(60));

    // Step 1: Discover all functions
    console.log('\n📡 Step 1: Discovering functions...');
    
    let functions = [];
    try {
      const discoveryResponse = await base44.functions.invoke('findAllFunctions', {});
      
      if (!discoveryResponse.data?.ok) {
        return Response.json({
          ok: false,
          error: `Function discovery failed: ${discoveryResponse.data?.error || 'Unknown error'}`,
          data: {
            checked: 0,
            failed: 1,
            failures: [{
              functionId: 'findAllFunctions',
              filePath: 'functions/findAllFunctions.js',
              payload: {},
              errorMessage: discoveryResponse.data?.error || 'Discovery failed',
              rawOutput: discoveryResponse.data,
              stack: null,
              codeSnippet: '// Function discovery failed'
            }]
          }
        });
      }
      
      functions = discoveryResponse.data?.data?.functions || [];
      console.log(`  Found ${functions.length} functions`);
      
    } catch (err) {
      return Response.json({
        ok: false,
        error: `Function discovery crashed: ${err.message}`,
        data: {
          checked: 0,
          failed: 1,
          failures: [{
            functionId: 'findAllFunctions',
            filePath: 'functions/findAllFunctions.js',
            payload: {},
            errorMessage: err.message,
            rawOutput: null,
            stack: err.stack,
            codeSnippet: '// Function discovery crashed'
          }]
        }
      });
    }

    // Step 2: Load test payloads
    console.log('\n📦 Step 2: Loading test payloads...');
    
    let testPayloads = [];
    try {
      testPayloads = await base44.asServiceRole.entities.FunctionTestPayload.list();
      console.log(`  Loaded ${testPayloads.length} test payloads`);
    } catch (err) {
      console.log(`  Warning: Could not load payloads: ${err.message}`);
    }

    // Create payload lookup map
    const payloadMap = {};
    for (const tp of testPayloads) {
      payloadMap[tp.function_id] = tp.payload;
    }

    // Step 3: Test each function
    console.log('\n⚡ Step 3: Running function tests...');
    
    const failures = [];
    const results = [];
    
    // Skip these functions during testing (they're system functions or webhooks)
    const SKIP_FUNCTIONS = [
      'findAllFunctions',
      'testAllFunctions', 
      'getCodeSnippet',
      'stripe-webhook'  // Requires Stripe signature
    ];

    for (const fn of functions) {
      const fnId = fn.id;
      
      // Skip system functions
      if (SKIP_FUNCTIONS.includes(fnId)) {
        console.log(`  ⏭️ ${fnId}: Skipped (system function)`);
        results.push({ functionId: fnId, status: 'skipped', reason: 'System function' });
        continue;
      }
      
      // Check for test payload
      const payload = payloadMap[fnId];
      
      if (!payload) {
        console.log(`  ❌ ${fnId}: No test payload defined`);
        failures.push({
          functionId: fnId,
          filePath: fn.filePath,
          payload: null,
          errorMessage: `No FunctionTestPayload defined for function_id="${fnId}"`,
          rawOutput: null,
          stack: null,
          codeSnippet: null
        });
        continue;
      }

      // Run the function
      let output = null;
      let thrown = null;
      const fnStartTime = Date.now();

      try {
        const response = await base44.functions.invoke(fnId, payload);
        output = response.data;
      } catch (err) {
        thrown = err;
      }

      const responseTime = Date.now() - fnStartTime;

      // Check for failure conditions
      let failed = false;
      let errorMessage = null;

      if (thrown) {
        failed = true;
        errorMessage = thrown.message;
      } else if (output === undefined || output === null) {
        failed = true;
        errorMessage = 'Function returned undefined or null';
      } else if (typeof output !== 'object') {
        failed = true;
        errorMessage = `Function returned non-object: ${typeof output}`;
      } else if (output.ok === false) {
        failed = true;
        errorMessage = output.error || 'Function returned ok:false';
      } else if (output.error) {
        failed = true;
        errorMessage = output.error;
      }

      if (failed) {
        console.log(`  ❌ ${fnId}: ${errorMessage} (${responseTime}ms)`);
        failures.push({
          functionId: fnId,
          filePath: fn.filePath,
          payload,
          errorMessage,
          rawOutput: output,
          stack: thrown?.stack || null,
          codeSnippet: null
        });
      } else {
        console.log(`  ✅ ${fnId}: OK (${responseTime}ms)`);
        results.push({ functionId: fnId, status: 'passed', responseTime });
      }
    }

    // Step 4: Enrich failures with code snippets
    console.log('\n📝 Step 4: Extracting code snippets...');
    
    for (const failure of failures) {
      if (failure.filePath) {
        try {
          const snippetResponse = await base44.functions.invoke('getCodeSnippet', {
            filePath: failure.filePath,
            stack: failure.stack
          });
          
          if (snippetResponse.data?.ok) {
            failure.codeSnippet = snippetResponse.data?.data?.snippet || null;
          }
        } catch (err) {
          console.log(`  Warning: Could not get snippet for ${failure.filePath}`);
          failure.codeSnippet = `// Could not extract code: ${err.message}`;
        }
      }
    }

    // Step 5: Build final report
    const checked = functions.length;
    const skipped = SKIP_FUNCTIONS.filter(id => functions.some(f => f.id === id)).length;
    const failed = failures.length;
    const passed = checked - failed - skipped;
    const elapsedTime = Date.now() - startTime;

    console.log('\n' + '═'.repeat(60));
    console.log(`🎯 RESULTS: ${failed === 0 ? '✅ ALL PASSED' : `❌ ${failed} FAILED`}`);
    console.log(`   Checked: ${checked} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
    console.log(`   Duration: ${elapsedTime}ms`);

    return Response.json({
      ok: failed === 0,
      error: failed > 0 ? `${failed} function(s) failed.` : null,
      data: {
        checked,
        passed,
        failed,
        skipped,
        elapsedTime,
        failures,
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('❌ TEST RUNNER CRASHED:', err);
    return Response.json({
      ok: false,
      error: err?.message ?? 'Unknown error',
      data: {
        checked: 0,
        failed: 1,
        failures: [{
          functionId: 'testAllFunctions',
          filePath: 'functions/testAllFunctions.js',
          payload: null,
          errorMessage: err?.message ?? 'Test runner crashed',
          rawOutput: null,
          stack: err?.stack || null,
          codeSnippet: '// Test runner crashed unexpectedly'
        }]
      }
    });
  }
});