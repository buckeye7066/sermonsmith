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

    console.log('🔍 STARTING COMPREHENSIVE DIAGNOSTIC...');
    
    const results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };

    // TEST 1: Environment Variables
    console.log('\n📋 TEST 1: Environment Variables');
    const envTest = {
      name: 'Environment Variables',
      status: 'running',
      checks: []
    };

    const requiredEnvVars = {
      'STRIPE_API_KEY': Deno.env.get("STRIPE_API_KEY"),
      'STRIPE_WEBHOOK_SECRET': Deno.env.get("STRIPE_WEBHOOK_SECRET"),
      'BASE44_APP_ID': Deno.env.get("BASE44_APP_ID")
    };

    for (const [key, value] of Object.entries(requiredEnvVars)) {
      const isSet = !!value;
      envTest.checks.push({
        variable: key,
        status: isSet ? '✅ SET' : '❌ MISSING',
        value: isSet ? '***' : null
      });
      console.log(`  ${key}: ${isSet ? '✅ SET' : '❌ MISSING'}`);
    }

    envTest.status = envTest.checks.every(c => c.status.includes('✅')) ? 'passed' : 'failed';
    results.tests.push(envTest);

    // TEST 2: Stripe SDK
    console.log('\n💳 TEST 2: Stripe SDK Initialization');
    const stripeTest = {
      name: 'Stripe SDK',
      status: 'running',
      checks: []
    };

    try {
      const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"), {
        apiVersion: "2024-06-20",
      });
      
      // Test API key validity
      try {
        await stripe.customers.list({ limit: 1 });
        stripeTest.checks.push({
          test: 'API Key Valid',
          status: '✅ PASSED',
          message: 'Stripe API key is valid and working'
        });
        console.log('  ✅ Stripe API key valid');
      } catch (e) {
        stripeTest.checks.push({
          test: 'API Key Valid',
          status: '❌ FAILED',
          message: e.message
        });
        console.log('  ❌ Stripe API key invalid:', e.message);
      }

      stripeTest.status = stripeTest.checks.every(c => c.status.includes('✅')) ? 'passed' : 'failed';
    } catch (e) {
      stripeTest.checks.push({
        test: 'SDK Initialization',
        status: '❌ FAILED',
        message: e.message
      });
      stripeTest.status = 'failed';
      console.log('  ❌ Stripe SDK initialization failed:', e.message);
    }

    results.tests.push(stripeTest);

    // TEST 3: Database Access
    console.log('\n📊 TEST 3: Database Operations');
    const dbTest = {
      name: 'Database Access',
      status: 'running',
      checks: []
    };

    // Test Verse entity
    try {
      const verses = await base44.entities.Verse.list('id', 5);
      dbTest.checks.push({
        test: 'Verse Entity Read',
        status: '✅ PASSED',
        message: `Found ${verses.length} verses in database`
      });
      console.log(`  ✅ Verse entity: ${verses.length} records`);
    } catch (e) {
      dbTest.checks.push({
        test: 'Verse Entity Read',
        status: '❌ FAILED',
        message: e.message
      });
      console.log('  ❌ Verse entity failed:', e.message);
    }

    // Test User entity
    try {
      const users = await base44.asServiceRole.entities.User.list('id', 1);
      dbTest.checks.push({
        test: 'User Entity Read (Service Role)',
        status: '✅ PASSED',
        message: `Service role can access users`
      });
      console.log('  ✅ User entity: Service role access working');
    } catch (e) {
      dbTest.checks.push({
        test: 'User Entity Read (Service Role)',
        status: '❌ FAILED',
        message: e.message
      });
      console.log('  ❌ User entity failed:', e.message);
    }

    // Test Sermon entity
    try {
      const sermons = await base44.entities.Sermon.filter({ user_id: user.id }, 'id', 1);
      dbTest.checks.push({
        test: 'Sermon Entity Read',
        status: '✅ PASSED',
        message: `User can access their sermons`
      });
      console.log('  ✅ Sermon entity: Working');
    } catch (e) {
      dbTest.checks.push({
        test: 'Sermon Entity Read',
        status: '❌ FAILED',
        message: e.message
      });
      console.log('  ❌ Sermon entity failed:', e.message);
    }

    dbTest.status = dbTest.checks.filter(c => c.status.includes('❌')).length === 0 ? 'passed' : 'failed';
    results.tests.push(dbTest);

    // TEST 4: Premium Access Logic
    console.log('\n👑 TEST 4: Premium Access Logic');
    const premiumTest = {
      name: 'Premium Access',
      status: 'running',
      checks: []
    };
    
    const isPremium = user.subscription_tier === 'premium' || 
                      user.premium_override === true ||
                      (user.premium_until && new Date(user.premium_until) > new Date());

    premiumTest.checks.push({
      test: 'User Premium Status',
      status: isPremium ? '✅ PREMIUM' : '⚠️ FREE',
      details: {
        subscription_tier: user.subscription_tier,
        premium_override: user.premium_override,
        email: user.email
      }
    });

    console.log(`  User: ${user.email}`);
    console.log(`  Is Premium: ${isPremium}`);
    console.log(`  Subscription Tier: ${user.subscription_tier}`);

    premiumTest.status = 'passed';
    results.tests.push(premiumTest);

    // TEST 5: Integration Dependencies
    console.log('\n🔧 TEST 5: Integration Dependencies');
    const depsTest = {
      name: 'Dependencies',
      status: 'running',
      checks: []
    };

    // Test Base44 SDK
    try {
      const sdkVersion = '0.7.1';
      depsTest.checks.push({
        test: 'Base44 SDK',
        status: '✅ LOADED',
        version: sdkVersion
      });
      console.log(`  ✅ Base44 SDK: v${sdkVersion}`);
    } catch (e) {
      depsTest.checks.push({
        test: 'Base44 SDK',
        status: '❌ FAILED',
        message: e.message
      });
    }

    // Test Stripe
    try {
      const stripeVersion = '17.4.0';
      depsTest.checks.push({
        test: 'Stripe SDK',
        status: '✅ LOADED',
        version: stripeVersion
      });
      console.log(`  ✅ Stripe SDK: v${stripeVersion}`);
    } catch (e) {
      depsTest.checks.push({
        test: 'Stripe SDK',
        status: '❌ FAILED',
        message: e.message
      });
    }

    depsTest.status = depsTest.checks.every(c => c.status.includes('✅')) ? 'passed' : 'failed';
    results.tests.push(depsTest);

    // TEST 6: Bible Data Availability
    console.log('\n📖 TEST 6: Bible Data Availability');
    const bibleTest = {
      name: 'Bible Data',
      status: 'running',
      checks: []
    };

    // Check Genesis 1
    try {
      const genesis1 = await base44.entities.Verse.filter({
        translation_id: 'KJV',
        book_name: 'Genesis',
        chapter: 1
      });

      bibleTest.checks.push({
        test: 'Genesis 1 (KJV)',
        status: genesis1.length > 0 ? '✅ AVAILABLE' : '⚠️ NOT IMPORTED',
        verseCount: genesis1.length,
        expected: 31
      });

      console.log(`  Genesis 1: ${genesis1.length} verses (expected 31)`);
    } catch (e) {
      bibleTest.checks.push({
        test: 'Genesis 1 (KJV)',
        status: '❌ FAILED',
        message: e.message
      });
    }

    // Count total verses
    try {
      const allVerses = await base44.asServiceRole.entities.Verse.list('id', 100);
      bibleTest.checks.push({
        test: 'Total Verses Imported',
        status: allVerses.length > 0 ? '✅ DATA EXISTS' : '⚠️ NO DATA',
        count: allVerses.length
      });
      console.log(`  Total verses in database: ${allVerses.length}`);
    } catch (e) {
      bibleTest.checks.push({
        test: 'Total Verses Imported',
        status: '❌ FAILED',
        message: e.message
      });
    }

    bibleTest.status = bibleTest.checks.filter(c => c.status.includes('❌')).length === 0 ? 'passed' : 'warning';
    results.tests.push(bibleTest);

    // Calculate summary
    results.summary.total = results.tests.length;
    results.summary.passed = results.tests.filter(t => t.status === 'passed').length;
    results.summary.failed = results.tests.filter(t => t.status === 'failed').length;
    results.summary.warnings = results.tests.filter(t => t.status === 'warning').length;

    console.log('\n📊 DIAGNOSTIC SUMMARY:');
    console.log(`  Total Tests: ${results.summary.total}`);
    console.log(`  ✅ Passed: ${results.summary.passed}`);
    console.log(`  ❌ Failed: ${results.summary.failed}`);
    console.log(`  ⚠️ Warnings: ${results.summary.warnings}`);

    return Response.json({
      success: true,
      results,
      overallStatus: results.summary.failed === 0 ? 'OPERATIONAL' : 'ISSUES_DETECTED',
      recommendation: results.summary.failed === 0 
        ? 'All systems operational! ✅'
        : 'Some issues detected. Check failed tests for details.'
    });

  } catch (error) {
    console.error('❌ DIAGNOSTIC FAILED:', error);
    return Response.json({ 
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});