import { describe, it, expect, beforeEach } from 'vitest';
import { createPrismaMock } from './setup.js';
import { extendPremiumUntil, grantFreePeriodToUser } from '../lib/premiumGrant.js';

describe('extendPremiumUntil (pure MAX/extend helper)', () => {
  it('returns the candidate when there is no existing window', () => {
    const candidate = new Date('2026-08-01T00:00:00Z');
    expect(extendPremiumUntil(null, candidate)).toBe(candidate);
  });

  it('keeps the existing window when it is later than the candidate', () => {
    const current = new Date('2026-09-01T00:00:00Z');
    const candidate = new Date('2026-08-01T00:00:00Z');
    expect(extendPremiumUntil(current, candidate)).toEqual(current);
  });

  it('extends to the candidate when it is later than the existing window', () => {
    const current = new Date('2026-07-01T00:00:00Z');
    const candidate = new Date('2026-08-01T00:00:00Z');
    expect(extendPremiumUntil(current, candidate)).toBe(candidate);
  });
});

describe('grantFreePeriodToUser (shared admin + signup-trial grant path)', () => {
  let prisma;
  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('stamps premium_until without touching the premium flag', async () => {
    prisma._store.user.push({ id: 'u1', email: 'a@b.com', premium: false, premium_until: null });
    const updated = await grantFreePeriodToUser(prisma, 'u1', 'week');
    expect(updated.premium).toBe(false);
    expect(updated.premium_until).toBeInstanceOf(Date);
    const days = (updated.premium_until.getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it('never shortens an existing longer grant (no double-stack / no shrink)', async () => {
    const farFuture = new Date(Date.now() + 60 * 86400000);
    prisma._store.user.push({ id: 'u2', email: 'b@c.com', premium: false, premium_until: farFuture });
    const updated = await grantFreePeriodToUser(prisma, 'u2', 'week');
    expect(updated.premium_until).toEqual(farFuture);
  });

  it('extends a shorter/expired existing window to the new grant', async () => {
    const past = new Date(Date.now() - 86400000);
    prisma._store.user.push({ id: 'u3', email: 'c@d.com', premium: false, premium_until: past });
    const updated = await grantFreePeriodToUser(prisma, 'u3', 'month');
    expect(updated.premium_until.getTime()).toBeGreaterThan(Date.now());
  });

  it('calling grant twice in a row is idempotent-ish: the second call never moves the date earlier', async () => {
    prisma._store.user.push({ id: 'u4', email: 'd@e.com', premium: false, premium_until: null });
    const first = await grantFreePeriodToUser(prisma, 'u4', 'week');
    const second = await grantFreePeriodToUser(prisma, 'u4', 'week');
    expect(second.premium_until.getTime()).toBeGreaterThanOrEqual(first.premium_until.getTime());
  });

  it('returns null for an unknown user', async () => {
    expect(await grantFreePeriodToUser(prisma, 'ghost', 'week')).toBe(null);
  });

  it('returns null for an invalid period', async () => {
    prisma._store.user.push({ id: 'u5', email: 'e@f.com', premium: false });
    expect(await grantFreePeriodToUser(prisma, 'u5', 'bogus')).toBe(null);
  });
});
