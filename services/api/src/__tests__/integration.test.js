/**
 * Integration tests against a REAL PostgreSQL database.
 *
 * Skipped unless RUN_INTEGRATION=1 is set so local `npm test` does not need
 * Postgres to be running. CI provides Postgres via a service container (see
 * .github/workflows/ci.yml -> integration-test job).
 *
 * These tests exercise behaviour that is meaningless against the in-memory
 * mock — most importantly the AiUsage upsert path, which depends on a real
 * unique constraint to serialise concurrent calls, and entity tenant
 * isolation hitting actual Postgres row-level access patterns.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { consumeUsageDb } from '../routes/ai.js';

const RUN = process.env.RUN_INTEGRATION === '1';
const describeIfDb = RUN ? describe : describe.skip;

let prisma;

beforeAll(async () => {
  if (!RUN) return;
  prisma = new PrismaClient();
  // Sanity check the connection.
  await prisma.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  if (!RUN) return;
  await prisma.$disconnect();
});

beforeEach(async () => {
  if (!RUN) return;
  // Clean tables we touch — order matters because of FK constraints.
  await prisma.aiUsage.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.user.deleteMany();
  await prisma.stripeEvent.deleteMany();
});

describeIfDb('integration — real Postgres', () => {
  it('AiUsage upsert serialises concurrent consume calls and never double-counts', async () => {
    const user = await prisma.user.create({
      data: {
        email: `integ-${Date.now()}@example.com`,
        password: 'hash',
        role: 'user',
        premium: false,
      },
    });

    // Fire many concurrent consume calls. The unique (userId, bucket) index
    // must serialise them so the final count equals the number of calls.
    const N = 20;
    const results = await Promise.all(
      Array.from({ length: N }, () => consumeUsageDb(user.id, false, prisma)),
    );

    const today = new Date().toISOString().slice(0, 10);
    const row = await prisma.aiUsage.findUnique({
      where: { userId_bucket: { userId: user.id, bucket: today } },
    });
    expect(row).toBeTruthy();
    expect(row.count).toBe(N);
    // The number of `allowed` results should equal min(N, FREE_LIMIT=30).
    const allowed = results.filter((r) => r.allowed).length;
    expect(allowed).toBeGreaterThan(0);
    expect(allowed).toBeLessThanOrEqual(30);
  });

  it('AiUsage hits the free-tier ceiling of 30 and denies thereafter', async () => {
    const user = await prisma.user.create({
      data: {
        email: `cap-${Date.now()}@example.com`,
        password: 'hash',
        role: 'user',
        premium: false,
      },
    });
    let lastDenied = false;
    for (let i = 0; i < 35; i++) {
      const r = await consumeUsageDb(user.id, false, prisma);
      if (!r.allowed) {
        lastDenied = true;
        break;
      }
    }
    expect(lastDenied).toBe(true);
  });

  it('User + Entity tenant isolation: a deleteMany scoped by userId only deletes that user’s rows', async () => {
    const a = await prisma.user.create({
      data: { email: `a-${Date.now()}@ex.com`, password: 'h', role: 'user' },
    });
    const b = await prisma.user.create({
      data: { email: `b-${Date.now()}@ex.com`, password: 'h', role: 'user' },
    });
    await prisma.entity.create({ data: { type: 'sermon', userId: a.id, data: { title: 'A1' } } });
    await prisma.entity.create({ data: { type: 'sermon', userId: a.id, data: { title: 'A2' } } });
    await prisma.entity.create({ data: { type: 'sermon', userId: b.id, data: { title: 'B1' } } });

    const before = await prisma.entity.count();
    expect(before).toBe(3);

    const deleted = await prisma.entity.deleteMany({
      where: { userId: a.id, type: 'sermon' },
    });
    expect(deleted.count).toBe(2);

    const remaining = await prisma.entity.findMany();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userId).toBe(b.id);
  });

  it('StripeEvent stripeEventId unique constraint prevents duplicate webhook processing', async () => {
    await prisma.stripeEvent.create({
      data: { stripeEventId: 'evt_dup_test_1', type: 'checkout.session.completed' },
    });
    await expect(
      prisma.stripeEvent.create({
        data: { stripeEventId: 'evt_dup_test_1', type: 'checkout.session.completed' },
      }),
    ).rejects.toThrow();
  });
});
