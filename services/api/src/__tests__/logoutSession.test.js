/**
 * POST /api/auth/logout — does the session actually END?
 *
 * A logout test that only asserts `status === 200` is worthless: a handler that
 * emits a Set-Cookie the browser refuses to apply still returns 200 while the
 * user stays signed in. Browsers reject a clearing Set-Cookie whose attributes
 * do not line up with how the cookie was set (a `SameSite=None` cookie cleared
 * without `Secure` is dropped outright; a Domain/Path mismatch targets a
 * different cookie entirely) — so the ATTRIBUTES are the contract, not the
 * status code.
 *
 * These tests therefore assert two things:
 *   1. Attribute parity — every attribute the auth cookie is SET with on
 *      /login is present, and identical, on the clearing Set-Cookie from
 *      /logout, and the clear actually expires the cookie (epoch Expires or
 *      Max-Age=0) and carries no token value.
 *   2. The session is dead afterwards — a cookie-jar client (supertest's
 *      agent, which applies Set-Cookie the way a browser does, expiry
 *      included) gets 200 from /api/auth/me before logout and 401 after.
 *
 * Unlike auth.test.js, this file does NOT mock ../middleware/auth.js: it runs
 * the REAL cookieOptions() and the REAL authenticateToken, because a mocked
 * cookieOptions() would paper over exactly the mismatch this file exists to
 * catch. Only the Prisma client (via the globalThis singleton the middleware
 * caches on) and the email sender are substituted.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createPrismaMock } from './setup.js';

vi.mock('../services/email.js', () => ({
  sendPasswordResetEmail: vi.fn(async () => ({ id: 'mock-email-id' })),
  sendEmail: vi.fn(async () => ({ id: 'mock-email-id' })),
}));

// Hand the real middleware its Prisma singleton BEFORE importing it, so no
// PrismaClient is ever constructed and the real authenticateToken runs against
// the in-memory store.
const prisma = createPrismaMock();
globalThis.__prisma = prisma;

const { AUTH_COOKIE, cookieOptions } = await import('../middleware/auth.js');
const { default: authRoutes } = await import('../routes/auth.js');

const PASSWORD = 'correct-horse-battery';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }));
  return app;
}

async function seedUser(email) {
  const password = await bcrypt.hash(PASSWORD, 4);
  prisma._store.user.push({
    id: `u-${email}`,
    email,
    password,
    name: 'Test User',
    role: 'user',
    premium: false,
    tokenVersion: 0,
  });
}

/** Pick the auth cookie out of a Set-Cookie header array. */
function authCookieHeader(res) {
  const headers = res.headers['set-cookie'] || [];
  const found = headers.find((c) => c.startsWith(`${AUTH_COOKIE}=`));
  expect(found, `no ${AUTH_COOKIE} Set-Cookie header on ${res.req?.path}`).toBeTruthy();
  return found;
}

/**
 * Parse a Set-Cookie header into { value, attrs }.
 * Flag attributes (HttpOnly/Secure) become `true`; keys are lower-cased.
 */
function parseSetCookie(header) {
  const [pair, ...rest] = header.split(';');
  const value = pair.slice(pair.indexOf('=') + 1);
  const attrs = {};
  for (const part of rest) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) attrs[trimmed.toLowerCase()] = true;
    else attrs[trimmed.slice(0, eq).toLowerCase()] = trimmed.slice(eq + 1);
  }
  return { value, attrs };
}

/** True when the header tells the browser to drop the cookie now. */
function expiresImmediately(attrs) {
  if (attrs['max-age'] !== undefined) return Number(attrs['max-age']) <= 0;
  if (attrs.expires !== undefined) return Date.parse(attrs.expires) <= Date.now();
  return false;
}

// Every attribute that decides WHICH cookie a Set-Cookie header addresses, or
// whether the browser will accept it at all.
const MATCHED_ATTRIBUTES = ['httponly', 'secure', 'samesite', 'path', 'domain'];

describe('logout clears the auth cookie with the SAME attributes it was set with', () => {
  const SAVED = {
    COOKIE_SAMESITE: process.env.COOKIE_SAMESITE,
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
  };

  afterEach(() => {
    if (SAVED.COOKIE_SAMESITE === undefined) delete process.env.COOKIE_SAMESITE;
    else process.env.COOKIE_SAMESITE = SAVED.COOKIE_SAMESITE;
    if (SAVED.COOKIE_DOMAIN === undefined) delete process.env.COOKIE_DOMAIN;
    else process.env.COOKIE_DOMAIN = SAVED.COOKIE_DOMAIN;
  });

  beforeEach(() => {
    prisma._reset();
    delete process.env.COOKIE_SAMESITE;
    delete process.env.COOKIE_DOMAIN;
  });

  /** Log in, log out, and hand back both parsed Set-Cookie headers. */
  async function loginThenLogout(email) {
    const app = buildApp();
    await seedUser(email);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: PASSWORD });
    expect(login.status).toBe(200);

    const logout = await request(app).post('/api/auth/logout');
    expect(logout.status).toBe(200);

    return {
      set: parseSetCookie(authCookieHeader(login)),
      clear: parseSetCookie(authCookieHeader(logout)),
    };
  }

  it('matches every attribute in the cross-site production shape (SameSite=None; Secure; Domain)', async () => {
    // The shape the real deployment uses: web on Vercel, API on Railway.
    process.env.COOKIE_SAMESITE = 'none';
    process.env.COOKIE_DOMAIN = '.sermonsmith.app';

    // Guard the premise — if cookieOptions() ever stops producing this shape
    // the parity assertions below would pass vacuously.
    const opts = cookieOptions();
    expect(opts).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      domain: '.sermonsmith.app',
    });

    const { set, clear } = await loginThenLogout('crosssite@example.com');

    expect(set.value).toBeTruthy();
    expect(set.attrs.httponly).toBe(true);
    expect(set.attrs.secure).toBe(true);
    expect(String(set.attrs.samesite).toLowerCase()).toBe('none');
    expect(set.attrs.path).toBe('/');
    expect(set.attrs.domain).toBe('.sermonsmith.app');

    for (const attr of MATCHED_ATTRIBUTES) {
      expect(
        clear.attrs[attr],
        `logout Set-Cookie "${attr}" must match the login Set-Cookie or the browser ignores the clear`
      ).toEqual(set.attrs[attr]);
    }
  });

  it('the clearing cookie expires immediately and carries no token', async () => {
    process.env.COOKIE_SAMESITE = 'none';
    process.env.COOKIE_DOMAIN = '.sermonsmith.app';

    const { clear } = await loginThenLogout('expiry@example.com');

    expect(clear.value).toBe('');
    expect(
      expiresImmediately(clear.attrs),
      `logout Set-Cookie must expire the cookie (Max-Age=0 or epoch Expires); got ${JSON.stringify(clear.attrs)}`
    ).toBe(true);
  });

  it('matches every attribute in the same-site shape (SameSite=Lax, no Domain) too', async () => {
    process.env.COOKIE_SAMESITE = 'lax';

    const { set, clear } = await loginThenLogout('samesite@example.com');

    expect(String(set.attrs.samesite).toLowerCase()).toBe('lax');
    expect(set.attrs.domain).toBeUndefined();
    for (const attr of MATCHED_ATTRIBUTES) {
      expect(clear.attrs[attr], `logout Set-Cookie "${attr}" must match the login Set-Cookie`).toEqual(
        set.attrs[attr]
      );
    }
    expect(clear.attrs.domain).toBeUndefined();
    expect(expiresImmediately(clear.attrs)).toBe(true);
  });
});

describe('logout actually ends the session', () => {
  beforeEach(() => {
    prisma._reset();
  });

  it('a cookie-jar client is authenticated before logout and 401 after it', async () => {
    const app = buildApp();
    const email = 'session@example.com';
    await seedUser(email);

    // supertest's agent keeps a cookie jar and applies Set-Cookie the way a
    // browser does, expiry included — so this replays the real client.
    const agent = request.agent(app);

    const login = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);

    const before = await agent.get('/api/auth/me');
    expect(before.status).toBe(200);
    expect(before.body.email).toBe(email);

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);

    const after = await agent.get('/api/auth/me');
    expect(
      after.status,
      'the pre-logout session must no longer authenticate /api/auth/me'
    ).toBe(401);
    expect(after.body.email).toBeUndefined();
  });

  it('replaying the emptied cookie is rejected, not treated as a session', async () => {
    const app = buildApp();
    const email = 'emptied@example.com';
    await seedUser(email);

    const login = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);

    const logout = await request(app).post('/api/auth/logout');
    const cleared = parseSetCookie(authCookieHeader(logout));

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`${AUTH_COOKIE}=${cleared.value}`]);
    expect(res.status).toBe(401);
  });
});
