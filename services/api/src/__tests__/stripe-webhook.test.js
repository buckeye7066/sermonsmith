import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPrismaMock } from './setup.js';

const prisma = createPrismaMock();

vi.mock('../middleware/auth.js', () => ({
  prisma,
  AUTH_COOKIE: 'ss_token',
  cookieOptions: () => ({}),
  authenticateToken: (req, _res, next) => next(),
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
class MockStripe {
  constructor() {
    this.webhooks = { constructEvent: mockConstructEvent };
    this.customers = { list: mockCustomersList, retrieve: mockCustomersRetrieve };
    this.checkout = { sessions: { create: vi.fn() } };
    this.billingPortal = { sessions: { create: vi.fn() } };
  }
}
vi.mock('stripe', () => ({ default: MockStripe }));

process.env.STRIPE_SECRET_KEY = 'sk_test_x';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x';
delete process.env.DISABLE_BILLING;

const { handleStripeWebhook } = await import('../routes/functions.js');

function buildApp() {
  const app = express();
  app.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
  return app;
}

describe('Stripe webhook idempotency + signature verification', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    mockConstructEvent.mockReset();
    mockCustomersRetrieve.mockReset();
    mockCustomersList.mockReset();
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
});
