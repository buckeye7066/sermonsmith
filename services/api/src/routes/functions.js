import { Router } from 'express';
import { prisma, authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Stripe SDK is lazy-loaded — see getStripe() below. The previous
// top-level await meant the API would crash at import time if the SDK was
// missing or the key was unset; now booting works in test/dev without
// Stripe credentials.
let _stripe = null;
async function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY || process.env.DISABLE_BILLING === '1') return null;
  if (!_stripe) {
    const { default: Stripe } = await import('stripe');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// Bible passage — accepts both frontend naming (translationId/bookCode) and direct naming (book/translation)
router.post('/biblePassage', optionalAuth, async (req, res, next) => {
  try {
    const book = req.body.bookCode || req.body.book;
    const chapter = req.body.chapter;
    const translation = req.body.translationId || req.body.translation || 'kjv';
    const verses = req.body.verses;

    if (!book || !chapter) {
      return res.status(400).json({ message: 'book/bookCode and chapter are required' });
    }

    const ref = verses ? `${book} ${chapter}:${verses}` : `${book} ${chapter}`;
    const translationId = translation.replace(/^en-/, '');
    const url = `https://bible-api.com/${encodeURIComponent(ref)}?translation=${translationId}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({ message: `Bible API returned ${response.status}` });
    }

    const data = await response.json();

    res.json({
      reference: data.reference || ref,
      translationLabel: translation,
      verses: data.verses || [],
      text: data.text || '',
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ message: 'Bible API request timed out' });
    }
    next(err);
  }
});

// List available translations
router.post('/listAvailableTranslations', optionalAuth, async (_req, res) => {
  res.json({
    translations: [
      { id: 'kjv', name: 'King James Version', language: 'en' },
      { id: 'web', name: 'World English Bible', language: 'en' },
      { id: 'bbe', name: 'Bible in Basic English', language: 'en' },
      { id: 'asv', name: 'American Standard Version', language: 'en' },
      { id: 'ylt', name: "Young's Literal Translation", language: 'en' },
      { id: 'darby', name: 'Darby Translation', language: 'en' },
      { id: 'clementine', name: 'Clementine Vulgate', language: 'la' },
      { id: 'almeida', name: 'João Ferreira de Almeida', language: 'pt' },
    ],
  });
});

// Multi-source passage
const TRANSLATION_TIMEOUT_MS = 10000;
const MAX_TRANSLATIONS = 5;

router.post('/getPassageMultiSource', optionalAuth, async (req, res, next) => {
  try {
    const { book, chapter, verse } = req.body;
    // Cap translations to prevent upstream abuse / DDoS
    const translations = (req.body.translations || ['kjv', 'web', 'bbe']).slice(0, MAX_TRANSLATIONS);
    const ref = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;

    const results = await Promise.allSettled(
      translations.map(async (t) => {
        const url = `https://bible-api.com/${encodeURIComponent(ref)}?translation=${t}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS);
        try {
          const resp = await fetch(url, { signal: controller.signal });
          if (!resp.ok) return { translation: t, error: `HTTP ${resp.status}` };
          return { translation: t, ...(await resp.json()) };
        } finally {
          clearTimeout(timeout);
        }
      })
    );

    res.json({
      passages: results.map(r =>
        r.status === 'fulfilled' ? r.value : { error: r.reason?.message }
      ),
    });
  } catch (err) {
    next(err);
  }
});

// Stripe checkout
router.post('/createCheckoutSession', authenticateToken, async (req, res, next) => {
  try {
    const stripe = await getStripe();
    if (!stripe) return res.status(503).json({ message: 'Stripe not configured. Set STRIPE_SECRET_KEY.' });
    if (!process.env.STRIPE_PRICE_ID) return res.status(503).json({ message: 'Stripe price not configured.' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${frontendUrl}/Settings?payment=success`,
      cancel_url: `${frontendUrl}/Pricing?payment=cancelled`,
      metadata: { userId: req.userId },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    next(err);
  }
});

// Stripe webhook — mounted at app level with express.raw() for signature verification.
// The router-level route is kept as a no-op fallback (requests are handled in index.js).
router.post('/stripeWebhook', (_req, res) => {
  res.status(400).json({ message: 'Webhook must be processed at the app level' });
});

// Stripe billing portal — lets users manage their subscription, update payment, cancel, etc.
router.post('/createBillingPortal', authenticateToken, async (req, res, next) => {
  try {
    const stripe = await getStripe();
    if (!stripe) return res.status(503).json({ message: 'Stripe not configured. Set STRIPE_SECRET_KEY.' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return res.status(404).json({ message: 'No billing account found. Have you subscribed to Premium?' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${frontendUrl}/Settings`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

// Grant premium (admin/dev only)
router.post('/grantMePremium', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { premium: true },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// List users (admin)
router.post('/listUsers', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, email: true, name: true, full_name: true,
        role: true, premium: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Import status
router.post('/getImportStatus', authenticateToken, async (req, res, next) => {
  try {
    const count = await prisma.entity.count({ where: { type: 'Verse' } });
    res.json({ totalVerses: count, status: count > 0 ? 'complete' : 'pending' });
  } catch (err) {
    next(err);
  }
});

// Export stubs (handled client-side via jsPDF)
router.post('/exportToPDF', authenticateToken, async (_req, res) => {
  res.json({ message: 'PDF export is handled client-side via jsPDF' });
});

router.post('/exportToPPTX', authenticateToken, async (_req, res) => {
  res.json({ message: 'PPTX export is handled client-side' });
});

// ---------------------------------------------------------------------------
// Shareable links — create a SharedLink entity with a unique slug
// ---------------------------------------------------------------------------
router.post('/createShareableLink', authenticateToken, async (req, res, next) => {
  try {
    const { resourceType, resourceId, title, description, accessLevel, expiresInDays } = req.body;
    if (!resourceType || !resourceId) {
      return res.status(400).json({ message: 'resourceType and resourceId are required' });
    }

    // Verify the resource exists and belongs to the user
    const resource = await prisma.entity.findUnique({ where: { id: resourceId } });
    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }
    if (resource.userId !== req.userId) {
      return res.status(403).json({ message: 'You can only share your own content' });
    }

    const slug = `${resourceType.toLowerCase()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;

    await prisma.entity.create({
      data: {
        type: 'SharedLink',
        userId: req.userId,
        data: {
          slug,
          resourceType,
          resourceId,
          title: title || '',
          description: description || '',
          accessLevel: accessLevel || 'view',
          expiresAt,
          views: 0,
          user_id: req.userId,
          created_date: new Date().toISOString(),
        },
      },
    });

    res.json({ shareUrl: `${frontendUrl}/SharedContent?link=${slug}` });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// API diagnostics — replaces Base44-era "discoverFunctions" for the
// FunctionReviewer admin page. Returns a map of all backend routes/endpoints.
// ---------------------------------------------------------------------------
router.post('/discoverFunctions', authenticateToken, requireAdmin, async (req, res) => {
  const functions = [
    { id: 'biblePassage', name: 'Bible Passage', description: 'Fetch a Bible passage from bible-api.com', category: 'bible', path: 'routes/functions.js' },
    { id: 'listAvailableTranslations', name: 'List Translations', description: 'Return available Bible translations', category: 'bible', path: 'routes/functions.js' },
    { id: 'getPassageMultiSource', name: 'Multi-Source Passage', description: 'Fetch a passage across multiple translations', category: 'bible', path: 'routes/functions.js' },
    { id: 'createCheckoutSession', name: 'Stripe Checkout', description: 'Create a Stripe checkout session for Premium', category: 'billing', path: 'routes/functions.js' },
    { id: 'createBillingPortal', name: 'Billing Portal', description: 'Open Stripe billing portal for subscription management', category: 'billing', path: 'routes/functions.js' },
    { id: 'grantMePremium', name: 'Grant Premium', description: 'Admin: grant premium status to current user', category: 'admin', path: 'routes/functions.js' },
    { id: 'listUsers', name: 'List Users', description: 'Admin: list all registered users', category: 'admin', path: 'routes/functions.js' },
    { id: 'getImportStatus', name: 'Import Status', description: 'Check how many verses are imported', category: 'bible', path: 'routes/functions.js' },
    { id: 'importFullBible', name: 'Import Full Bible', description: 'Bulk-import KJV from bible-api.com', category: 'bible', path: 'routes/functions.js' },
    { id: 'createShareableLink', name: 'Create Share Link', description: 'Generate a shareable link for a resource', category: 'sharing', path: 'routes/functions.js' },
    { id: 'testAllFunctions', name: 'Test All Functions', description: 'Run health checks on all endpoints', category: 'admin', path: 'routes/functions.js' },
  ];

  const pages = [
    { id: 'Home', name: 'Home', path: 'pages/Home.jsx' },
    { id: 'SermonBuilder', name: 'Sermon Builder', path: 'pages/SermonBuilder.jsx' },
    { id: 'SermonLibrary', name: 'Sermon Library', path: 'pages/SermonLibrary.jsx' },
    { id: 'BibleStudy', name: 'Bible Study', path: 'pages/BibleStudy.jsx' },
    { id: 'Reader', name: 'Bible Reader', path: 'pages/Reader.jsx' },
    { id: 'BibleMaps', name: 'Bible Maps', path: 'pages/BibleMaps.jsx' },
    { id: 'ChristianEthics', name: 'Christian Ethics', path: 'pages/ChristianEthics.jsx' },
    { id: 'WorldviewExplorer', name: 'Worldview Explorer', path: 'pages/WorldviewExplorer.jsx' },
    { id: 'PrayerGenerator', name: 'Prayer Generator', path: 'pages/PrayerGenerator.jsx' },
    { id: 'QuizBuilder', name: 'Quiz Builder', path: 'pages/QuizBuilder.jsx' },
    { id: 'Forum', name: 'Forum', path: 'pages/Forum.jsx' },
    { id: 'StudyGroups', name: 'Study Groups', path: 'pages/StudyGroups.jsx' },
    { id: 'Settings', name: 'Settings', path: 'pages/Settings.jsx' },
    { id: 'Pricing', name: 'Pricing', path: 'pages/Pricing.jsx' },
    { id: 'ContactSupport', name: 'Contact Support', path: 'pages/ContactSupport.jsx' },
  ];

  const entities = [
    { id: 'Sermon', name: 'Sermon', path: 'entities/Sermon' },
    { id: 'Series', name: 'Series', path: 'entities/Series' },
    { id: 'StudyNote', name: 'Study Note', path: 'entities/StudyNote' },
    { id: 'Quiz', name: 'Quiz', path: 'entities/Quiz' },
    { id: 'Message', name: 'Support Message', path: 'entities/Message' },
    { id: 'SharedContent', name: 'Shared Content', path: 'entities/SharedContent' },
    { id: 'SharedLink', name: 'Shared Link', path: 'entities/SharedLink' },
    { id: 'ForumPost', name: 'Forum Post', path: 'entities/ForumPost' },
    { id: 'StudyGroup', name: 'Study Group', path: 'entities/StudyGroup' },
    { id: 'ActivityLog', name: 'Activity Log', path: 'entities/ActivityLog' },
  ];

  res.json({
    ok: true,
    data: {
      functions,
      pages,
      components: [],
      entities,
      other: [],
      totals: {
        functions: functions.length,
        pages: pages.length,
        entities: entities.length,
        all: functions.length + pages.length + entities.length,
      },
    },
  });
});

// ---------------------------------------------------------------------------
// Get function details — returns metadata for a specific function/route
// ---------------------------------------------------------------------------
router.post('/getFunctionDetails', authenticateToken, requireAdmin, async (req, res) => {
  const { functionId } = req.body;
  if (!functionId) {
    return res.status(400).json({ message: 'functionId is required' });
  }

  // Simple metadata lookup — in a serverless architecture this would read the
  // source file; for a self-hosted Express app we return route documentation.
  const details = {
    biblePassage: { code: '// Proxies bible-api.com — see routes/functions.js:13', method: 'POST', auth: 'optional' },
    listAvailableTranslations: { code: '// Returns hardcoded translation list — see routes/functions.js:55', method: 'POST', auth: 'optional' },
    getPassageMultiSource: { code: '// Parallel multi-translation fetch — see routes/functions.js:74', method: 'POST', auth: 'optional' },
    createCheckoutSession: { code: '// Stripe checkout — see routes/functions.js:107', method: 'POST', auth: 'required' },
    createBillingPortal: { code: '// Stripe billing portal — see routes/functions.js:137', method: 'POST', auth: 'required' },
    grantMePremium: { code: '// Admin premium grant — see routes/functions.js:162', method: 'POST', auth: 'admin' },
    importFullBible: { code: '// Bulk Bible import — see routes/functions.js', method: 'POST', auth: 'required' },
    createShareableLink: { code: '// Share link generator — see routes/functions.js', method: 'POST', auth: 'required' },
    testAllFunctions: { code: '// Health check runner — see routes/functions.js', method: 'POST', auth: 'admin' },
  };

  const meta = details[functionId];
  if (!meta) {
    return res.json({ ok: true, data: { id: functionId, code: '// No source available for this function', method: 'POST', auth: 'unknown' } });
  }

  res.json({ ok: true, data: { id: functionId, ...meta } });
});

// ---------------------------------------------------------------------------
// Test all functions — lightweight health check for admin diagnostics
// ---------------------------------------------------------------------------
router.post('/testAllFunctions', authenticateToken, requireAdmin, async (_req, res) => {
  const checks = [];

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: 'Database', status: 'pass' });
  } catch {
    checks.push({ name: 'Database', status: 'fail', error: 'Cannot reach PostgreSQL' });
  }

  // Check Bible API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch('https://bible-api.com/john 3:16', { signal: controller.signal });
    clearTimeout(timeout);
    checks.push({ name: 'Bible API', status: resp.ok ? 'pass' : 'fail' });
  } catch {
    checks.push({ name: 'Bible API', status: 'fail', error: 'Unreachable' });
  }

  // Check OpenAI
  checks.push({
    name: 'OpenAI API Key',
    status: process.env.OPENAI_API_KEY ? 'pass' : 'warn',
    ...(process.env.OPENAI_API_KEY ? {} : { error: 'Not configured' }),
  });

  // Check Stripe — does NOT instantiate the SDK; just inspects the env.
  const billingConfigured = Boolean(process.env.STRIPE_SECRET_KEY) && process.env.DISABLE_BILLING !== '1';
  checks.push({
    name: 'Stripe',
    status: billingConfigured ? 'pass' : 'warn',
    ...(billingConfigured ? {} : { error: 'Not configured' }),
  });

  const passed = checks.filter(c => c.status === 'pass').length;
  const failed = checks.filter(c => c.status === 'fail').length;

  res.json({
    ok: failed === 0,
    data: { checked: checks.length, passed, failed, results: checks },
  });
});

// ---------------------------------------------------------------------------
// Import full Bible from bible-api.com — fetches all 66 books chapter by
// chapter and stores them as Verse entities.
// ---------------------------------------------------------------------------
const BIBLE_BOOKS = [
  { name: 'Genesis', chapters: 50 }, { name: 'Exodus', chapters: 40 }, { name: 'Leviticus', chapters: 27 },
  { name: 'Numbers', chapters: 36 }, { name: 'Deuteronomy', chapters: 34 }, { name: 'Joshua', chapters: 24 },
  { name: 'Judges', chapters: 21 }, { name: 'Ruth', chapters: 4 }, { name: '1 Samuel', chapters: 31 },
  { name: '2 Samuel', chapters: 24 }, { name: '1 Kings', chapters: 22 }, { name: '2 Kings', chapters: 25 },
  { name: '1 Chronicles', chapters: 29 }, { name: '2 Chronicles', chapters: 36 }, { name: 'Ezra', chapters: 10 },
  { name: 'Nehemiah', chapters: 13 }, { name: 'Esther', chapters: 10 }, { name: 'Job', chapters: 42 },
  { name: 'Psalms', chapters: 150 }, { name: 'Proverbs', chapters: 31 }, { name: 'Ecclesiastes', chapters: 12 },
  { name: 'Song of Solomon', chapters: 8 }, { name: 'Isaiah', chapters: 66 }, { name: 'Jeremiah', chapters: 52 },
  { name: 'Lamentations', chapters: 5 }, { name: 'Ezekiel', chapters: 48 }, { name: 'Daniel', chapters: 12 },
  { name: 'Hosea', chapters: 14 }, { name: 'Joel', chapters: 3 }, { name: 'Amos', chapters: 9 },
  { name: 'Obadiah', chapters: 1 }, { name: 'Jonah', chapters: 4 }, { name: 'Micah', chapters: 7 },
  { name: 'Nahum', chapters: 3 }, { name: 'Habakkuk', chapters: 3 }, { name: 'Zephaniah', chapters: 3 },
  { name: 'Haggai', chapters: 2 }, { name: 'Zechariah', chapters: 14 }, { name: 'Malachi', chapters: 4 },
  { name: 'Matthew', chapters: 28 }, { name: 'Mark', chapters: 16 }, { name: 'Luke', chapters: 24 },
  { name: 'John', chapters: 21 }, { name: 'Acts', chapters: 28 }, { name: 'Romans', chapters: 16 },
  { name: '1 Corinthians', chapters: 16 }, { name: '2 Corinthians', chapters: 13 }, { name: 'Galatians', chapters: 6 },
  { name: 'Ephesians', chapters: 6 }, { name: 'Philippians', chapters: 4 }, { name: 'Colossians', chapters: 4 },
  { name: '1 Thessalonians', chapters: 5 }, { name: '2 Thessalonians', chapters: 3 }, { name: '1 Timothy', chapters: 6 },
  { name: '2 Timothy', chapters: 4 }, { name: 'Titus', chapters: 3 }, { name: 'Philemon', chapters: 1 },
  { name: 'Hebrews', chapters: 13 }, { name: 'James', chapters: 5 }, { name: '1 Peter', chapters: 5 },
  { name: '2 Peter', chapters: 3 }, { name: '1 John', chapters: 5 }, { name: '2 John', chapters: 1 },
  { name: '3 John', chapters: 1 }, { name: 'Jude', chapters: 1 }, { name: 'Revelation', chapters: 22 },
];

router.post('/importFullBible', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const translation = req.body.translation || 'kjv';
    let imported = 0;
    let errors = 0;

    for (const book of BIBLE_BOOKS) {
      for (let ch = 1; ch <= book.chapters; ch++) {
        try {
          const ref = `${book.name} ${ch}`;
          const url = `https://bible-api.com/${encodeURIComponent(ref)}?translation=${translation}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const resp = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);

          if (!resp.ok) { errors++; continue; }
          const data = await resp.json();

          if (data.verses && data.verses.length > 0) {
            await prisma.$transaction(
              data.verses.map(v =>
                prisma.entity.create({
                  data: {
                    type: 'Verse',
                    userId: req.userId,
                    data: {
                      book_name: book.name,
                      chapter: ch,
                      verse: v.verse,
                      text: v.text,
                      translation,
                      user_id: req.userId,
                      created_date: new Date().toISOString(),
                    },
                  },
                })
              )
            );
            imported += data.verses.length;
          }

          // Small delay to avoid hammering the API
          await new Promise(r => setTimeout(r, 200));
        } catch {
          errors++;
        }
      }
    }

    res.json({ message: `Imported ${imported} verses (${errors} chapter errors)`, imported, errors });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Import from Scripture API (api.scripture.api.bible)
// ---------------------------------------------------------------------------
router.post('/importFromScriptureAPI', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const apiKey = process.env.SCRIPTURE_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ message: 'SCRIPTURE_API_KEY not configured. Get a free key at scripture.api.bible' });
    }

    const bibleId = req.body.bibleId || 'de4e12af7f28f599-02'; // KJV
    const baseUrl = `https://api.scripture.api.bible/v1/bibles/${bibleId}`;
    const headers = { 'api-key': apiKey };

    // Fetch list of books
    const booksResp = await fetch(`${baseUrl}/books`, { headers });
    if (!booksResp.ok) {
      return res.status(502).json({ message: `Scripture API returned ${booksResp.status}` });
    }
    const { data: books } = await booksResp.json();

    let imported = 0;
    let errors = 0;

    for (const book of books) {
      try {
        const chaptersResp = await fetch(`${baseUrl}/books/${book.id}/chapters`, { headers });
        if (!chaptersResp.ok) { errors++; continue; }
        const { data: chapters } = await chaptersResp.json();

        for (const chapter of chapters) {
          if (chapter.id === `${book.id}.intro`) continue; // skip intro sections
          try {
            const verseResp = await fetch(`${baseUrl}/chapters/${chapter.id}/verses`, { headers });
            if (!verseResp.ok) { errors++; continue; }
            const { data: verses } = await verseResp.json();

            if (verses && verses.length > 0) {
              await prisma.$transaction(
                verses.map(v =>
                  prisma.entity.create({
                    data: {
                      type: 'Verse',
                      userId: req.userId,
                      data: {
                        book_name: book.name,
                        chapter: parseInt(chapter.number) || 0,
                        verse: parseInt(v.reference?.split(':')[1]) || 0,
                        text: v.text || '',
                        translation: 'kjv',
                        scripture_api_id: v.id,
                        user_id: req.userId,
                        created_date: new Date().toISOString(),
                      },
                    },
                  })
                )
              );
              imported += verses.length;
            }

            await new Promise(r => setTimeout(r, 100));
          } catch {
            errors++;
          }
        }
      } catch {
        errors++;
      }
    }

    res.json({ message: `Imported ${imported} verses from Scripture API (${errors} errors)`, imported, errors });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GitHub sync stub — the FunctionReviewer page has a "sync to GitHub" button.
// In a self-hosted app this is informational only.
// ---------------------------------------------------------------------------
router.post('/syncToGitHub', authenticateToken, requireAdmin, async (_req, res) => {
  res.json({
    ok: true,
    message: 'SermonSmith is self-hosted — use git push to deploy changes.',
  });
});

// Exported so index.js can mount it with express.raw() for signature verification
export async function handleStripeWebhook(req, res) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ message: 'Stripe webhooks not configured' });
  }
  const stripe = await getStripe();
  if (!stripe) {
    return res.status(503).json({ message: 'Stripe webhooks not configured' });
  }

  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // Never log the body — Stripe payloads carry customer email and PII.
    console.error('[Stripe Webhook] signature verification failed:', err.message);
    return res.status(400).json({ message: 'Invalid signature' });
  }

  // Idempotency: short-circuit duplicate deliveries. Stripe will retry on
  // any non-2xx, so we must record `processed` AFTER the side effect
  // succeeds — recording before-the-fact would mean a transient downstream
  // failure leaves the event "seen but never applied".
  const existing = await prisma.stripeEvent.findUnique({ where: { stripeEventId: event.id } }).catch(() => null);
  if (existing) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data?.object;
        const userId = session?.metadata?.userId;
        if (userId) {
          await prisma.user.update({ where: { id: userId }, data: { premium: true } });
        }
        break;
      }
      case 'customer.subscription.deleted':
      case 'customer.subscription.canceled': {
        const sub = event.data?.object;
        const customerId = sub?.customer;
        if (customerId) {
          // Look up the user by Stripe customer email — keeps us schemaless
          // (we don't store stripeCustomerId on User today).
          const customer = await stripe.customers.retrieve(customerId).catch(() => null);
          if (customer?.email) {
            await prisma.user.updateMany({ where: { email: customer.email.toLowerCase() }, data: { premium: false } });
          }
        }
        break;
      }
      default:
        // Unknown event types are accepted (Stripe expects 2xx) but not acted on.
        break;
    }
  } catch (err) {
    console.error('[Stripe Webhook] processing failed:', err.message);
    // Returning 500 here lets Stripe retry. We deliberately do NOT mark
    // the event processed.
    return res.status(500).json({ message: 'Webhook processing failed' });
  }

  // Mark processed only after success.
  try {
    await prisma.stripeEvent.create({ data: { stripeEventId: event.id, type: event.type } });
  } catch (e) {
    if (e.code !== 'P2002') {
      console.error('[Stripe Webhook] failed to record processed event:', e.message);
    }
  }

  res.json({ received: true });
}

// Test-only export so unit tests can drive the SDK lookup.
export const __test = { getStripe };

export default router;
