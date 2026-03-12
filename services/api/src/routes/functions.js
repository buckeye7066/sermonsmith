import { Router } from 'express';
import { prisma, authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = Router();

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  const Stripe = (await import('stripe')).default;
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Bible passage
router.post('/biblePassage', optionalAuth, async (req, res, next) => {
  try {
    const { book, chapter, translation = 'kjv' } = req.body;
    const ref = `${book} ${chapter}`;
    const url = `https://bible-api.com/${encodeURIComponent(ref)}?translation=${translation}`;

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ message: `Bible API returned ${response.status}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
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
router.post('/getPassageMultiSource', optionalAuth, async (req, res, next) => {
  try {
    const { book, chapter, verse, translations = ['kjv', 'web', 'bbe'] } = req.body;
    const ref = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;

    const results = await Promise.allSettled(
      translations.map(async (t) => {
        const url = `https://bible-api.com/${encodeURIComponent(ref)}?translation=${t}`;
        const resp = await fetch(url);
        if (!resp.ok) return { translation: t, error: `HTTP ${resp.status}` };
        return { translation: t, ...(await resp.json()) };
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
    if (!stripe) return res.status(503).json({ message: 'Stripe not configured. Set STRIPE_SECRET_KEY.' });

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

// Stripe webhook — Note: for production, mount this route on the Express app
// with express.raw() middleware BEFORE express.json() parses the body.
// See: https://docs.stripe.com/webhooks/quickstart
router.post('/stripeWebhook', async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ message: 'Stripe webhooks not configured' });
  }

  try {
    const event = req.body;

    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object;
      const userId = session?.metadata?.userId;
      if (userId) {
        await prisma.user.update({ where: { id: userId }, data: { premium: true } });
        console.log(`[Stripe] Premium granted to user ${userId}`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[Stripe Webhook Error]', err.message);
    res.status(400).json({ message: err.message });
  }
});

// Grant premium (dev/admin)
router.post('/grantMePremium', authenticateToken, async (req, res, next) => {
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
router.post('/listUsers', authenticateToken, async (req, res, next) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'dev')) {
      return res.status(403).json({ message: 'Admin access required' });
    }

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

export default router;
