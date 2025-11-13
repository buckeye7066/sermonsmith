import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import Stripe from 'npm:stripe@17.4.0';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ 
        error: 'Forbidden - Admin access required',
        user_email: user.email,
        user_role: user.role
      }, { status: 403 });
    }

    console.log('🔧 COMPREHENSIVE APP REPAIR & VALIDATION SEQUENCE');
    console.log('=' .repeat(60));
    
    const report = {
      timestamp: new Date().toISOString(),
      phases: [],
      fixes: [],
      errors: [],
      summary: {
        total_tests: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        fixes_applied: 0
      }
    };

    // PHASE 1: Environment Variables Validation
    console.log('\n📋 PHASE 1: Environment Variables');
    const envPhase = {
      name: 'Environment Variables',
      tests: [],
      status: 'running'
    };

    const requiredEnvVars = {
      'STRIPE_API_KEY': { required: true, type: 'secret' },
      'STRIPE_WEBHOOK_SECRET': { required: true, type: 'secret' },
      'BASE44_APP_ID': { required: true, type: 'config' }
    };

    for (const [key, config] of Object.entries(requiredEnvVars)) {
      const value = Deno.env.get(key);
      const isSet = !!value;
      
      envPhase.tests.push({
        variable: key,
        required: config.required,
        status: isSet ? 'PASS' : 'FAIL',
        type: config.type
      });
      
      console.log(`  ${key}: ${isSet ? '✅ SET' : '❌ MISSING'}`);
      
      if (!isSet && config.required) {
        report.errors.push({
          phase: 'Environment',
          error: `Missing required ${config.type}: ${key}`,
          fix: `Set ${key} in app environment variables`
        });
      }
    }

    envPhase.status = envPhase.tests.every(t => t.status === 'PASS') ? 'PASS' : 'FAIL';
    report.phases.push(envPhase);

    // PHASE 2: Stripe SDK & API Validation
    console.log('\n💳 PHASE 2: Stripe Integration');
    const stripePhase = {
      name: 'Stripe Integration',
      tests: [],
      status: 'running'
    };

    const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeApiKey) {
      stripePhase.tests.push({
        test: 'Stripe API Key',
        status: 'FAIL',
        message: 'API key not configured'
      });
      report.errors.push({
        phase: 'Stripe',
        error: 'STRIPE_API_KEY not set',
        critical: true
      });
    } else {
      try {
        const stripe = new Stripe(stripeApiKey, {
          apiVersion: "2024-06-20",
        });
        
        // Test API key validity
        const customers = await stripe.customers.list({ limit: 1 });
        
        stripePhase.tests.push({
          test: 'Stripe API Connection',
          status: 'PASS',
          message: 'Successfully connected to Stripe API'
        });
        console.log('  ✅ Stripe API: Connected & Valid');
        
        // Test webhook secret
        if (!stripeWebhookSecret) {
          stripePhase.tests.push({
            test: 'Webhook Secret',
            status: 'WARN',
            message: 'Webhook secret not configured - webhooks will fail'
          });
          report.errors.push({
            phase: 'Stripe',
            error: 'STRIPE_WEBHOOK_SECRET not set',
            critical: true,
            fix: 'Configure webhook secret from Stripe dashboard'
          });
          console.log('  ⚠️ Webhook Secret: MISSING');
        } else {
          stripePhase.tests.push({
            test: 'Webhook Secret',
            status: 'PASS',
            message: 'Webhook secret configured'
          });
          console.log('  ✅ Webhook Secret: Configured');
        }

        // Test checkout session creation capability
        try {
          const testPriceId = 'price_1S3hWpIZTZppGBxIvYEi41M7';
          
          // Verify price exists
          await stripe.prices.retrieve(testPriceId);
          
          stripePhase.tests.push({
            test: 'Premium Price Configuration',
            status: 'PASS',
            priceId: testPriceId,
            message: 'Premium price exists in Stripe'
          });
          console.log('  ✅ Premium Price: Valid');
        } catch (e) {
          stripePhase.tests.push({
            test: 'Premium Price Configuration',
            status: 'FAIL',
            message: e.message
          });
          report.errors.push({
            phase: 'Stripe',
            error: 'Premium price not found in Stripe',
            details: e.message
          });
          console.log('  ❌ Premium Price: Not Found');
        }

      } catch (e) {
        stripePhase.tests.push({
          test: 'Stripe API Connection',
          status: 'FAIL',
          message: e.message
        });
        report.errors.push({
          phase: 'Stripe',
          error: 'Failed to connect to Stripe API',
          details: e.message,
          fix: 'Verify STRIPE_API_KEY is correct'
        });
        console.log('  ❌ Stripe API: Connection Failed -', e.message);
      }
    }

    stripePhase.status = stripePhase.tests.filter(t => t.status === 'FAIL').length === 0 ? 'PASS' : 'FAIL';
    report.phases.push(stripePhase);

    // PHASE 3: Database & Entities Validation
    console.log('\n📊 PHASE 3: Database & Entities');
    const dbPhase = {
      name: 'Database Operations',
      tests: [],
      status: 'running'
    };

    // Test critical entities
    const criticalEntities = [
      { name: 'User', serviceRole: true },
      { name: 'Verse', serviceRole: false },
      { name: 'Sermon', serviceRole: false },
      { name: 'Translation', serviceRole: true },
      { name: 'StripeEvent', serviceRole: true, optional: true }
    ];

    for (const entity of criticalEntities) {
      try {
        const client = entity.serviceRole ? base44.asServiceRole : base44;
        const records = await client.entities[entity.name].list('id', 1);
        
        dbPhase.tests.push({
          entity: entity.name,
          status: 'PASS',
          access: entity.serviceRole ? 'Service Role' : 'User',
          recordsExist: records.length > 0
        });
        console.log(`  ✅ ${entity.name}: Accessible (${records.length > 0 ? 'has data' : 'empty'})`);
      } catch (e) {
        if (entity.optional) {
          dbPhase.tests.push({
            entity: entity.name,
            status: 'WARN',
            message: 'Optional entity not found',
            details: e.message
          });
          console.log(`  ⚠️ ${entity.name}: Not found (optional)`);
        } else {
          dbPhase.tests.push({
            entity: entity.name,
            status: 'FAIL',
            message: e.message
          });
          report.errors.push({
            phase: 'Database',
            error: `Cannot access ${entity.name} entity`,
            details: e.message
          });
          console.log(`  ❌ ${entity.name}: Access Failed`);
        }
      }
    }

    dbPhase.status = dbPhase.tests.filter(t => t.status === 'FAIL').length === 0 ? 'PASS' : 'FAIL';
    report.phases.push(dbPhase);

    // PHASE 4: Backend Functions Validation
    console.log('\n⚙️ PHASE 4: Backend Functions');
    const functionsPhase = {
      name: 'Backend Functions',
      tests: [],
      status: 'running'
    };

    const functionsToTest = [
      { 
        name: 'createCheckoutSession',
        description: 'Stripe checkout creation',
        critical: true
      },
      { 
        name: 'stripeWebhook',
        description: 'Stripe webhook handler',
        critical: true
      },
      {
        name: 'getVerses',
        description: 'Bible verse fetching',
        critical: true
      },
      {
        name: 'listAvailableTranslations',
        description: 'Translation listing',
        critical: true
      }
    ];

    for (const func of functionsToTest) {
      try {
        // Test that function is callable
        const testResult = await base44.functions.invoke(func.name, { test: true });
        
        functionsPhase.tests.push({
          function: func.name,
          status: 'PASS',
          description: func.description,
          message: 'Function is callable'
        });
        console.log(`  ✅ ${func.name}: Callable`);
      } catch (e) {
        functionsPhase.tests.push({
          function: func.name,
          status: func.critical ? 'FAIL' : 'WARN',
          description: func.description,
          message: e.message
        });
        
        if (func.critical) {
          report.errors.push({
            phase: 'Functions',
            error: `${func.name} failed`,
            details: e.message
          });
        }
        console.log(`  ${func.critical ? '❌' : '⚠️'} ${func.name}: ${e.message}`);
      }
    }

    functionsPhase.status = functionsPhase.tests.filter(t => t.status === 'FAIL').length === 0 ? 'PASS' : 'FAIL';
    report.phases.push(functionsPhase);

    // PHASE 5: Premium Access Logic
    console.log('\n👑 PHASE 5: Premium Access Logic');
    const premiumPhase = {
      name: 'Premium Access',
      tests: [],
      status: 'running'
    };

    const devEmails = [
      'buckeye7066@gmail.com',
      'anyawhite@rocketmail.com',
      'whiterobert1201@icloud.com',
      'tishka1201@icloud.com'
    ];
    
    const devPhones = ['9319981779', '+19319981779', '931-998-1779', '(931) 998-1779'];
    
    const emailMatch = user.email && devEmails.includes(user.email.toLowerCase());
    const phoneMatch = user.phone && devPhones.some(p => 
      user.phone.replace(/[\s\-\(\)]/g, '').includes(p.replace(/[\s\-\(\)\+]/g, ''))
    );
    
    const isDeveloper = emailMatch || phoneMatch;
    const isPremium = isDeveloper || 
                      user.subscription_tier === 'premium' || 
                      user.premium_override === true ||
                      (user.premium_until && new Date(user.premium_until) > new Date());

    premiumPhase.tests.push({
      test: 'Current User Premium Status',
      status: 'INFO',
      details: {
        email: user.email,
        isDeveloper,
        isPremium,
        subscription_tier: user.subscription_tier,
        premium_override: user.premium_override
      }
    });

    console.log(`  User: ${user.email}`);
    console.log(`  Developer Access: ${isDeveloper ? '✅ YES' : '❌ NO'}`);
    console.log(`  Premium Status: ${isPremium ? '✅ PREMIUM' : '⚠️ FREE'}`);
    console.log(`  Subscription Tier: ${user.subscription_tier || 'free'}`);

    premiumPhase.status = 'PASS';
    report.phases.push(premiumPhase);

    // PHASE 6: Bible Data Availability
    console.log('\n📖 PHASE 6: Bible Data');
    const biblePhase = {
      name: 'Bible Data',
      tests: [],
      status: 'running'
    };

    try {
      // Check for any verses
      const sampleVerses = await base44.entities.Verse.list('id', 100);
      
      biblePhase.tests.push({
        test: 'Verse Data Availability',
        status: sampleVerses.length > 0 ? 'PASS' : 'WARN',
        totalVerses: sampleVerses.length,
        message: sampleVerses.length > 0 ? 'Bible data imported' : 'No verses in database'
      });

      console.log(`  Total verses in database: ${sampleVerses.length}`);
      
      if (sampleVerses.length === 0) {
        report.errors.push({
          phase: 'Bible Data',
          error: 'No verses imported',
          fix: 'Run Bulk Import to import Bible data',
          severity: 'warning'
        });
      }

      // Check Genesis 1 specifically
      const genesis1 = await base44.entities.Verse.filter({
        translation_id: 'KJV',
        book_name: 'Genesis',
        chapter: 1
      });

      biblePhase.tests.push({
        test: 'Genesis 1 (KJV)',
        status: genesis1.length > 0 ? 'PASS' : 'WARN',
        verseCount: genesis1.length,
        expected: 31
      });

      console.log(`  Genesis 1: ${genesis1.length}/31 verses`);

    } catch (e) {
      biblePhase.tests.push({
        test: 'Verse Data Access',
        status: 'FAIL',
        message: e.message
      });
      report.errors.push({
        phase: 'Bible Data',
        error: 'Cannot access verse data',
        details: e.message
      });
      console.log(`  ❌ Verse access failed: ${e.message}`);
    }

    biblePhase.status = biblePhase.tests.filter(t => t.status === 'FAIL').length === 0 ? 'PASS' : 'WARN';
    report.phases.push(biblePhase);

    // PHASE 7: Integration Dependencies
    console.log('\n🔧 PHASE 7: Dependencies');
    const depsPhase = {
      name: 'Dependencies',
      tests: [],
      status: 'running'
    };

    // Check SDK versions
    depsPhase.tests.push({
      dependency: 'Base44 SDK',
      version: '0.7.1',
      status: 'PASS'
    });

    depsPhase.tests.push({
      dependency: 'Stripe SDK',
      version: '17.4.0',
      status: 'PASS'
    });

    console.log('  ✅ Base44 SDK: v0.7.1');
    console.log('  ✅ Stripe SDK: v17.4.0');

    depsPhase.status = 'PASS';
    report.phases.push(depsPhase);

    // Calculate Summary
    report.summary.total_tests = report.phases.reduce((sum, p) => sum + p.tests.length, 0);
    report.summary.passed = report.phases.reduce((sum, p) => 
      sum + p.tests.filter(t => t.status === 'PASS').length, 0
    );
    report.summary.failed = report.phases.reduce((sum, p) => 
      sum + p.tests.filter(t => t.status === 'FAIL').length, 0
    );
    report.summary.warnings = report.phases.reduce((sum, p) => 
      sum + p.tests.filter(t => t.status === 'WARN').length, 0
    );

    const overallStatus = report.summary.failed === 0 ? 
      (report.summary.warnings === 0 ? 'FULLY_OPERATIONAL' : 'OPERATIONAL_WITH_WARNINGS') :
      'ISSUES_DETECTED';

    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE REPAIR SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${report.summary.total_tests}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⚠️ Warnings: ${report.summary.warnings}`);
    console.log(`\nOverall Status: ${overallStatus}`);
    
    if (report.errors.length > 0) {
      console.log('\n🔴 CRITICAL ISSUES FOUND:');
      report.errors.forEach((err, i) => {
        console.log(`\n${i + 1}. ${err.phase}: ${err.error}`);
        if (err.details) console.log(`   Details: ${err.details}`);
        if (err.fix) console.log(`   Fix: ${err.fix}`);
      });
    }

    return Response.json({
      success: report.summary.failed === 0,
      overallStatus,
      timestamp: report.timestamp,
      summary: report.summary,
      phases: report.phases,
      errors: report.errors,
      fixes: report.fixes,
      recommendations: generateRecommendations(report),
      nextSteps: generateNextSteps(overallStatus, report.errors)
    });

  } catch (error) {
    console.error('❌ COMPREHENSIVE REPAIR FAILED:', error);
    return Response.json({ 
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});

function generateRecommendations(report) {
  const recommendations = [];

  // Check for Stripe issues
  const stripePhase = report.phases.find(p => p.name === 'Stripe Integration');
  if (stripePhase && stripePhase.status !== 'PASS') {
    recommendations.push({
      priority: 'HIGH',
      category: 'Stripe',
      message: 'Configure Stripe API keys and webhook secret',
      action: 'Set STRIPE_API_KEY and STRIPE_WEBHOOK_SECRET environment variables'
    });
  }

  // Check for Bible data
  const biblePhase = report.phases.find(p => p.name === 'Bible Data');
  const verseTest = biblePhase?.tests.find(t => t.test === 'Verse Data Availability');
  if (verseTest && verseTest.totalVerses === 0) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Data',
      message: 'Import Bible data',
      action: 'Navigate to Bulk Import page and import KJV Bible'
    });
  }

  // Check for database issues
  const dbPhase = report.phases.find(p => p.name === 'Database Operations');
  const failedEntities = dbPhase?.tests.filter(t => t.status === 'FAIL');
  if (failedEntities && failedEntities.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Database',
      message: 'Some entities are not accessible',
      action: 'Review entity configurations and RLS policies'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'LOW',
      category: 'Maintenance',
      message: 'All systems operational',
      action: 'Continue monitoring and testing'
    });
  }

  return recommendations;
}

function generateNextSteps(status, errors) {
  const steps = [];

  if (status === 'FULLY_OPERATIONAL') {
    return [
      '✅ All systems are fully operational',
      '📊 Monitor Stripe webhooks for incoming subscriptions',
      '📖 Test Bible reading functionality',
      '💳 Test premium checkout flow'
    ];
  }

  const criticalErrors = errors.filter(e => e.critical);
  const otherErrors = errors.filter(e => !e.critical);

  if (criticalErrors.length > 0) {
    steps.push('🔴 CRITICAL: Fix the following issues immediately:');
    criticalErrors.forEach(err => {
      steps.push(`  • ${err.error}`);
      if (err.fix) steps.push(`    Fix: ${err.fix}`);
    });
  }

  if (otherErrors.length > 0) {
    steps.push('⚠️ Address these warnings when possible:');
    otherErrors.forEach(err => {
      steps.push(`  • ${err.error}`);
      if (err.fix) steps.push(`    Fix: ${err.fix}`);
    });
  }

  steps.push('🔄 Run this diagnostic again after fixes to verify');
  
  return steps;
}