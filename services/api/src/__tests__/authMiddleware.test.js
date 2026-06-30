import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Exercise the REAL authenticateToken middleware (not the route-test stub).
// This is the load-bearing security surface — session revocation, ban, and
// soft-delete enforcement all live here and were previously run by zero tests.
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';

const { authenticateToken, signToken, prisma, AUTH_COOKIE } = await import('../middleware/auth.js');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}
function reqWithToken(token) {
  return { cookies: token ? { [AUTH_COOKIE]: token } : {}, headers: {} };
}
const baseUser = (over = {}) => ({
  role: 'user', premium: false, email: 'u@x.com', tokenVersion: 0,
  deletedAt: null, premium_until: null, is_banned: false, ...over,
});

describe('authenticateToken (real middleware)', () => {
  let findUnique;
  beforeEach(() => { findUnique = vi.spyOn(prisma.user, 'findUnique'); });
  afterEach(() => findUnique.mockRestore());

  it('401 when no token is presented', async () => {
    const res = mockRes(); let nexted = false;
    await authenticateToken(reqWithToken(null), res, () => { nexted = true; });
    expect(res.statusCode).toBe(401);
    expect(nexted).toBe(false);
  });

  it('403 when the account is banned — a ban kills an active session immediately', async () => {
    findUnique.mockResolvedValue(baseUser({ is_banned: true }));
    const res = mockRes(); let nexted = false;
    await authenticateToken(reqWithToken(signToken({ id: 'u1', tokenVersion: 0 })), res, () => { nexted = true; });
    expect(res.statusCode).toBe(403);
    expect(nexted).toBe(false);
  });

  it('401 when the account is soft-deleted', async () => {
    findUnique.mockResolvedValue(baseUser({ deletedAt: new Date() }));
    const res = mockRes(); let nexted = false;
    await authenticateToken(reqWithToken(signToken({ id: 'u1', tokenVersion: 0 })), res, () => { nexted = true; });
    expect(res.statusCode).toBe(401);
    expect(nexted).toBe(false);
  });

  it('401 when the token version is stale (session revoked after password change)', async () => {
    findUnique.mockResolvedValue(baseUser({ tokenVersion: 2 }));
    // Token carries tv:0 but the user is now on tv:2.
    const res = mockRes(); let nexted = false;
    await authenticateToken(reqWithToken(signToken({ id: 'u1', tokenVersion: 0 })), res, () => { nexted = true; });
    expect(res.statusCode).toBe(401);
    expect(nexted).toBe(false);
  });

  it('calls next() for a valid active user and derives premium from the premium_until window', async () => {
    const future = new Date(Date.now() + 86_400_000);
    findUnique.mockResolvedValue(baseUser({ premium_until: future }));
    const req = reqWithToken(signToken({ id: 'u1', tokenVersion: 0 }));
    const res = mockRes(); let nexted = false;
    await authenticateToken(req, res, () => { nexted = true; });
    expect(nexted).toBe(true);
    expect(req.userId).toBe('u1');
    expect(req.userRole).toBe('user');
    expect(req.userPremium).toBe(true); // unexpired trial window counts as premium
  });
});
