import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPrismaMock } from './setup.js';

const prisma = createPrismaMock();

vi.mock('../middleware/auth.js', () => ({
  prisma,
  AUTH_COOKIE: 'ss_token',
  cookieOptions: () => ({}),
  authenticateToken: (req, _res, next) => {
    req.userId = 'u1';
    next();
  },
  requireAdmin: (req, _res, next) => next(),
  optionalAuth: (req, _res, next) => next(),
  signToken: () => 'tok',
}));

// Mock Stripe SDK so we don't need real keys.
//
// Note: under vitest 4 `vi.fn()` no longer supports being invoked with
// `new`, so we expose a real class as the default export. The shape of
// the instance is identical to what the production code touches.
const mockConstructEvent = vi.fn();
const mockCustomersList = vi.fn();
const mockCustomersRetrieve = vi.fn();
const mockCheckoutCreate = vi.fn();
const mockBillingPortalCreate = vi.fn();
class MockStripe {
  constructor() {
    this.webhooks = { constructEvent: mockConstructEvent };
    this.customers = { list: mockCustomersList, retrieve: mockCustomersRetrieve };
    this.checkout = { sessions: { create: mockCheckoutCreate } };
    this.billingPortal = { sessions: { create: mockBillingPortalCreate } };
  }
}
vi.mock('stripe', () => ({ default: MockStripe }));

process.env.STRIPE_SECRET_KEY = 'sk_test_x';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x';
process.env.STRIPE_PRICE_ID = 'price_123456789abcdef';
process.env.CORS_ORIGIN = 'https://sermonsmith.example';
delete process.env.DISABLE_BILLING;

const { default: functionRoutes, handleStripeWebhook } = await import('../routes/functions.js');

function buildApp() {
  const app = express();
  app.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
  return app;
}

function buildFunctionApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/functions', functionRoutes);
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return app;
}

describe('Stripe webhook idempotency + signature verification', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    mockConstructEvent.mockReset();
    mockCustomersRetrieve.mockReset();
    mockCustomersList.mockReset();
    mockCheckoutCreate.mockReset();
    mockBillingPortalCreate.mockReset();
    mockCheckoutCreate.mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.test/session' });
    mockBillingPortalCreate.mockResolvedValue({ url: 'https://billing.stripe.test/session' });
    delete process.env.FRONTEND_URL;
    process.env.CORS_ORIGIN = 'https://sermonsmith.example';
    app = buildApp();
  });

  it('rejects when signature verification throws', async () => {
    mockConstructEvent.mockImplementation(() => { throw new Error('bad sig'); });
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'invalid')
      .send(Buffer.from('{}'));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/signature/i);
    expect(prisma._store.stripeEvent.length).toBe(0);
  });

  it('grants premium on checkout.session.completed', async () => {
    prisma._store.user.push({ id: 'u1', email: 'a@x', premium: false, role: 'user' });
    mockConstructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { metadata: { userId: 'u1' } } },
    });
    const res = await request(app).post('/webhook').set('Content-Type', 'application/json').set('stripe-signature', 'x').send(Buffer.from('{}'));
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(prisma._store.user.find((u) => u.id === 'u1').premium).toBe(true);
    expect(prisma._store.stripeEvent.length).toBe(1);
  });

  it('short-circuits duplicate deliveries', async () => {
    prisma._store.user.push({ id: 'u1', email: 'a@x', premium: false, role: 'user' });
    prisma._store.stripeEvent.push({ id: 's1', stripeEventId: 'evt_dup', type: 'checkout.session.completed', processedAt: new Date() });
    mockConstructEvent.mockReturnValue({
      id: 'evt_dup',
      type: 'checkout.session.completed',
      data: { object: { metadata: { userId: 'u1' } } },
    });
    const res = await request(app).post('/webhook').set('Content-Type', 'application/json').set('stripe-signature', 'x').send(Buffer.from('{}'));
    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    // Premium NOT re-applied because the user was already non-premium and we short-circuited.
    expect(prisma._store.user.find((u) => u.id === 'u1').premium).toBe(false);
  });

  it('does NOT record processed event on handler failure (so Stripe retries)', async () => {
    prisma._store.user.push({ id: 'u1', email: 'a@x', premium: false, role: 'user' });
    mockConstructEvent.mockReturnValue({
      id: 'evt_fail',
      type: 'checkout.session.completed',
      data: { object: { metadata: { userId: 'u1' } } },
    });
    // Force the user.update to throw.
    const original = prisma.user.update;
    prisma.user.update = vi.fn(async () => { throw new Error('db down'); });
    const res = await request(app).post('/webhook').set('Content-Type', 'application/json').set('stripe-signature', 'x').send(Buffer.from('{}'));
    expect(res.status).toBe(500);
    expect(prisma._store.stripeEvent.length).toBe(0);
    prisma.user.update = original;
  });

  it('revokes premium on subscription cancellation', async () => {
    prisma._store.user.push({ id: 'u1', email: 'a@x', premium: true, role: 'user' });
    mockConstructEvent.mockReturnValue({
      id: 'evt_cancel',
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_x' } },
    });
    mockCustomersRetrieve.mockResolvedValue({ email: 'a@x' });
    const res = await request(app).post('/webhook').set('Content-Type', 'application/json').set('stripe-signature', 'x').send(Buffer.from('{}'));
    expect(res.status).toBe(200);
    expect(prisma._store.user.find((u) => u.id === 'u1').premium).toBe(false);
  });

  it('syncs premium on customer.subscription.updated by stored Stripe customer id', async () => {
    prisma._store.user.push({ id: 'u1', email: 'a@x', premium: false, role: 'user', stripeCustomerId: 'cus_stored' });
    mockConstructEvent.mockReturnValue({
      id: 'evt_update',
      type: 'customer.subscription.updated',
      data: { object: { customer: 'cus_stored', status: 'active' } },
    });
    const res = await request(app).post('/webhook').set('Content-Type', 'application/json').set('stripe-signature', 'x').send(Buffer.from('{}'));
    expect(res.status).toBe(200);
    expect(prisma._store.user.find((u) => u.id === 'u1').premium).toBe(true);
  });
});

describe('Stripe checkout and billing portal routes', () => {
  let app;

  beforeEach(() => {
    prisma._reset();
    mockCustomersRetrieve.mockReset();
    mockCustomersList.mockReset();
    mockCheckoutCreate.mockReset();
    mockBillingPortalCreate.mockReset();
    mockCheckoutCreate.mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.test/session' });
    mockBillingPortalCreate.mockResolvedValue({ url: 'https://billing.stripe.test/session' });
    delete process.env.FRONTEND_URL;
    process.env.CORS_ORIGIN = 'https://sermonsmith.example';
    process.env.STRIPE_PRICE_ID = 'price_123456789abcdef';
    app = buildFunctionApp();
  });

  it('creates checkout with the stored Stripe customer id and public redirect URLs', async () => {
    prisma._store.user.push({
      id: 'u1',
      email: 'a@x',
      premium: false,
      role: 'user',
      stripeCustomerId: 'cus_existing',
    });

    const res = await request(app).post('/api/functions/createCheckoutSession').send({});

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.test/session');
    expect(mockCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'cus_existing',
      customer_email: undefined,
      success_url: 'https://sermonsmith.example/Settings?payment=success',
      cancel_url: 'https://sermonsmith.example/Pricing?payment=cancelled',
      line_items: [{ price: 'price_123456789abcdef', quantity: 1 }],
    }));
  });

  it('opens the billing portal from stored customer id without email lookup', async () => {
    prisma._store.user.push({
      id: 'u1',
      email: 'a@x',
      premium: true,
      role: 'user',
      stripeCustomerId: 'cus_existing',
    });

    const res = await request(app).post('/api/functions/createBillingPortal').send({});

    expect(res.status).toBe(200);
    expect(mockCustomersList).not.toHaveBeenCalled();
    expect(mockBillingPortalCreate).toHaveBeenCalledWith({
      customer: 'cus_existing',
      return_url: 'https://sermonsmith.example/Settings',
    });
  });

  it('rejects production checkout when redirects would fall back to localhost', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    prisma._store.user.push({ id: 'u1', email: 'a@x', premium: false, role: 'user' });

    const res = await request(app).post('/api/functions/createCheckoutSession').send({});

    expect(res.status).toBe(503);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
