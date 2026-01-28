import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * GET CODE SNIPPET
 * 
 * Extracts code context from a file, optionally using stack trace line numbers.
 * Returns the relevant code that may have caused an error.
 */

// Hardcoded code snippets for known functions (since we can't read files at runtime)
const CODE_CACHE = {
  'functions/biblePassage.js': `// biblePassage.js - Bible verse fetcher
async function safeRun(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return { ok: false, error: 'Unauthorized' };
  
  const body = await req.json();
  const { translationId, bookCode, chapter, verses } = body;
  
  if (!bookCode || !chapter) {
    return { ok: false, error: 'Missing book or chapter', data: { verses: [] } };
  }
  
  // Fetch from bible.helloao.org API
  const apiUrl = \`https://bible.helloao.org/api/\${translationId}/\${bookCode}/\${chapter}.json\`;
  const response = await fetch(apiUrl);
  // ... parse and return verses
}`,

  'functions/createCheckoutSession.js': `// createCheckoutSession.js - Stripe checkout
async function safeRun(req) {
  const stripeKey = Deno.env.get("STRIPE_API_KEY");
  if (!stripeKey) {
    return { ok: false, error: 'STRIPE_API_KEY not configured' };
  }
  
  const stripe = new Stripe(stripeKey);
  const body = await req.json();
  const { priceId, successUrl, cancelUrl } = body;
  
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl
  });
  
  return { ok: true, data: { url: session.url, sessionId: session.id } };
}`,

  'functions/stripe-webhook.js': `// stripe-webhook.js - Stripe webhook handler
Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  
  // Verify signature and process event
  const event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  
  switch (event.type) {
    case 'checkout.session.completed':
      // Update user subscription
      break;
    case 'customer.subscription.deleted':
      // Remove premium access
      break;
  }
});`,

  'functions/exportToPDF.js': `// exportToPDF.js - PDF export
async function safeRun(req) {
  const body = await req.json();
  const { resourceType, resourceId } = body;
  
  // Fetch sermon or study data
  const data = resourceType === 'sermon'
    ? await base44.entities.Sermon.get(resourceId)
    : await base44.entities.BibleStudy.get(resourceId);
  
  // Generate PDF with jsPDF
  const doc = new jsPDF();
  doc.setFontSize(24);
  doc.text(data.title, 20, 30);
  // ... add content
  
  return doc.output('arraybuffer');
}`,

  'functions/exportToPPTX.js': `// exportToPPTX.js - PowerPoint export
async function safeRun(req) {
  const body = await req.json();
  const { resourceType, resourceId } = body;
  
  // Fetch content
  const data = await base44.entities[resourceType === 'sermon' ? 'Sermon' : 'BibleStudy'].get(resourceId);
  
  // Generate PPTX
  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();
  slide.addText(data.title, { x: 1, y: 1, fontSize: 36 });
  // ... add slides
  
  return pptx.write('arraybuffer');
}`,

  'functions/listUsers.js': `// listUsers.js - Admin user listing
async function safeRun(req) {
  const user = await base44.auth.me();
  if (user.role !== 'admin') {
    return { ok: false, error: 'Admin access required' };
  }
  
  const users = await base44.asServiceRole.entities.User.list('-created_date', 100);
  return { ok: true, data: { users, count: users.length } };
}`,

  'functions/grantMePremium.js': `// grantMePremium.js - Grant premium to self
async function safeRun(req) {
  const user = await base44.auth.me();
  if (!user) return { ok: false, error: 'Unauthorized' };
  
  await base44.auth.updateMe({
    subscription_tier: 'premium',
    premium_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  });
  
  return { ok: true, data: { granted: true } };
}`,

  'functions/grantFamilyAccess.js': `// grantFamilyAccess.js - Grant family premium
async function safeRun(req) {
  const user = await base44.auth.me();
  if (user.role !== 'admin') {
    return { ok: false, error: 'Admin access required' };
  }
  
  const familyEmails = ['email1@example.com', 'email2@example.com'];
  const results = [];
  
  for (const email of familyEmails) {
    // Grant premium access
  }
  
  return { ok: true, data: { results } };
}`,

  'functions/createShareableLink.js': `// createShareableLink.js - Create share links
async function safeRun(req) {
  const body = await req.json();
  const { resourceType, resourceId, expiresIn } = body;
  
  const shareCode = generateShareCode();
  const link = await base44.entities.ShareableLink.create({
    resource_type: resourceType,
    resource_id: resourceId,
    share_code: shareCode,
    expires_at: expiresIn ? new Date(Date.now() + expiresIn) : null
  });
  
  return { ok: true, data: { url: \`/shared/\${shareCode}\`, link } };
}`,

  'functions/promptSuggestions.js': `// promptSuggestions.js - AI prompt suggestions
async function safeRun(req) {
  const body = await req.json();
  const { type } = body;
  
  const SUGGESTIONS = {
    sermon: ['Grace and Redemption', 'Faith in Trials', 'Love Your Neighbor'],
    study: ['Book of Romans', 'Beatitudes', 'Parables of Jesus'],
    quiz: ['Old Testament Kings', 'New Testament Geography', 'Biblical Prophecy']
  };
  
  return { ok: true, data: { suggestions: SUGGESTIONS[type] || SUGGESTIONS.sermon } };
}`,

  'functions/listAvailableTranslations.js': `// listAvailableTranslations.js - Bible translations
async function safeRun(req) {
  // Fetch from bible.helloao.org
  const response = await fetch('https://bible.helloao.org/api/available_translations.json');
  const data = await response.json();
  
  // Filter and categorize by region
  const translations = data.translations.filter(t => t.complete);
  
  return { ok: true, data: { translations, total: translations.length } };
}`,

  'functions/getPassageMultiSource.js': `// getPassageMultiSource.js - Multi-source Bible fetch
async function safeRun(req) {
  const body = await req.json();
  const { translationId, bookCode, chapter } = body;
  
  // Try multiple sources in order
  const sources = ['bible-api.com', 'biblesupersearch.com', 'helloao.org'];
  
  for (const source of sources) {
    const result = await trySource(source, translationId, bookCode, chapter);
    if (result.ok) return result;
  }
  
  return { ok: false, error: 'All sources failed' };
}`
};

function extractLineFromStack(stack, filePath) {
  if (!stack) return null;
  
  const lines = stack.split('\n');
  for (const line of lines) {
    if (line.includes(filePath)) {
      const match = line.match(/:(\d+):/);
      if (match) return parseInt(match[1], 10);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ ok: false, error: 'Authentication required', data: null });
    }
    
    if (user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Admin access required', data: null });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: 'Invalid JSON body', data: null });
    }

    const { filePath, stack } = body;

    if (!filePath) {
      return Response.json({ ok: false, error: 'filePath is required', data: null });
    }

    // Get cached code or generate placeholder
    let codeSnippet = CODE_CACHE[filePath];
    
    if (!codeSnippet) {
      codeSnippet = `// ${filePath}\n// Code snippet not available in cache\n// Add to CODE_CACHE in getCodeSnippet.js`;
    }

    // If we have a stack trace, try to highlight the relevant section
    const lineNumber = extractLineFromStack(stack, filePath);
    let context = '';
    
    if (lineNumber) {
      context = `\n// Error occurred around line ${lineNumber}`;
    }

    return Response.json({
      ok: true,
      error: null,
      data: {
        filePath,
        lineNumber,
        snippet: codeSnippet + context
      }
    });

  } catch (err) {
    console.error('[getCodeSnippet] CRITICAL:', err);
    return Response.json({
      ok: false,
      error: err?.message ?? 'Unknown error',
      data: null
    });
  }
});