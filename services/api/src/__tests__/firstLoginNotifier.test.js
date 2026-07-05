/**
 * firstLoginNotifier — the one-time "new user just signed in for the first
 * time" owner email. Contract locked down here:
 *   1. NULL→set transition of lastLoginAt sends exactly one owner email.
 *   2. Subsequent logins re-stamp lastLoginAt but never re-notify.
 *   3. Admin / owner sign-ins are stamped but NEVER notify.
 *   4. Recipient: FIRST_LOGIN_REPORT_EMAIL > ERROR_REPORT_EMAIL > owner default.
 *   5. The helper never throws (fire-and-forget safety).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPrismaMock } from './setup.js';

vi.mock('../services/email.js', () => ({
  sendEmail: vi.fn(async () => ({ ok: true, id: 'em_test' })),
  sendPasswordResetEmail: vi.fn(),
}));

const { recordSuccessfulLogin } = await import('../services/firstLoginNotifier.js');
const { sendEmail } = await import('../services/email.js');

describe('firstLoginNotifier.recordSuccessfulLogin', () => {
  let prisma;
  const envKeys = ['FIRST_LOGIN_REPORT_EMAIL', 'ERROR_REPORT_EMAIL', 'ADMIN_EMAILS'];
  const savedEnv = {};

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma._reset();
    vi.mocked(sendEmail).mockClear();
    for (const k of envKeys) { savedEnv[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of envKeys) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  function seedUser(over = {}) {
    const user = {
      id: 'u1', email: 'newbie@example.com', name: 'Newbie',
      lastLoginAt: null, createdAt: new Date(), updatedAt: new Date(),
      ...over,
    };
    prisma._store.user.push(user);
    return user;
  }

  it('first login stamps lastLoginAt and emails the owner default recipient', async () => {
    const user = seedUser();
    const res = await recordSuccessfulLogin({ prisma, user, method: 'login' });

    expect(res).toMatchObject({ ok: true, firstLogin: true, notified: true });
    expect(prisma._store.user[0].lastLoginAt).toBeInstanceOf(Date);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe('dr.johnwhite@axiombiolabs.org');
    expect(call.subject).toContain('newbie@example.com');
    expect(call.subject).toContain('SermonSmith');
  });

  it('a repeat login re-stamps but does NOT notify', async () => {
    const user = seedUser({ lastLoginAt: new Date('2026-07-01T00:00:00Z') });
    const res = await recordSuccessfulLogin({ prisma, user });

    expect(res).toMatchObject({ ok: true, firstLogin: false });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma._store.user[0].lastLoginAt.getTime()).toBeGreaterThan(Date.parse('2026-07-01'));
  });

  it('admin (ADMIN_EMAILS) and owner sign-ins never notify', async () => {
    process.env.ADMIN_EMAILS = 'Admin@Example.com';
    const admin = seedUser({ id: 'a1', email: 'admin@example.com' });
    expect(await recordSuccessfulLogin({ prisma, user: admin }))
      .toMatchObject({ firstLogin: true, notified: false });

    const owner = seedUser({ id: 'o1', email: 'buckeye7066@gmail.com' });
    expect(await recordSuccessfulLogin({ prisma, user: owner }))
      .toMatchObject({ firstLogin: true, notified: false });

    expect(sendEmail).not.toHaveBeenCalled();
    // Still stamped — tracking is independent of notification.
    expect(prisma._store.user.find((u) => u.id === 'a1').lastLoginAt).toBeInstanceOf(Date);
  });

  it('recipient override order: FIRST_LOGIN_REPORT_EMAIL > ERROR_REPORT_EMAIL', async () => {
    process.env.ERROR_REPORT_EMAIL = 'errors@example.com';
    await recordSuccessfulLogin({ prisma, user: seedUser({ id: 'u2', email: 'a@b.com' }) });
    expect(vi.mocked(sendEmail).mock.calls[0][0].to).toBe('errors@example.com');

    process.env.FIRST_LOGIN_REPORT_EMAIL = 'firstlogins@example.com';
    await recordSuccessfulLogin({ prisma, user: seedUser({ id: 'u3', email: 'c@d.com' }) });
    expect(vi.mocked(sendEmail).mock.calls[1][0].to).toBe('firstlogins@example.com');
  });

  it('never throws — missing prisma/user degrade to a skipped result', async () => {
    expect(await recordSuccessfulLogin({})).toMatchObject({ skipped: true });
    expect(await recordSuccessfulLogin({ prisma })).toMatchObject({ skipped: true });
    // update() throwing (user vanished) is swallowed too.
    const res = await recordSuccessfulLogin({ prisma, user: { id: 'ghost', email: 'g@h.com' } });
    expect(res.ok).toBe(false);
  });
});
