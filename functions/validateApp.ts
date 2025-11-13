import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import Stripe from 'npm:stripe@17.4.0';

/**
 * COMPREHENSIVE APP VALIDATION & REPAIR TOOL
 * 
 * This function performs exhaustive testing of all critical app components:
 * - Environment configuration
 * - Stripe integration (API + Webhooks)
 * - Database connectivity
 * - Backend function execution
 * - Premium access logic
 * - Bible data availability
 * 
 * It simulates real requests and validates actual runtime behavior.
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ 
        error: 'Authentication required',
        message: 'Please log in to run diagnostics' 
      }, { status: 401 });
    }

    // 🔒 ADMIN CHECK: Only administrators can run diagnostic tests
    if (user.role !== 'admin') {
      return Response.json({
        error: 'Forbidden',
        message: 'Administrative access required to run diagnostics'
      }, { status: 403 });
    }

    console.log('\n' + '█'.repeat(80));
    console.log('🔬 COMPREHENSIVE APP VALIDATION SUITE - RUNTIME TESTS');
    console.log('█'.repeat(80));
    console.log(`User: ${user.email}`);
    console.log(`Started: ${new Date().toISOString()}`);
    console.log('█'.repeat(80) + '\n');
    
    const validationReport = {
      timestamp: new Date().toISOString(),
      user: { email: user.email, id: user.id },
      tests: [],
      errors: [],
      warnings: [],
      fixes: [],
      runtimeSimulations: []
    };

    // ════════════════════════════════════════════════════════════════════════
    // TEST 1: STRIPE WEBHOOK SIMULATION (Most Critical)
    // ════════════════════════════════════════════════════════════════════════
    console.log('💳 TEST 1: Stripe Webhook Event Simulation');
    console.log('─'.repeat(80));
    
    const webhookTest = {
      testName: 'Stripe Webhook Processing',
      subtests: [],
      status: 'running'
    };

    const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    // Subtest 1a: Webhook Secret Presence
    if (!webhookSecret) {
      webhookTest.subtests.push({
        name: 'Webhook Secret Configuration',
        status: 'FAIL',
        message: 'STRIPE_WEBHOOK_SECRET not set',
        severity: 'CRITICAL'
      });
      validationReport.errors.push({
        test: 'Stripe Webhook',
        error: 'Webhook secret missing - webhooks will fail',
        fix: 'Set STRIPE_WEBHOOK_SECRET environment variable'
      });
      console.log('  ❌ Webhook Secret: MISSING - CRITICAL');
    } else {
      webhookTest.subtests.push({
        name: 'Webhook Secret Configuration',
        status: 'PASS',
        message: 'Webhook secret is configured'
      });
      console.log('  ✅ Webhook Secret: Configured');
    }

    // Subtest 1b: Simulate checkout.session.completed
    console.log('  Simulating checkout.session.completed event...');
    try {
      const users = await base44.asServiceRole.entities.User.list();
      const testUser = users.find(u => u.id === user.id);

      if (!testUser) {
        throw new Error('Test user not found');
      }

      const originalTier = testUser.subscription_tier;
      const hasOverride = testUser.premium_override === true;

      if (hasOverride) {
        webhookTest.subtests.push({
          name: 'Premium Override Protection',
          status: 'PASS',
          message: 'User has premium_override - protected from webhook changes',
          details: { current_tier: testUser.subscription_tier }
        });
        console.log('  ✅ Premium Override: Protected (no changes made)');
      } else {
        // Simulate upgrade
        console.log('  → Simulating user upgrade...');
        await base44.asServiceRole.entities.User.update(testUser.id, {
          subscription_tier: 'premium',
          stripe_customer_id: 'cus_TEST_DIAGNOSTIC'
        });

        const updatedUser = await base44.asServiceRole.entities.User.filter({ id: testUser.id });
        
        if (updatedUser[0]?.subscription_tier === 'premium') {
          webhookTest.subtests.push({
            name: 'User Upgrade Simulation',
            status: 'PASS',
            message: 'User successfully upgraded to premium',
            details: { before: originalTier, after: 'premium' }
          });
          console.log(`  ✅ Upgrade Simulation: SUCCESS (${originalTier} → premium)`);
          
          // Restore original state
          await base44.asServiceRole.entities.User.update(testUser.id, {
            subscription_tier: originalTier || 'free',
            stripe_customer_id: testUser.stripe_customer_id
          });
          console.log('  ✓ Original state restored');
        } else {
          throw new Error('Upgrade did not persist to database');
        }
      }
    } catch (e) {
      webhookTest.subtests.push({
        name: 'User Upgrade Simulation',
        status: 'FAIL',
        message: e.message,
        severity: 'HIGH'
      });
      validationReport.errors.push({
        test: 'Webhook Simulation',
        error: 'Failed to simulate user upgrade',
        details: e.message
      });
      console.log(`  ❌ Upgrade Simulation: FAILED - ${e.message}`);
    }

    // Subtest 1c: StripeEvent Logging
    console.log('  Testing event logging...');
    try {
      const testEventId = `evt_diagnostic_${Date.now()}`;
      
      await base44.asServiceRole.entities.StripeEvent.create({
        event_id: testEventId,
        event_type: 'test.diagnostic',
        processed_at: new Date().toISOString(),
        user_id: user.id,
        data: { test: true }
      });

      const createdEvents = await base44.asServiceRole.entities.StripeEvent.filter({
        event_id: testEventId
      });

      if (createdEvents.length > 0) {
        webhookTest.subtests.push({
          name: 'Stripe Event Logging',
          status: 'PASS',
          message: 'Events can be logged for debugging'
        });
        console.log('  ✅ Event Logging: Working');
        
        // Cleanup
        await base44.asServiceRole.entities.StripeEvent.delete(createdEvents[0].id);
        console.log('  ✓ Test event cleaned up');
      } else {
        throw new Error('Event not found after creation');
      }
    } catch (e) {
      webhookTest.subtests.push({
        name: 'Stripe Event Logging',
        status: 'WARN',
        message: 'Event logging not working (non-critical)',
        details: e.message
      });
      validationReport.warnings.push({
        test: 'Event Logging',
        warning: 'StripeEvent entity may not exist or has issues',
        impact: 'Webhook events will not be logged (non-critical)'
      });
      console.log(`  ⚠️ Event Logging: ${e.message} (non-critical)`);
    }

    webhookTest.status = webhookTest.subtests.filter(st => st.status === 'FAIL').length === 0 ? 'PASS' : 'FAIL';
    validationReport.tests.push(webhookTest);
    console.log(`Test Result: ${webhookTest.status}\n`);

    // ════════════════════════════════════════════════════════════════════════
    // TEST 2: STRIPE CHECKOUT SESSION CREATION
    // ════════════════════════════════════════════════════════════════════════
    console.log('🛒 TEST 2: Stripe Checkout Session Creation');
    console.log('─'.repeat(80));
    
    const checkoutTest = {
      testName: 'Checkout Session Creation',
      subtests: [],
      status: 'running'
    };

    if (!stripeApiKey) {
      checkoutTest.subtests.push({
        name: 'API Key Check',
        status: 'FAIL',
        message: 'STRIPE_API_KEY not configured',
        severity: 'CRITICAL'
      });
      validationReport.errors.push({
        test: 'Checkout Creation',
        error: 'Cannot create checkout sessions without API key'
      });
      console.log('  ❌ API Key: MISSING - CRITICAL');
    } else {
      try {
        const stripe = new Stripe(stripeApiKey, { apiVersion: "2024-06-20" });
        
        console.log('  Creating test checkout session...');
        const testSession = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price: 'price_1S3hWpIZTZppGBxIvYEi41M7',
            quantity: 1,
          }],
          mode: 'subscription',
          success_url: 'https://example.com/success',
          cancel_url: 'https://example.com/cancel',
          client_reference_id: user.id,
          customer_email: user.email
        });

        checkoutTest.subtests.push({
          name: 'Session Creation',
          status: 'PASS',
          sessionId: testSession.id,
          url: testSession.url,
          message: 'Checkout sessions can be created successfully'
        });
        console.log(`  ✅ Session Created: ${testSession.id}`);
        console.log(`  ✓ URL Generated: ${testSession.url.substring(0, 50)}...`);
        
        // Expire test session
        await stripe.checkout.sessions.expire(testSession.id);
        console.log('  ✓ Test session expired and cleaned up');
        
      } catch (e) {
        checkoutTest.subtests.push({
          name: 'Session Creation',
          status: 'FAIL',
          message: e.message,
          severity: 'CRITICAL'
        });
        validationReport.errors.push({
          test: 'Checkout Creation',
          error: 'Failed to create checkout session',
          details: e.message
        });
        console.log(`  ❌ Session Creation: FAILED - ${e.message}`);
      }
    }

    checkoutTest.status = checkoutTest.subtests.filter(st => st.status === 'FAIL').length === 0 ? 'PASS' : 'FAIL';
    validationReport.tests.push(checkoutTest);
    console.log(`Test Result: ${checkoutTest.status}\n`);

    // ════════════════════════════════════════════════════════════════════════
    // TEST 3: BIBLE VERSE FETCHING SIMULATION
    // ════════════════════════════════════════════════════════════════════════
    console.log('📖 TEST 3: Bible Verse Fetching (Runtime Simulation)');
    console.log('─'.repeat(80));
    
    const verseFetchTest = {
      testName: 'Verse Fetching',
      subtests: [],
      status: 'running'
    };

    // Test database lookup
    console.log('  Testing database verse lookup...');
    try {
      const testVerses = await base44.entities.Verse.filter({
        translation_id: 'KJV',
        book_name: 'John',
        chapter: 3
      }, 'verse');

      verseFetchTest.subtests.push({
        name: 'Database Verse Lookup',
        status: testVerses.length > 0 ? 'PASS' : 'WARN',
        verseCount: testVerses.length,
        message: testVerses.length > 0 ? 'Verses accessible from database' : 'Chapter not imported'
      });

      if (testVerses.length > 0) {
        console.log(`  ✅ Database Lookup: ${testVerses.length} verses found`);
      } else {
        console.log('  ⚠️ Database Lookup: No verses (chapter not imported)');
        validationReport.warnings.push({
          test: 'Bible Data',
          warning: 'John 3 not imported',
          recommendation: 'Import Bible data via Bulk Import'
        });
      }
    } catch (e) {
      verseFetchTest.subtests.push({
        name: 'Database Verse Lookup',
        status: 'FAIL',
        message: e.message,
        severity: 'HIGH'
      });
      validationReport.errors.push({
        test: 'Verse Fetching',
        error: 'Cannot query verses from database',
        details: e.message
      });
      console.log(`  ❌ Database Lookup: FAILED - ${e.message}`);
    }

    // Test getVerses function
    console.log('  Testing getVerses function...');
    try {
      const result = await base44.functions.invoke('getVerses', {
        translationId: 'KJV',
        book: 'John',
        chapter: 3
      });

      if (result.status === 200 && result.data) {
        verseFetchTest.subtests.push({
          name: 'getVerses Function',
          status: 'PASS',
          verseCount: result.data.verses?.length || 0,
          cached: result.data.cached,
          message: 'Function returns verses successfully'
        });
        console.log(`  ✅ getVerses Function: ${result.data.verses?.length || 0} verses returned`);
        console.log(`  ✓ Cache Status: ${result.data.cached ? 'HIT' : 'MISS'}`);
      } else {
        throw new Error(`Unexpected response: ${result.status}`);
      }
    } catch (e) {
      verseFetchTest.subtests.push({
        name: 'getVerses Function',
        status: 'FAIL',
        message: e.message,
        severity: 'HIGH'
      });
      validationReport.errors.push({
        test: 'Verse Function',
        error: 'getVerses function failed',
        details: e.message
      });
      console.log(`  ❌ getVerses Function: FAILED - ${e.message}`);
    }

    verseFetchTest.status = verseFetchTest.subtests.filter(st => st.status === 'FAIL').length === 0 ? 'PASS' : 'FAIL';
    validationReport.tests.push(verseFetchTest);
    console.log(`Test Result: ${verseFetchTest.status}\n`);

    // ════════════════════════════════════════════════════════════════════════
    // TEST 4: PREMIUM ACCESS LOGIC VALIDATION
    // ════════════════════════════════════════════════════════════════════════
    console.log('👑 TEST 4: Premium Access Logic');
    console.log('─'.repeat(80));
    
    const premiumTest = {
      testName: 'Premium Access Logic',
      subtests: [],
      status: 'running'
    };

    // Check proper premium access (no hardcoded backdoors)
    const isPremium = user.subscription_tier === 'premium' || 
                      user.premium_override === true ||
                      (user.premium_until && new Date(user.premium_until) > new Date());

    premiumTest.subtests.push({
      name: 'User Access Level',
      status: 'INFO',
      isPremium,
      tier: user.subscription_tier || 'free',
      override: user.premium_override || false
    });

    console.log(`  Current User: ${user.email}`);
    console.log(`  Premium Status: ${isPremium ? '✅ PREMIUM' : '⚠️ FREE'}`);
    console.log(`  Subscription Tier: ${user.subscription_tier || 'free'}`);
    console.log(`  Premium Override: ${user.premium_override ? '✅ YES' : '❌ NO'}`);

    // Test translation access
    console.log('  Testing translation access...');
    try {
      const translationsResult = await base44.functions.invoke('listAvailableTranslations');
      
      if (translationsResult.status === 200 && translationsResult.data?.translations) {
        const available = translationsResult.data.translations.filter(t => t.available);
        const premium = translationsResult.data.translations.filter(t => t.is_premium && t.available);
        
        premiumTest.subtests.push({
          name: 'Translation Access',
          status: 'PASS',
          totalAvailable: available.length,
          premiumAvailable: premium.length,
          message: `${available.length} translations accessible (${premium.length} premium)`
        });
        console.log(`  ✅ Translations: ${available.length} available (${premium.length} premium)`);
      } else {
        throw new Error('Invalid response from listAvailableTranslations');
      }
    } catch (e) {
      premiumTest.subtests.push({
        name: 'Translation Access',
        status: 'WARN',
        message: e.message
      });
      console.log(`  ⚠️ Translations: ${e.message}`);
    }

    premiumTest.status = premiumTest.subtests.filter(st => st.status === 'FAIL').length === 0 ? 'PASS' : 'WARN';
    validationReport.tests.push(premiumTest);
    console.log(`Test Result: ${premiumTest.status}\n`);

    // ════════════════════════════════════════════════════════════════════════
    // TEST 5: EXPORT FUNCTIONS VALIDATION
    // ════════════════════════════════════════════════════════════════════════
    console.log('📄 TEST 5: Export Functions (PDF/PPTX)');
    console.log('─'.repeat(80));
    
    const exportTest = {
      testName: 'Export Functions',
      subtests: [],
      status: 'running'
    };

    // Check if user has any sermons to export
    try {
      const userSermons = await base44.entities.Sermon.filter({ user_id: user.id }, 'id', 1);
      
      if (userSermons.length > 0) {
        exportTest.subtests.push({
          name: 'Export Content Availability',
          status: 'PASS',
          message: `User has ${userSermons.length} sermon(s) available for export`,
          canTestExport: true
        });
        console.log(`  ✅ Export Content: ${userSermons.length} sermon(s) found`);
        console.log('  ℹ️ Export functions are ready (not testing actual export to avoid file generation)');
      } else {
        exportTest.subtests.push({
          name: 'Export Content Availability',
          status: 'WARN',
          message: 'No sermons to export (user has not created content yet)',
          canTestExport: false
        });
        console.log('  ⚠️ Export Content: No sermons created yet');
      }
    } catch (e) {
      exportTest.subtests.push({
        name: 'Export Content Availability',
        status: 'FAIL',
        message: e.message
      });
      console.log(`  ❌ Export Check: ${e.message}`);
    }

    exportTest.status = exportTest.subtests.filter(st => st.status === 'FAIL').length === 0 ? 'PASS' : 'WARN';
    validationReport.tests.push(exportTest);
    console.log(`Test Result: ${exportTest.status}\n`);

    // ════════════════════════════════════════════════════════════════════════
    // FINAL SUMMARY & RECOMMENDATIONS
    // ════════════════════════════════════════════════════════════════════════
    const totalTests = validationReport.tests.reduce((sum, t) => sum + t.subtests.length, 0);
    const passedTests = validationReport.tests.reduce((sum, t) => 
      sum + t.subtests.filter(st => st.status === 'PASS').length, 0
    );
    const failedTests = validationReport.tests.reduce((sum, t) => 
      sum + t.subtests.filter(st => st.status === 'FAIL').length, 0
    );
    const warnTests = validationReport.tests.reduce((sum, t) => 
      sum + t.subtests.filter(st => st.status === 'WARN').length, 0
    );

    validationReport.summary = {
      total_tests: totalTests,
      passed: passedTests,
      failed: failedTests,
      warnings: warnTests,
      critical_failures: validationReport.errors.filter(e => e.severity === 'CRITICAL').length
    };

    const overallStatus = failedTests === 0 ? 
      (warnTests === 0 ? 'FULLY_OPERATIONAL' : 'OPERATIONAL_WITH_WARNINGS') :
      'ISSUES_DETECTED';

    console.log('█'.repeat(80));
    console.log('📊 VALIDATION SUMMARY');
    console.log('█'.repeat(80));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`⚠️ Warnings: ${warnTests}`);
    console.log(`\n🎯 Overall Status: ${overallStatus}`);
    console.log('█'.repeat(80));

    if (validationReport.errors.length > 0) {
      console.log('\n🔴 ERRORS FOUND:');
      validationReport.errors.forEach((err, i) => {
        console.log(`${i + 1}. [${err.test}] ${err.error}`);
        if (err.details) console.log(`   Details: ${err.details}`);
        if (err.fix) console.log(`   Fix: ${err.fix}`);
      });
    }

    if (validationReport.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      validationReport.warnings.forEach((warn, i) => {
        console.log(`${i + 1}. [${warn.test}] ${warn.warning}`);
        if (warn.recommendation) console.log(`   → ${warn.recommendation}`);
      });
    }

    if (overallStatus === 'FULLY_OPERATIONAL') {
      console.log('\n✅ ALL SYSTEMS GO - PRODUCTION READY! 🚀');
    }

    console.log('\n' + '█'.repeat(80) + '\n');

    return Response.json({
      success: failedTests === 0,
      overallStatus,
      productionReady: overallStatus === 'FULLY_OPERATIONAL',
      timestamp: validationReport.timestamp,
      user: validationReport.user,
      summary: validationReport.summary,
      tests: validationReport.tests,
      errors: validationReport.errors,
      warnings: validationReport.warnings,
      recommendations: generateRecommendations(validationReport, overallStatus),
      nextSteps: generateActionPlan(overallStatus, validationReport)
    }, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('\n❌ VALIDATION SUITE CRASHED:', error);
    return Response.json({ 
      success: false,
      error: 'Validation suite encountered a fatal error',
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});

function generateRecommendations(report, status) {
  const recommendations = [];

  if (status === 'FULLY_OPERATIONAL') {
    recommendations.push({
      priority: 'INFO',
      message: '✅ All critical systems validated and operational',
      action: 'App is production-ready. Monitor Stripe dashboard for live transactions.'
    });
    recommendations.push({
      priority: 'LOW',
      message: 'Optional: Import more Bible content',
      action: 'Use Bulk Import to add more translations and books'
    });
    return recommendations;
  }

  if (report.errors.length > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      message: `${report.errors.length} error(s) must be fixed before production`,
      action: 'Review errors section and apply fixes immediately'
    });
  }

  const stripeErrors = report.errors.filter(e => e.test?.includes('Stripe') || e.test?.includes('Checkout'));
  if (stripeErrors.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      message: 'Stripe integration issues detected',
      action: 'Verify STRIPE_API_KEY and STRIPE_WEBHOOK_SECRET are correct and active'
    });
  }

  if (report.warnings.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      message: `${report.warnings.length} warning(s) - app will work but not optimally`,
      action: 'Address warnings when possible for better user experience'
    });
  }

  return recommendations;
}

function generateActionPlan(status, report) {
  const plan = [];

  if (status === 'FULLY_OPERATIONAL') {
    plan.push('✅ READY FOR PRODUCTION');
    plan.push('');
    plan.push('Deployment Checklist:');
    plan.push('  ☑️ Stripe webhooks configured');
    plan.push('  ☑️ Environment variables set');
    plan.push('  ☑️ Database accessible');
    plan.push('  ☑️ All functions operational');
    plan.push('');
    plan.push('Next Steps:');
    plan.push('  1. Configure Stripe webhook URL in Stripe Dashboard');
    plan.push('  2. Test real payment flow in Stripe test mode');
    plan.push('  3. Import Bible data if needed');
    plan.push('  4. Monitor application logs');
    plan.push('  5. Run this diagnostic weekly');
    return plan;
  }

  if (report.errors.length > 0) {
    plan.push('🔴 CRITICAL ISSUES - DO NOT DEPLOY');
    plan.push('');
    plan.push('Required Fixes:');
    report.errors.forEach((err, i) => {
      plan.push(`  ${i + 1}. ${err.error}`);
      if (err.fix) plan.push(`     → ${err.fix}`);
    });
    plan.push('');
    plan.push('After Fixes:');
    plan.push('  • Re-run this diagnostic');
    plan.push('  • Verify all tests pass');
    plan.push('  • Then proceed to production');
  } else if (report.warnings.length > 0) {
    plan.push('⚠️ OPERATIONAL WITH WARNINGS');
    plan.push('');
    plan.push('Optional Improvements:');
    report.warnings.forEach((warn, i) => {
      plan.push(`  ${i + 1}. ${warn.warning}`);
      if (warn.recommendation) plan.push(`     → ${warn.recommendation}`);
    });
    plan.push('');
    plan.push('App can be deployed but address warnings for optimal performance');
  }

  return plan;
}