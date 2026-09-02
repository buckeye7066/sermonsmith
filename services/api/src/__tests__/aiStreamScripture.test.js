import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';

// Streaming Scripture screen (fix #4).
//
// /stream writes model tokens to the client immediately, so a streamed draft
// containing a fabricated reference ("Hezekiah 4:5") reaches the UI before any
// validation runs. The result trailer must therefore report the honest
// Scripture outcome and mark the stream NOT ok, so the client (StreamLLM)
// throws and falls back to /invoke instead of keeping the streamed preview as a
// completed, trusted result.

const prisma = createPrismaMock();

// Configurable streamed content per test.
let STREAM_TEXT = '{"ok":1}';
let STREAM_THROW = false;

vi.mock('../middleware/auth.js', () => ({
  prisma,
  AUTH_COOKIE: 'ss_token',
  cookieOptions: () => ({ httpOnly: true, secure: false, sameSite: 'lax' }),
  signToken: (id) => jwt.sign({ userId: id }, 'test-jwt-secret-that-is-at-least-32-chars-long', { algorithm: 'HS256', expiresIn: '1h' }),
  authenticateToken: async (req, res, next) => {
    const token = req.cookies?.ss_token;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    try {
      const decoded = jwt.verify(token, 'test-jwt-secret-that-is-at-least-32-chars-long', { algorithms: ['HS256'] });
      req.userId = decoded.userId;
      const u = prisma._store.user.find((x) => x.id === decoded.userId);
      req.userRole = u?.role;
      req.userPremium = !!u?.premium;
      next();
    } catch {
      return res.status(401).json({ message: 'Invalid token' });
    }
  },
  requireAdmin: (req, res, next) => next(),
  optionalAuth: (req, _res, next) => next(),
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {
      this.chat = {
        completions: {
          create: vi.fn(async (params) => {
            if (params.stream) {
              return {
                async *[Symbol.asyncIterator]() {
                  // Emit the text as a delta; optionally throw AFTER (simulating a
                  // mid-stream upstream error), else finish normally.
                  yield { choices: [{ delta: { content: STREAM_TEXT } }] };
                  if (STREAM_THROW) throw new Error('upstream stream exploded mid-flight');
                  yield { choices: [{ delta: { content: '' }, finish_reason: 'stop' }] };
                },
              };
            }
            return { choices: [{ message: { content: STREAM_TEXT }, finish_reason: 'stop' }] };
          }),
        },
      };
    }
  },
}));

const { default: aiRoutes, __test } = await import('../routes/ai.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/ai', (req, _res, next) => {
    if (req.body && !Object.prototype.hasOwnProperty.call(req.body, 'feature')) req.body.feature = 'sermon';
    next();
  });
  app.use('/api/ai', aiRoutes);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }));
  return app;
}

const SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';
const tokenFor = (id) => jwt.sign({ userId: id }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
const RS = String.fromCharCode(0x1e);

// The authentic trailer is prefixed with the per-stream nonce delivered in the
// X-Stream-Trailer-Nonce response header. Read both from the supertest response.
function parseTrailer(res) {
  const body = res.text;
  const nonce = res.headers['x-stream-trailer-nonce'];
  const i = body.lastIndexOf(RS);
  if (i === -1 || !nonce) return null;
  const after = body.slice(i + 1);
  if (!after.startsWith(nonce)) return null;
  return JSON.parse(after.slice(nonce.length));
}

describe('/stream fabricated-Scripture screen', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.DISABLE_AI;
    STREAM_TEXT = '{"ok":1}';
    STREAM_THROW = false;
    app = buildApp();
    prisma._store.user.push({ id: 'u-s', email: 's@x', role: 'user', premium: false });
  });

  it('screenStreamedScripture flags a fabricated book but passes clean text', () => {
    expect(__test.screenStreamedScripture('See John 3:16 and Romans 8:28.').ok).toBe(true);
    const bad = __test.screenStreamedScripture('As Hezekiah 4:5 reminds us...');
    expect(bad.ok).toBe(false);
    expect(bad.fabricated).toBe(1);
    // A real deuterocanonical book (chapter-checked in Catholic/Orthodox) passes.
    expect(__test.screenStreamedScripture('Wisdom 3:1 is a comfort.').ok).toBe(true);
  });

  it('screenStreamedScripture catches a LOWERCASE fabricated ref and an out-of-range deuterocanon ref', () => {
    // Case-insensitive: lowercase fabrication is no longer invisible.
    expect(__test.screenStreamedScripture('as hezekiah 4:5 shows').ok).toBe(false);
    // All-canon: Wisdom has 19 chapters in every canon, so ch.99 is out_of_range
    // everywhere — no longer masked as a bare unsupported_canon pass.
    expect(__test.screenStreamedScripture('Wisdom 99:1 teaches').ok).toBe(false);
    // ...while an in-range deuterocanon ref still passes.
    expect(__test.screenStreamedScripture('Sirach 3:1 counsels').ok).toBe(true);
  });

  it('a stream containing a fabricated reference is marked NOT ok in the trailer', async () => {
    STREAM_TEXT = 'Point 1 rests on Hezekiah 4:5, a great promise.';
    const res = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', stream_result: true });
    expect(res.status).toBe(200);
    const trailer = parseTrailer(res);
    expect(trailer).toBeTruthy();
    expect(trailer.ok).toBe(false);
    expect(trailer.scripture.ok).toBe(false);
    expect(trailer.scripture.fabricated).toBe(1);
  });

  it('a clean stream stays ok', async () => {
    STREAM_TEXT = 'Grace abounds — John 3:16, Ephesians 2:8.';
    const res = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', stream_result: true });
    expect(res.status).toBe(200);
    const trailer = parseTrailer(res);
    expect(trailer.ok).toBe(true);
    expect(trailer.scripture.ok).toBe(true);
  });

  it('/invoke fails closed (422) when the completion contains a fabricated reference', async () => {
    STREAM_TEXT = '{"points":["Point about Hezekiah 4:5"]}';
    const res = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(res.status).toBe(422);
    expect(res.body.scripture_unverified).toBe(true);
    expect(res.body.scripture.ok).toBe(false);
  });

  it('/invoke returns clean JSON when references verify', async () => {
    STREAM_TEXT = '{"verse":"John 3:16"}';
    const res = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(res.status).toBe(200);
    expect(res.body.verse).toBe('John 3:16');
  });

  it('/invoke plain-text also screens fabricated Scripture', async () => {
    STREAM_TEXT = 'A short reflection citing Hezekiah 4:5.';
    const res = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p' });
    expect(res.status).toBe(422);
    expect(res.body.scripture_unverified).toBe(true);
  });

  it('/invoke and /stream reject an out-of-range deuterocanonical ref (all-canon screen)', async () => {
    STREAM_TEXT = '{"note":"Wisdom 99:1 is our anchor"}';
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status).toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);

    STREAM_TEXT = 'Wisdom 99:1 is our anchor';
    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', stream_result: true });
    expect(parseTrailer(str).scripture.ok).toBe(false);
  });

  it('/invoke and /stream reject formatting-variant fabricated refs (abbrev, roman-bound, spaced colon)', async () => {
    for (const bad of ['Hez. 4:5', 'II Hezekiah 4:5', 'II John 1:20', 'hezekiah 4 : 5']) {
      STREAM_TEXT = `{"note":"anchored on ${bad}"}`;
      const inv = await request(app)
        .post('/api/ai/invoke')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' } });
      expect(inv.status, `/invoke should reject ${bad}`).toBe(422);

      STREAM_TEXT = `anchored on ${bad}`;
      const str = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', stream_result: true });
      expect(parseTrailer(str).scripture.ok, `/stream should flag ${bad}`).toBe(false);
    }
  });

  // Build raw JSON where spaces/periods INSIDE the string values are \uXXXX
  // escapes — so the raw completion text does NOT contain a literal space (the
  // regex can't match) but JSON.parse decodes it to a real citation. The escape
  // sequences are assembled from String.fromCharCode(92) so no literal "\u"
  // appears in the source (which tooling would normalize to a real space).
  const BS = String.fromCharCode(92);
  const escapeJson = (obj) => JSON.stringify(obj)
    .split(' ').join(`${BS}u0020`)
    .split('.').join(`${BS}u002e`);

  it('/invoke and /stream catch JSON-ESCAPED fabricated citations (decoded parsed value)', async () => {
    const cases = [
      escapeJson({ note: 'Hezekiah 4:5' }),         // escaped space
      escapeJson({ x: 'Hez. 4:5' }),                // escaped period + space
      escapeJson({ y: 'II John 1:20' }),            // roman-bound, no v20 in 2 John
      escapeJson({ points: [{ s: ['II Hezekiah 4:5'] }] }), // nested/array
    ];
    for (const body of cases) {
      // Sanity: the raw text must NOT contain a literal space (proves the
      // escaped form would evade a raw-text-only screen).
      expect(body.includes(' ')).toBe(false);
      STREAM_TEXT = body;
      const inv = await request(app)
        .post('/api/ai/invoke')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' } });
      expect(inv.status, `/invoke should reject escaped ${body}`).toBe(422);
      expect(inv.body.scripture_unverified).toBe(true);

      const str = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
      expect(parseTrailer(str).scripture.ok, `/stream should flag escaped ${body}`).toBe(false);
    }
  });

  it('/invoke passes a JSON-escaped but VALID reference, and a genuinely clean response', async () => {
    STREAM_TEXT = escapeJson({ v: 'John 3:16' }); // raw is escaped, decodes to valid
    expect(STREAM_TEXT.includes(' ')).toBe(false);
    const esc = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(esc.status).toBe(200);
    expect(esc.body.v).toBe('John 3:16');

    STREAM_TEXT = '{"ok":1}';
    const clean = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(clean.status).toBe(200);
  });

  it('/invoke rejects a LOWERCASE fabricated ref', async () => {
    STREAM_TEXT = '{"note":"as hezekiah 4:5 reminds us"}';
    const res = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(res.status).toBe(422);
    expect(res.body.scripture_unverified).toBe(true);
  });

  // --- Round-11: mandatory trailer on the ERROR path ---
  it('a mid-stream upstream error still emits a FAILURE trailer (not a silent trailer-less 200)', async () => {
    STREAM_TEXT = 'Anchored on Hezekiah 4:5.'; // already on the wire when it throws
    STREAM_THROW = true;
    const res = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', stream_result: true });
    // Exactly one trailer, and it reports failure with the fabricated ref flagged.
    expect((res.text.match(new RegExp(RS, 'g')) || []).length).toBe(1);
    const trailer = parseTrailer(res);
    expect(trailer.ok).toBe(false);
    expect(trailer.scripture.ok).toBe(false);
  });

  it('error-path trailer uses the SAME raw+parsed screen: a split/escaped citation then a throw is flagged', async () => {
    for (const body of [
      JSON.stringify({ cross_references: ['Hezekiah', '4:5'] }), // split across array
      JSON.stringify({ note: 'Hezekiah 4:5' }),                  // plain (raw would catch)
    ]) {
      STREAM_TEXT = body;
      STREAM_THROW = true;
      const res = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
      const trailer = parseTrailer(res);
      expect(trailer.ok, `error trailer ok for ${body}`).toBe(false);
      expect(trailer.scripture.ok, `error screen must be as strong as success for ${body}`).toBe(false);
    }
  });

  // --- Round-23: NFKC compatibility folding, position-aware invisibles inside a
  // digit run, and a Unicode-aware citation-start boundary — over /invoke AND
  // /stream (success + error). ---
  it('/invoke + /stream catch NFKC/invisible-hidden fabricated refs and DO NOT flag accented prose', async () => {
    const zwsp = '​';
    // Each: [label, JSON body for /invoke, plain text for /stream, expectFabricated]
    const attacks = [
      ['roman-numeral II John (out of range)', 'Ⅱ John 1:20', true],
      ['math-bold John 99:1', 'John \u{1D7D7}\u{1D7D7}:\u{1D7CF}', true],
      [`ZWSP inside book "Joh${zwsp}n" 99:1`, `Joh${zwsp}n 99:1`, true],
      [`ZWSP inside book "Hezekia${zwsp}h" 4:5`, `Hezekia${zwsp}h 4:5`, true],
      [`ZWSP inside verse "3:9${zwsp}9" (renders 3:99)`, `John 3:9${zwsp}9`, true],
      ['accented prose naïve 4:5', 'naïve 4:5', false],
      ["accented prose L'Oréal 4:5", "L'Oréal 4:5", false],
    ];
    for (const [label, ref, expectFab] of attacks) {
      // /invoke (JSON body)
      STREAM_TEXT = JSON.stringify({ note: `anchored on ${ref}` });
      STREAM_THROW = false;
      const inv = await request(app)
        .post('/api/ai/invoke')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' } });
      if (expectFab) {
        expect(inv.status, `/invoke should reject: ${label}`).toBe(422);
        expect(inv.body.scripture_unverified, `/invoke unverified: ${label}`).toBe(true);
      } else {
        expect(inv.status, `/invoke should pass: ${label}`).toBe(200);
        expect(inv.body.scripture_unverified, `/invoke clean: ${label}`).toBeFalsy();
      }
      // /stream success path (plain text)
      STREAM_TEXT = `anchored on ${ref}`;
      STREAM_THROW = false;
      const str = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', stream_result: true });
      expect(parseTrailer(str).scripture.ok, `/stream success: ${label}`).toBe(!expectFab);
      // /stream ERROR path (throws mid-flight after emitting the same text)
      STREAM_TEXT = `anchored on ${ref}`;
      STREAM_THROW = true;
      const err = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', stream_result: true });
      expect(parseTrailer(err).scripture.ok, `/stream error: ${label}`).toBe(!expectFab);
    }
  });

  // --- Round-24: compatibility numeral-prefix + invisible seam, and non-ASCII
  // decimal digits (Arabic-Indic / Devanagari) — over /invoke AND /stream
  // (success + error). ---
  it('/invoke + /stream catch a folded prefix + invisible seam and non-ASCII decimal digits', async () => {
    const zwsp = '​';
    const ai = (v) => String.fromCodePoint(0x0660 + v); // Arabic-Indic 0-9
    const dv = (v) => String.fromCodePoint(0x0966 + v); // Devanagari 0-9
    const attacks = [
      ['roman Ⅱ + ZWSP seam → 2 John 1:20 (oor)', `Ⅱ${zwsp}John 1:20`, true],
      ['roman Ⅲ + ZWSP seam → 3 John 1:20 (oor)', `Ⅲ${zwsp}John 1:20`, true],
      ['Arabic-Indic John 3:٣٧ (oor)', `John 3:${ai(3)}${ai(7)}`, true],
      ['Arabic-Indic John ٩٩:١ (oor)', `John ${ai(9)}${ai(9)}:${ai(1)}`, true],
      ['Devanagari John ३:३७ (oor)', `John ${dv(3)}:${dv(3)}${dv(7)}`, true],
      ['Arabic-Indic prefix ٢ John 1:20 (oor)', `${ai(2)} John 1:20`, true],
      ['Devanagari John ३:१६ (valid)', `John ${dv(3)}:${dv(1)}${dv(6)}`, false],
      ['plain II John 1:1 (valid)', 'II John 1:1', false],
    ];
    for (const [label, ref, expectFab] of attacks) {
      STREAM_TEXT = JSON.stringify({ note: `anchored on ${ref}` });
      STREAM_THROW = false;
      const inv = await request(app)
        .post('/api/ai/invoke')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' } });
      if (expectFab) {
        expect(inv.status, `/invoke should reject: ${label}`).toBe(422);
        expect(inv.body.scripture_unverified, `/invoke unverified: ${label}`).toBe(true);
      } else {
        expect(inv.status, `/invoke should pass: ${label}`).toBe(200);
        expect(inv.body.scripture_unverified, `/invoke clean: ${label}`).toBeFalsy();
      }
      STREAM_TEXT = `anchored on ${ref}`;
      STREAM_THROW = false;
      const str = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', stream_result: true });
      expect(parseTrailer(str).scripture.ok, `/stream success: ${label}`).toBe(!expectFab);
      STREAM_TEXT = `anchored on ${ref}`;
      STREAM_THROW = true;
      const err = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', stream_result: true });
      expect(parseTrailer(err).scripture.ok, `/stream error: ${label}`).toBe(!expectFab);
    }
  });

  // --- Round-25: complete Unicode-digit folding (Kawi), Roman-numeral
  // chapter/verse, and compact/hyphen numbered-book binding — over /invoke AND
  // /stream (success + error). Split across two tests to stay under the 30/min
  // AI rate limit (each `it` gets a fresh app + limiter via beforeEach). ---
  const runR25 = async (app, attacks) => {
    for (const [label, ref, expectFab] of attacks) {
      STREAM_TEXT = JSON.stringify({ note: `anchored on ${ref}` });
      STREAM_THROW = false;
      const inv = await request(app)
        .post('/api/ai/invoke')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' } });
      if (expectFab) {
        expect(inv.status, `/invoke should reject: ${label}`).toBe(422);
        expect(inv.body.scripture_unverified, `/invoke unverified: ${label}`).toBe(true);
      } else {
        expect(inv.status, `/invoke should pass: ${label}`).toBe(200);
        expect(inv.body.scripture_unverified, `/invoke clean: ${label}`).toBeFalsy();
      }
      STREAM_TEXT = `anchored on ${ref}`;
      STREAM_THROW = false;
      const str = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', stream_result: true });
      expect(parseTrailer(str).scripture.ok, `/stream success: ${label}`).toBe(!expectFab);
      STREAM_TEXT = `anchored on ${ref}`;
      STREAM_THROW = true;
      const err = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', stream_result: true });
      expect(parseTrailer(err).scripture.ok, `/stream error: ${label}`).toBe(!expectFab);
    }
  };

  it('/invoke + /stream catch Roman-numeral chapter/verse and compact numbered-book prefixes', async () => {
    await runR25(app, [
      ['Roman chapter John III:37 (oor)', 'John III:37', true],
      ['Roman verse John 3:XXXVII (oor)', 'John 3:XXXVII', true],
      ['Unicode Roman John Ⅲ:37 (oor)', 'John Ⅲ:37', true],
      ['Roman ch+verse II John I:XX → 2 John 1:20 (oor)', 'II John I:XX', true],
      ['compact 2John 1:20 (oor)', '2John 1:20', true],
      ['hyphen 2-John 1:20 (oor)', '2-John 1:20', true],
      ['dot 2.John 1:20 (oor)', '2.John 1:20', true],
      ['compact roman IIJohn 1:20 (oor)', 'IIJohn 1:20', true],
    ]);
  });

  it('/invoke + /stream catch exotic-digit refs and leave valid refs alone', async () => {
    const kawi = (v) => String.fromCodePoint(0x11F50 + v); // Kawi digits 0-9 (no NFKC fold)
    await runR25(app, [
      ['Kawi digits John 3:37 (oor)', `John 3:${kawi(3)}${kawi(7)}`, true],
      ['plain John 3:16 (valid)', 'John 3:16', false],
      ['plain 1 John 1:1 (valid)', '1 John 1:1', false],
      ['Isaiah 3:1 not split (valid)', 'Isaiah 3:1', false],
    ]);
  });

  // --- Round-26: compact book↔chapter (no space), compact fabricated-book
  // prefixes, and non-canonical Roman numerals — over /invoke AND /stream
  // (success + error). Split for the 30/min AI rate limit. ---
  it('/invoke + /stream catch compact book↔chapter and compact fabricated-book prefixes', async () => {
    const kawi2 = String.fromCodePoint(0x11F52); // Kawi digit 2
    await runR25(app, [
      ['glued John3:37 (oor)', 'John3:37', true],
      ['glued abbrev Jn3:37 (oor)', 'Jn3:37', true],
      ['glued fabricated Hezekiah4:5 (invalid_book)', 'Hezekiah4:5', true],
      ['compact 2Hezekiah 4:5 (invalid_book)', '2Hezekiah 4:5', true],
      ['hyphen 2-Hezekiah 4:5 (invalid_book)', '2-Hezekiah 4:5', true],
      ['Kawi-prefix glued fabricated (invalid_book)', `${kawi2}Hezekiah 4:5`, true],
      ['glued VALID John3:16 (valid)', 'John3:16', false],
      ['non-book cafe4:5 (not flagged)', 'cafe4:5', false],
      ['Isaiah 5:1 not split (valid)', 'Isaiah 5:1', false],
    ]);
  });

  it('/invoke + /stream reject non-canonical Roman numerals and canonical Roman still works', async () => {
    await runR25(app, [
      ['non-canonical John IIV:1 (not valid)', 'John IIV:1', true],
      ['unicode non-canonical John ⅠⅠⅤ:1 (not valid)', 'John ⅠⅠⅤ:1', true],
      ['malformed Roman range John 3:1-IIV (not valid)', 'John 3:1-IIV', true],
      ['canonical John III:37 (oor)', 'John III:37', true],
      ['canonical John IV:2 (valid)', 'John IV:2', false],
      ['plain John 3:16 (valid)', 'John 3:16', false],
    ]);
  });

  // --- Round-27: overlong numeric/Roman tokens (never dropped) and WORDED
  // hyphen/dot numbered-book prefixes — over /invoke AND /stream (success +
  // error), incl. a joined-array (schema-coercion) case. Split for rate limit. ---
  it('/invoke + /stream never drop an overlong number and bind worded hyphen/dot prefixes', async () => {
    const longI = 'I'.repeat(16);
    await runR25(app, [
      ['overlong chapter John 1000:1 (oor)', 'John 1000:1', true],
      ['overlong verse John 3:99999 (oor)', 'John 3:99999', true],
      [`overlong Roman range John 3:1-${longI} (not valid)`, `John 3:1-${longI}`, true],
      ['worded Second-John 1:20 (2 John oor)', 'Second-John 1:20', true],
      ['worded Third.John 1:20 (3 John oor)', 'Third.John 1:20', true],
      ['worded First-John 5:22 (1 John oor)', 'First-John 5:22', true],
      ['valid John 3:16', 'John 3:16', false],
      ['valid Second John 1:1 (spaced)', 'Second John 1:1', false],
    ]);
  });

  it('/invoke + /stream catch a worded hyphen prefix split across a JOINED array', async () => {
    // Schema coercion joins ["Second-John","1:20"] → "Second-John 1:20" for display;
    // the joined-array screen must recombine and flag it (2 John 1:20 out_of_range).
    STREAM_TEXT = JSON.stringify({ cross_references: ['Second-John', '1:20'] });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status).toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);
    STREAM_TEXT = JSON.stringify({ cross_references: ['Second-John', '1:20'] });
    STREAM_THROW = false;
    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok).toBe(false);
    STREAM_THROW = true;
    const err = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(err).scripture.ok).toBe(false);
  });

  // --- Round-28: unsupported numbered-book prefixes (never reinterpreted as
  // bare valid John) and trailing-letter malformed number tokens — over
  // /invoke AND /stream (success + error). Split for the 30/min AI rate limit. ---
  it('/invoke + /stream flag unsupported numbered-book prefixes, keeping supported/bare correct', async () => {
    const arabic4 = String.fromCodePoint(0x0664);
    await runR25(app, [
      ['unsupported 4 John 1:1 (invalid)', '4 John 1:1', true],
      [`unsupported Arabic ${arabic4} John 1:1 (invalid)`, `${arabic4} John 1:1`, true],
      ['unsupported Roman IV John 1:1 (invalid)', 'IV John 1:1', true],
      ['unsupported Fourth-John 1:1 (invalid)', 'Fourth-John 1:1', true],
      ['unsupported 4John 1:1 (invalid)', '4John 1:1', true],
      ['bare Gospel John 1:1 (valid)', 'John 1:1', false],
      ['supported 2 John 1:1 (valid)', '2 John 1:1', false],
      ['spurious 5 Psalms 119:1 → bare Psalms (valid)', '5 Psalms 119:1', false],
    ]);
  });

  it('/invoke + /stream flag trailing-letter malformed number tokens (no truncate-to-valid)', async () => {
    await runR25(app, [
      ['malformed John 3:16I', 'John 3:16I', true],
      ['malformed Psalms 119:176I', 'Psalms 119:176I', true],
      ['malformed range John 3:1-5I', 'John 3:1-5I', true],
      ['malformed range John 3:1-5abc', 'John 3:1-5abc', true],
      ['clean John 3:16 (valid)', 'John 3:16', false],
      ['clean John 3:1-5 (valid)', 'John 3:1-5', false],
      ['clean Psalms 119:176 (valid)', 'Psalms 119:176', false],
    ]);
  });

  it('/invoke + /stream catch an unsupported prefix split across a JOINED array', async () => {
    // ["4 John","1:1"] joins to "4 John 1:1" → fabricated numbered book, flagged.
    STREAM_TEXT = JSON.stringify({ cross_references: ['4 John', '1:1'] });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status).toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);
    STREAM_TEXT = JSON.stringify({ cross_references: ['4 John', '1:1'] });
    STREAM_THROW = false;
    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok).toBe(false);
    STREAM_THROW = true;
    const err = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(err).scripture.ok).toBe(false);
  });

  // --- Round-29: uniform malformed-suffix rule for ROMAN tokens, spaced-
  // separator unsupported prefixes, and Unicode-Roman prefix (no bare-book
  // duplicate) — over /invoke AND /stream (success + error). Split for rate limit. ---
  it('/invoke + /stream flag Roman malformed suffixes; a SPACED-separator outline reads as bare valid book', async () => {
    await runR25(app, [
      ['Roman malformed John 3:XЖ', 'John 3:XЖ', true],
      ['Roman malformed John 3:Xabc (ASCII suffix)', 'John 3:Xabc', true],
      ['Roman malformed John 3:IVé', 'John 3:IVé', true],
      ['Roman malformed range John 3:I-Vabc', 'John 3:I-Vabc', true],
      ['archaic Roman ↁ John 1:1 (invalid)', 'ↁ John 1:1', true],
      ['outline 2 - John 3:16 → valid Gospel (NOT rejected)', '2 - John 3:16', false],
      ['clean John IV:2 (valid)', 'John IV:2', false],
      ['prose John 2:live (no ref → valid)', 'John 2:live your faith', false],
    ]);
  });

  it('/invoke + /stream: a Unicode-Roman prefix produces only the invalid ref (no bare-book duplicate)', async () => {
    // "Ⅳ John 1:1" must screen as fabricated (4 John) with NO valid bare "John 1:1"
    // leaking into the validation output; "Ⅱ John 1:1" stays valid 2 John.
    STREAM_TEXT = JSON.stringify({ note: 'Ⅳ John 1:1' });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status).toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);
    // EVERY screened reference is fabricated (the invalid "4 John") — no bare
    // valid "John 1:1" leaks in, so it is not the case that some are clean.
    // (The extractor-level no-duplicate invariant is asserted in the web tests.)
    expect(inv.body.scripture.fabricated).toBe(inv.body.scripture.checked);
    expect(inv.body.scripture.fabricated).toBeGreaterThan(0);
    STREAM_TEXT = 'Anchored on Ⅳ John 1:1.';
    STREAM_THROW = false;
    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', stream_result: true });
    expect(parseTrailer(str).scripture.ok).toBe(false);
    STREAM_THROW = true;
    const err = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', stream_result: true });
    expect(parseTrailer(err).scripture.ok).toBe(false);
  });

  // --- Round-31: compact numbered book with GLUED chapter, and lowercase
  // non-canonical Roman tokens — over /invoke AND /stream (success + error).
  // Split for the 30/min AI rate limit. ---
  it('/invoke + /stream bind glued compact numbered books and screen lowercase malformed Roman', async () => {
    await runR25(app, [
      ['legit 2John1:1 → 2 John (valid)', '2John1:1', false],
      ['legit 1Cor13:4 → 1 Corinthians (valid)', '1Cor13:4', false],
      ['fabricated 4John1:1 → invalid_book', '4John1:1', true],
      ['fabricated 4-John1:1 → invalid_book', '4-John1:1', true],
      ['lowercase malformed John iiii:2', 'John iiii:2', true],
      ['lowercase malformed John 3:iiii', 'John 3:iiii', true],
      ['clean John iv:2 (valid)', 'John iv:2', false],
      ['prose John 2:live (clean)', 'John 2:live your faith', false],
    ]);
  });

  it('/invoke: a fabricated glued numbered book is flagged and never rebinds to a bare valid John', async () => {
    // "4John1:1" must screen as fabricated (4 John, invalid_book) — NOT reinterpreted
    // as a valid bare "John 1:1" (which would leave fabricated < checked).
    STREAM_TEXT = JSON.stringify({ note: '4John1:1' });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status).toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);
    expect(inv.body.scripture.fabricated).toBe(inv.body.scripture.checked);
    expect(inv.body.scripture.fabricated).toBeGreaterThan(0);
  });

  // --- Round-32: numeric ordinal-suffix prefixes (1st/2nd/3rd/4th/11th) —
  // over /invoke AND /stream (success + error). Split for the 30/min AI limit. ---
  it('/invoke + /stream bind numeric ordinal-suffix prefixes (supported valid, unsupported invalid, never bare John)', async () => {
    await runR25(app, [
      ['1st John 1:1 → 1 John (valid)', '1st John 1:1', false],
      ['2nd John 1:1 → 2 John (valid)', '2nd John 1:1', false],
      ['3rd John 1:1 → 3 John (valid)', '3rd John 1:1', false],
      ['4th John 1:1 → invalid_book', '4th John 1:1', true],
      ['11th John 1:1 → invalid_book', '11th John 1:1', true],
      ['glued 2ndJohn1:1 → 2 John (valid)', '2ndJohn1:1', false],
      ['glued 4thJohn1:1 → invalid_book', '4thJohn1:1', true],
      ['prose "the 1st chapter" (no ref)', 'the 1st chapter of the book', false],
    ]);
  });

  it('/invoke: an unsupported ordinal-suffix numbered book is flagged, never rebinds to bare valid John', async () => {
    STREAM_TEXT = JSON.stringify({ note: '4th John 1:1' });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status).toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);
    expect(inv.body.scripture.fabricated).toBe(inv.body.scripture.checked);
    expect(inv.body.scripture.fabricated).toBeGreaterThan(0);
  });

  // --- Round-33: superscript/NFKC ordinal prefixes and ordinal + spaced
  // punctuation — over /invoke AND /stream (success + error). Split for rate limit. ---
  it('/invoke + /stream bind superscript & spaced-punctuation ordinal prefixes (no bare-John leak)', async () => {
    const sup2nd = `2ⁿᵈ`; // 2ⁿᵈ
    const sup4th = `4ᵗʰ`; // 4ᵗʰ
    await runR25(app, [
      ['superscript 2ⁿᵈ John 1:1 → 2 John (valid)', `${sup2nd} John 1:1`, false],
      ['superscript 4ᵗʰ John 1:1 → invalid_book', `${sup4th} John 1:1`, true],
      ['1st. John 1:1 → 1 John (valid)', '1st. John 1:1', false],
      ['2nd - John 1:1 → 2 John (valid)', '2nd - John 1:1', false],
      ['4th. John 1:1 → invalid_book', '4th. John 1:1', true],
      ['4th- John 1:1 → invalid_book', '4th- John 1:1', true],
      ['outline 2 - John 3:16 → valid bare John', '2 - John 3:16', false],
      ['prose "the 1st chapter" (no ref)', 'the 1st chapter of the book', false],
    ]);
  });

  it('/invoke: an unsupported superscript ordinal is flagged and never rebinds to a bare valid John', async () => {
    STREAM_TEXT = JSON.stringify({ note: `4ᵗʰ John 1:1` }); // 4ᵗʰ John 1:1
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status).toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);
    expect(inv.body.scripture.fabricated).toBe(inv.body.scripture.checked);
    expect(inv.body.scripture.fabricated).toBeGreaterThan(0);
  });

  // --- Round-34: hidden/combining chars inside an ordinal, and superscript
  // FOOTNOTE markers (bounded fold) — over /invoke AND /stream (success +
  // error). Split for the 30/min AI rate limit. ---
  it('/invoke + /stream: ordinal-with-hidden binds (no bare leak), footnote superscripts do not mutate citations', async () => {
    const cp = (x) => String.fromCodePoint(x);
    const ZWSP = cp(0x200B);
    const Nd = cp(0x207F) + cp(0x1D48); // ⁿᵈ
    const Th = cp(0x1D57) + cp(0x02B0); // ᵗʰ
    const SUP1 = cp(0xB9), SUP2 = cp(0xB2);
    await runR25(app, [
      [`2${ZWSP}nd John 1:1 → 2 John (valid)`, `2${ZWSP}nd John 1:1`, false],
      [`4${ZWSP}th John 1:1 → invalid_book`, `4${ZWSP}th John 1:1`, true],
      [`superscript 2${Nd} John 1:1 → 2 John (valid)`, `2${Nd} John 1:1`, false],
      [`superscript 4${Th} John 1:1 → invalid_book`, `4${Th} John 1:1`, true],
      [`ambiguous trailing John 3:16${SUP1} → FAIL CLOSED (flagged)`, `John 3:16${SUP1}`, true],
      [`empty-slot superscript John${SUP2}:1 → folds to valid John 2:1`, `John${SUP2}:1`, false],
      ['outline 2 - John 3:16 → valid bare John', '2 - John 3:16', false],
      ['ascii 4th John 1:1 → invalid_book', '4th John 1:1', true],
    ]);
  });

  it('/invoke: an ordinal hidden-seam fabricated book is flagged and never rebinds to a bare valid John', async () => {
    STREAM_TEXT = JSON.stringify({ note: `4${String.fromCodePoint(0x200B)}th John 1:1` });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status).toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);
    expect(inv.body.scripture.fabricated).toBe(inv.body.scripture.checked);
    expect(inv.body.scripture.fabricated).toBeGreaterThan(0);
  });

  // --- Round-35: Unicode-digit ordinals, superscript number-data vs footnote,
  // and phantom-zero digit folding — over /invoke AND /stream (success + error). ---
  it('/invoke + /stream bind Unicode-digit ordinals and fold superscript number data (no phantom zeros)', async () => {
    const cp = (x) => String.fromCodePoint(x);
    const ZWSP = cp(0x200B);
    const FW4 = cp(0xFF14), MATH2 = cp(0x1D7DA), MATH3 = cp(0x1D7DB), MATH1 = cp(0x1D7D9), MATH6 = cp(0x1D7DE);
    const SUP1 = cp(0xB9), SUP6 = cp(0x2076), SUP5 = cp(0x2075);
    await runR25(app, [
      [`fullwidth ${FW4}${ZWSP}th John 1:1 → invalid_book`, `${FW4}${ZWSP}th John 1:1`, true],
      [`math ${MATH2}${ZWSP}nd John 1:1 → 2 John (valid)`, `${MATH2}${ZWSP}nd John 1:1`, false],
      [`math digits John ${MATH3}:${MATH1}${MATH6} → John 3:16 (valid, no phantom)`, `John ${MATH3}:${MATH1}${MATH6}`, false],
      [`superscript verse John 3:${SUP1}${SUP6} → John 3:16 (valid, folded)`, `John 3:${SUP1}${SUP6}`, false],
      [`superscript verse Hezekiah 4:${SUP5} → invalid_book (not dropped)`, `Hezekiah 4:${SUP5}`, true],
      [`ambiguous trailing John 3:16${SUP1} → FAIL CLOSED (flagged)`, `John 3:16${SUP1}`, true],
      ['ascii 4th John 1:1 → invalid_book', '4th John 1:1', true],
      ['outline 2 - John 3:16 → valid bare John', '2 - John 3:16', false],
    ]);
  });

  // --- Round-36: control-char (Cc) ordinal seams (shared hidden class), and
  // fail-closed on ambiguous ASCII-adjacent superscript numbers. ---
  it('/invoke + /stream: control-seam ordinals bind, and ambiguous superscript numbers fail closed', async () => {
    const cp = (x) => String.fromCodePoint(x);
    const NUL = cp(0x00), C1 = cp(0x9D);
    const SUP1 = cp(0xB9), SUP6 = cp(0x2076), SUP7 = cp(0x2077);
    await runR25(app, [
      [`control-seam 2${C1}nd John 1:1 → 2 John (valid)`, `2${C1}nd John 1:1`, false],
      [`control-seam 4${NUL}th John 1:1 → invalid_book (no bare John)`, `4${NUL}th John 1:1`, true],
      [`empty-slot John 3:${SUP1}${SUP6} → John 3:16 (valid, folded)`, `John 3:${SUP1}${SUP6}`, false],
      [`ambiguous John 3:3${SUP7} → FAIL CLOSED (flagged, not John 3:3)`, `John 3:3${SUP7}`, true],
      [`ambiguous John 3:1${SUP6} → FAIL CLOSED (flagged, not John 3:1)`, `John 3:1${SUP6}`, true],
      [`ambiguous John 3:16${SUP1} → FAIL CLOSED (flagged)`, `John 3:16${SUP1}`, true],
      ['ascii 4th John 1:1 → invalid_book', '4th John 1:1', true],
      ['outline 2 - John 3:16 → valid bare John', '2 - John 3:16', false],
    ]);
  });

  // --- Round-37: Unicode-separator ordinal seams (complete shared seam class),
  // and seam-tolerant fail-closed superscript handling. ---
  it('/invoke + /stream: Unicode-separator ordinal seams bind, and seamed superscript numbers fail closed', async () => {
    const cp = (x) => String.fromCodePoint(x);
    const NBSP = cp(0x00A0), HAIR = cp(0x200A), ZWSP = cp(0x200B);
    const SUP1 = cp(0xB9), SUP6 = cp(0x2076);
    await runR25(app, [
      [`separator 2${NBSP}nd John 1:1 → 2 John (valid)`, `2${NBSP}nd John 1:1`, false],
      [`separator 4${HAIR}th John 1:1 → invalid_book (no bare John)`, `4${HAIR}th John 1:1`, true],
      [`seamed superscript John 3:1${ZWSP}${SUP6} → FAIL CLOSED`, `John 3:1${ZWSP}${SUP6}`, true],
      [`seamed superscript John 3:1${NBSP}${SUP6} → FAIL CLOSED`, `John 3:1${NBSP}${SUP6}`, true],
      [`range-end seam John 3:1-3${ZWSP}${SUP6} → FAIL CLOSED`, `John 3:1-3${ZWSP}${SUP6}`, true],
      [`empty-slot John 3:${SUP1}${SUP6} → John 3:16 (valid)`, `John 3:${SUP1}${SUP6}`, false],
      ['ascii 4th John 1:1 → invalid_book', '4th John 1:1', true],
      ['outline 2 - John 3:16 → valid bare John', '2 - John 3:16', false],
    ]);
  });

  // --- Round-38: ASCII/whitespace seams (tab/LF/CR) in both bounded contexts,
  // and multi-line refs preserved. ---
  it('/invoke + /stream: whitespace ordinal seams bind, whitespace superscript seams fail closed, multi-line refs intact', async () => {
    const cp = (x) => String.fromCodePoint(x);
    const SUP6 = cp(0x2076);
    await runR25(app, [
      ['tab-seam 2\tnd John 1:1 → 2 John (valid)', '2\tnd John 1:1', false],
      ['tab-seam 4\tth John 1:1 → invalid_book (no bare John)', '4\tth John 1:1', true],
      [`tab superscript John 3:1\t${SUP6} → FAIL CLOSED`, `John 3:1\t${SUP6}`, true],
      [`range-end seam John 3:1-3\r${SUP6} → FAIL CLOSED`, `John 3:1-3\r${SUP6}`, true],
      ['outline 2 - John 3:16 → valid bare John', '2 - John 3:16', false],
      ['ascii 4th John 1:1 → invalid_book', '4th John 1:1', true],
      ['valid 1 John 5:4', '1 John 5:4', false],
      ['empty-slot John 3:16 valid', 'John 3:16', false],
    ]);
  });

  // --- Round-39: (RESTORED) a valid MULTILINE JSON string must not be rejected
  // by raw-JSON escape fabrication; screen the parsed value authoritatively.
  // Routed through the real JSON transport (STREAM_TEXT is the raw model output). ---
  it('/invoke: a valid multiline JSON string ("John 3:16\\nMark 1:1", REAL newline) passes with no fabricated Nmark', async () => {
    STREAM_TEXT = JSON.stringify({ text: 'John 3:16\nMark 1:1' }); // real newline; JSON-escapes on the wire
    STREAM_THROW = false;
    const res = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    // Status 200 (not 422) proves the valid multiline ref was NOT rejected by a
    // raw-JSON-escape fabrication; the body is the authoritative parsed value.
    expect(res.status, 'valid multiline must NOT 422').toBe(200);
    expect(res.body).toEqual({ text: 'John 3:16\nMark 1:1' });
  });

  it('/stream: a valid multiline JSON string passes (clean trailer, no raw-escape false-reject)', async () => {
    STREAM_TEXT = JSON.stringify({ text: 'John 3:16\nMark 1:1' });
    STREAM_THROW = false;
    const res = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    const trailer = parseTrailer(res);
    expect(trailer.scripture.ok, 'valid multiline stream must be ok').toBe(true);
    expect(trailer.scripture.fabricated).toBe(0);
  });

  it('/invoke + /stream: literal backslash-escape seams still bind/fail-closed (defense in depth)', async () => {
    const cp = (x) => String.fromCodePoint(x);
    const BS = '\\';
    const SUP6 = cp(0x2076);
    await runR25(app, [
      [`literal 4${BS}nth John 1:1 → invalid_book (no bare John)`, `4${BS}nth John 1:1`, true],
      [`literal 2${BS}nnd John 1:1 → 2 John (valid)`, `2${BS}nnd John 1:1`, false],
      [`literal superscript John 3:1${BS}n${SUP6} → FAIL CLOSED`, `John 3:1${BS}n${SUP6}`, true],
      [`double 4${BS}${BS}nth John 1:1 → invalid_book`, `4${BS}${BS}nth John 1:1`, true],
      ['prose backslash C:\\name (no ref)', 'the path C:\\name here', false],
      ['ascii 4th John 1:1 → invalid_book', '4th John 1:1', true],
      ['outline 2 - John 3:16 → valid bare John', '2 - John 3:16', false],
      ['valid John 3:16', 'John 3:16', false],
    ]);
  });

  it('a hanging audit store cannot block the mandatory failure trailer (written before audit)', async () => {
    const spy = vi.spyOn(prisma.aiAuditLog, 'create').mockImplementation(() => new Promise(() => {})); // never resolves
    try {
      STREAM_TEXT = 'Anchored on Hezekiah 4:5.';
      STREAM_THROW = true;
      const res = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', stream_result: true });
      // Response completed with exactly one failure trailer despite the stalled audit.
      expect((res.text.match(new RegExp(RS, 'g')) || []).length).toBe(1);
      const trailer = parseTrailer(res);
      expect(trailer.ok).toBe(false);
      expect(trailer.scripture.ok).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('writes the trailer EXACTLY ONCE on the normal success path (no double-write)', async () => {
    STREAM_TEXT = 'Grace abounds — John 3:16.';
    const res = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', stream_result: true });
    expect((res.text.match(new RegExp(RS, 'g')) || []).length).toBe(1);
    expect(parseTrailer(res).ok).toBe(true);
  });

  // --- Round-15/16: unforgeable trailer frame (server strips RS + per-stream nonce) ---
  it('replaces a model-injected RS byte so the client sees exactly one AUTHENTIC (nonce) trailer', async () => {
    // The model tries to inject its own frame: an RS + a perfectly-shaped success trailer.
    STREAM_TEXT = `Injected${RS}{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":0,"fabricated":0}} and more`;
    const res = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', stream_result: true });
    // Exactly one RS remains — the server's — followed by the per-stream nonce.
    expect((res.text.match(new RegExp(RS, 'g')) || []).length).toBe(1);
    const nonce = res.headers['x-stream-trailer-nonce'];
    expect(nonce).toBeTruthy();
    const i = res.text.lastIndexOf(RS);
    expect(res.text.slice(i + 1).startsWith(nonce)).toBe(true);
    // The model's injected "trailer" is now inert content (RS → space).
    expect(res.text).toContain('Injected {"ok":true');
    expect(parseTrailer(res).ok).toBe(true);
  });

  it('issues a DIFFERENT per-stream nonce on each stream', async () => {
    STREAM_TEXT = 'John 3:16';
    const a = await request(app).post('/api/ai/stream').set('Cookie', [`ss_token=${tokenFor('u-s')}`]).send({ prompt: 'p', stream_result: true });
    const b = await request(app).post('/api/ai/stream').set('Cookie', [`ss_token=${tokenFor('u-s')}`]).send({ prompt: 'p', stream_result: true });
    const na = a.headers['x-stream-trailer-nonce'];
    const nb = b.headers['x-stream-trailer-nonce'];
    expect(na).toBeTruthy();
    expect(nb).toBeTruthy();
    expect(na).not.toBe(nb);
  });

  it('catches INVISIBLE separators (zero-width / C1 / DEL / variation-selector / CGJ / Mongolian-FVS / combining-mark) on /invoke and /stream', async () => {
    for (const cp of [0x200b, 0x2060, 0xfeff, 0x00ad, 0x7f, 0x9f, 0x034f, 0xfe0f, 0x180b, 0xe0100, 0x0300, 0x0301, 0x20dd]) {
      const sep = String.fromCodePoint(cp);
      STREAM_TEXT = JSON.stringify({ cross_references: [`Hezekiah${sep}4:5`] });
      const inv = await request(app)
        .post('/api/ai/invoke')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' } });
      expect(inv.status, `/invoke U+${cp.toString(16)}`).toBe(422);
      expect(inv.body.scripture_unverified).toBe(true);

      const str = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
      expect(parseTrailer(str).scripture.ok, `/stream U+${cp.toString(16)}`).toBe(false);
    }
  });

  it('does NOT falsely flag decomposed accented prose (café/résumé 4:5) on /invoke or /stream', async () => {
    const acute = String.fromCodePoint(0x0301);
    for (const text of [`cafe${acute} 4:5`, `re${acute}sume${acute} 4:5`, 'café 4:5', 'cafe 4:5']) {
      STREAM_TEXT = JSON.stringify({ note: text });
      const inv = await request(app)
        .post('/api/ai/invoke')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' } });
      expect(inv.status, `/invoke ${JSON.stringify([...text])}`).toBe(200);

      const str = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
      expect(parseTrailer(str).scripture.ok, `/stream ${JSON.stringify([...text])}`).toBe(true);
    }
  });

  it('catches a WORD-INTERNAL mark hiding a KNOWN book out of range on /invoke and /stream', async () => {
    const acute = String.fromCodePoint(0x0301);
    const dot = String.fromCodePoint(0x0307);
    for (const attack of [`Joh${acute}n 99:1`, `Joh${dot}n 99:1`, `II Joh${dot}n 99:1`]) {
      STREAM_TEXT = JSON.stringify({ note: attack });
      const inv = await request(app)
        .post('/api/ai/invoke')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' } });
      expect(inv.status, `/invoke ${JSON.stringify([...attack])}`).toBe(422);

      const str = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
      expect(parseTrailer(str).scripture.ok, `/stream ${JSON.stringify([...attack])}`).toBe(false);
    }
  });

  it('catches a mark-HIDDEN fabricated book (mark before space, NFC-composed, or before digit) on /invoke and /stream', async () => {
    const grave = String.fromCodePoint(0x0300); // no precomposed form
    const dot = String.fromCodePoint(0x0307);   // NFC composes h+dot -> ḣ
    for (const attack of [`Hezekiah${grave} 4:5`, `Hezekiah${dot} 4:5`, `Hezekiah${dot}4:5`]) {
      STREAM_TEXT = JSON.stringify({ note: attack });
      const inv = await request(app)
        .post('/api/ai/invoke')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' } });
      expect(inv.status, `/invoke ${JSON.stringify([...attack])}`).toBe(422);
      expect(inv.body.scripture_unverified).toBe(true);

      const str = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
      expect(parseTrailer(str).scripture.ok, `/stream ${JSON.stringify([...attack])}`).toBe(false);
    }
  });

  it('normalizes a JSON-ESCAPED control-split citation before screening (server /stream + /invoke)', async () => {
    const RSesc = `Hezekiah${RS}4:5`; // decoded control-split; screen must recombine → invalid_book
    STREAM_TEXT = JSON.stringify({ note: RSesc });
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status).toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok).toBe(false);
  });

  // --- Round-10 R10-1: streaming without stream_result is rejected (fail closed) ---
  it('a fabricated reference streamed WITHOUT stream_result is NOT accepted silently', async () => {
    STREAM_TEXT = 'Anchored on Hezekiah 4:5.';
    const res = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p' }); // no stream_result
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/stream_result/);
  });

  // --- Round-10 R10-2: split/coerced citations across array/object values ---
  it('/invoke and /stream catch a citation SPLIT across array elements', async () => {
    for (const obj of [{ cross_references: ['Hezekiah', '4:5'] }, { x: ['II John', '1:20'] }]) {
      STREAM_TEXT = JSON.stringify(obj);
      const inv = await request(app)
        .post('/api/ai/invoke')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' } });
      expect(inv.status, `/invoke should flag split ${STREAM_TEXT}`).toBe(422);

      const str = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
      expect(parseTrailer(str).scripture.ok, `/stream should flag split ${STREAM_TEXT}`).toBe(false);
    }
  });

  it('a legit array of SEPARATE valid references still passes', async () => {
    STREAM_TEXT = JSON.stringify({ cross_references: ['Romans 8:28', 'John 3:16'] });
    const res = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(res.status).toBe(200);
  });

  it('rejects an array/object supplied where the schema requires a string field', async () => {
    STREAM_TEXT = JSON.stringify({ note: ['Hezekiah', '4:5'] });
    const schema = { type: 'object', properties: { note: { type: 'string' } } };
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: schema });
    expect(inv.status).toBe(422);
    expect(inv.body.schema_type_violation).toBe(true);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: schema, stream_result: true });
    expect(parseTrailer(str).ok).toBe(false);
  });

  it('violatesStringSchema: string field with array/object → true; matching types → false', () => {
    const schema = { type: 'object', properties: { note: { type: 'string' }, refs: { type: 'array', items: { type: 'string' } } } };
    expect(__test.violatesStringSchema(schema, { note: ['a', 'b'] })).toBe(true);
    expect(__test.violatesStringSchema(schema, { note: 'ok', refs: ['a', 'b'] })).toBe(false);
  });

  it('the fabricated reference is recorded honestly in the audit row', async () => {
    STREAM_TEXT = 'Hezekiah 4:5 is my anchor.';
    await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', stream_result: true });
    const audit = prisma._store.aiAuditLog.at(-1);
    expect(audit.status).toBe('unverified_scripture');
    expect(audit.failureType).toBe('unverified_scripture');
  });

  // --- Round-40: the screen must cover the COMPLETE emitted surface — not only
  // decoded string VALUES, but object KEYS and any non-JSON PREFIX/SUFFIX text
  // that extractJson leaves outside the parsed/salvaged object. Two false-accepts
  // (a fabricated ref hidden as a JSON key; a fabricated ref in trailing prose
  // after a salvaged object) must be caught by /invoke AND /stream. Plus the
  // escaped-space seam (BY CONSTRUCTION) routed through the real transport. ---
  it('/invoke + /stream catch a fabricated ref hidden in a JSON KEY (not just values)', async () => {
    STREAM_TEXT = JSON.stringify({ 'Hezekiah 4:5': 'safe' });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status, '/invoke must flag a fabricated JSON key').toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);
    expect(inv.body.scripture.ok).toBe(false);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok, '/stream must flag a fabricated JSON key').toBe(false);
  });

  it('/invoke + /stream catch a fabricated ref in TRAILING prose after a salvaged JSON object', async () => {
    // extractJson salvages {"text":"safe"} but the model also emitted a fabricated
    // citation OUTSIDE the object — the leftover suffix must still be screened.
    STREAM_TEXT = '{"text":"safe"}\nHezekiah 4:5';
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status, '/invoke must flag trailing-prose fabrication').toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok, '/stream must flag trailing-prose fabrication').toBe(false);
  });

  it('/invoke passes a clean object with a VALID ref in a key and blank trailing whitespace', async () => {
    // A valid ref in a key + only whitespace outside the object must NOT false-reject.
    STREAM_TEXT = '{"John 3:16":"anchor"}\n\n';
    STREAM_THROW = false;
    const res = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(res.status, 'valid key + blank suffix must NOT 422').toBe(200);
  });

  it('/invoke + /stream: escaped-space seams (BY CONSTRUCTION) bind/fail-closed through the transport', async () => {
    const BS = String.fromCharCode(92);
    const SUP6 = String.fromCodePoint(0x2076);
    await runR25(app, [
      [`escaped-space 4${BS}u0020th John 1:1 → invalid_book (no bare John)`, `4${BS}u0020th John 1:1`, true],
      [`escaped-space 2${BS}u0020nd John 1:1 → 2 John (valid)`, `2${BS}u0020nd John 1:1`, false],
      [`hex-escaped 4${BS}x20th John 1:1 → invalid_book`, `4${BS}x20th John 1:1`, true],
      [`escaped-space superscript John 3:1${BS}u0020${SUP6} → FAIL CLOSED`, `John 3:1${BS}u0020${SUP6}`, true],
      [`non-seam escape 4${BS}u0041th John 1:1 → bare John (A is NOT a seam)`, `4${BS}u0041th John 1:1`, false],
      ['ascii 4th John 1:1 → invalid_book', '4th John 1:1', true],
      ['outline 2 - John 3:16 → valid bare John', '2 - John 3:16', false],
      ['valid John 3:16', 'John 3:16', false],
    ]);
  });

  // --- Round-41: (1) the reserved `scripture_validation` key is a persistence-
  // only skip; on the LIVE screen the whole subtree is screened (no blind spot).
  // (2) escape decoding reconstructs FULL codepoints (surrogate pairs + \u{...}),
  // so escaped SUPPLEMENTARY seam chars are caught by construction. ---
  it('/invoke + /stream screen a fabricated ref hidden under the reserved scripture_validation key', async () => {
    const bodies = [
      JSON.stringify({ scripture_validation: { x: 'Hezekiah 4:5' } }),         // value
      JSON.stringify({ scripture_validation: { 'Hezekiah 4:5': 'safe' } }),    // key
      JSON.stringify({ scripture_validation: { refs: ['Hezekiah', '4:5'] } }), // split array (joined)
    ];
    for (const body of bodies) {
      STREAM_TEXT = body;
      STREAM_THROW = false;
      const inv = await request(app)
        .post('/api/ai/invoke')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' } });
      expect(inv.status, `/invoke reserved-key ${body}`).toBe(422);
      expect(inv.body.scripture_unverified).toBe(true);

      const str = await request(app)
        .post('/api/ai/stream')
        .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
        .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
      expect(parseTrailer(str).scripture.ok, `/stream reserved-key ${body}`).toBe(false);
    }
  });

  it('/invoke + /stream: escaped SUPPLEMENTARY seam codepoints (surrogate pair + \\u{...}) bind/fail-closed', async () => {
    const BS = String.fromCharCode(92);
    const SUP6 = String.fromCodePoint(0x2076);
    await runR25(app, [
      [`surrogate-pair E0100 4${BS}uDB40${BS}uDD00th John 1:1 → invalid_book`, `4${BS}uDB40${BS}uDD00th John 1:1`, true],
      [`braced ${BS}u{E0100} 4th John 1:1 → invalid_book`, `4${BS}u{E0100}th John 1:1`, true],
      [`braced ${BS}u{2028} 4th John 1:1 → invalid_book`, `4${BS}u{2028}th John 1:1`, true],
      [`surrogate-pair E0100 superscript John 3:1 → FAIL CLOSED`, `John 3:1${BS}uDB40${BS}uDD00${SUP6}`, true],
      [`non-seam emoji ${BS}u{1F600} 4th John 1:1 → bare valid John`, `4${BS}u{1F600}th John 1:1`, false],
      ['valid John 3:16', 'John 3:16', false],
    ]);
  });

  // --- Round-42: MIXED literal/escaped surrogate seams (one half a literal code
  // unit, the other an escape token — BOTH orders) decode to the same codepoint
  // and hit the same seam test, through the real transport. ---
  it('/invoke + /stream: MIXED literal/escaped surrogate seams (both orders) bind/fail-closed', async () => {
    const BS = String.fromCharCode(92);
    const SUP6 = String.fromCodePoint(0x2076);
    const HI = String.fromCharCode(0xDB40), LO = String.fromCharCode(0xDD00); // literal halves of U+E0100
    const EHI = `${BS}uDB40`, ELO = `${BS}uDD00`;                              // escaped halves
    const EMLO = String.fromCharCode(0xDE00);                                 // literal low half of emoji U+1F600
    await runR25(app, [
      [`high-esc+low-lit E0100 ordinal → invalid_book`, `4${EHI}${LO}th John 1:1`, true],
      [`high-lit+low-esc E0100 ordinal → invalid_book`, `4${HI}${ELO}th John 1:1`, true],
      [`high-esc+low-lit E0100 superscript → FAIL CLOSED`, `John 3:1${EHI}${LO}${SUP6}`, true],
      [`high-lit+low-esc E0100 superscript → FAIL CLOSED`, `John 3:1${HI}${ELO}${SUP6}`, true],
      [`non-seam mixed emoji ${BS}uD83D+low-lit → bare valid John`, `4${BS}uD83D${EMLO}th John 1:1`, false],
      ['valid John 3:16', 'John 3:16', false],
    ]);
  });

  it('/invoke + /stream catch a MIXED-surrogate fabricated seam hidden under scripture_validation', async () => {
    const BS = String.fromCharCode(92);
    const HI = String.fromCharCode(0xDB40), ELO = `${BS}uDD00`; // high-literal + low-escaped E0100
    STREAM_TEXT = JSON.stringify({ scripture_validation: { note: `4${HI}${ELO}th John 1:1` } });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status, '/invoke mixed-surrogate under reserved key').toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok, '/stream mixed-surrogate under reserved key').toBe(false);
  });

  // --- Round-43: an escaped seam AFTER the ordinal suffix (suffix↔book position)
  // is now decoded to a real seam by the global pre-pass, so it binds the
  // fabricated numbered book like a real seam — every representation, every
  // position — through the real transport. ---
  it('/invoke + /stream: escaped seams at the suffix↔book position bind the fabricated numbered book', async () => {
    const BS = String.fromCharCode(92);
    const HI = String.fromCharCode(0xDB40), LO = String.fromCharCode(0xDD00);
    await runR25(app, [
      [`4th${BS}u200BJohn 1:1 → 4 John invalid_book`, `4th${BS}u200BJohn 1:1`, true],
      [`4th${BS}u{E0100}John 1:1 → 4 John invalid_book`, `4th${BS}u{E0100}John 1:1`, true],
      [`4th${BS}uDB40<lit-low>John 1:1 → 4 John invalid_book`, `4th${BS}uDB40${LO}John 1:1`, true],
      [`4th<lit-high>${BS}uDD00John 1:1 → 4 John invalid_book`, `4th${HI}${BS}uDD00John 1:1`, true],
      [`non-seam 4th${BS}u{1F600}John 1:1 → bare valid John`, `4th${BS}u{1F600}John 1:1`, false],
      ['valid John 3:16', 'John 3:16', false],
    ]);
  });

  it('/invoke + /stream catch a suffix↔book escaped-seam fabrication hidden under scripture_validation', async () => {
    const BS = String.fromCharCode(92);
    STREAM_TEXT = JSON.stringify({ scripture_validation: { note: `4th${BS}u{E0100}John 1:1` } });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status, '/invoke suffix-book seam under reserved key').toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok, '/stream suffix-book seam under reserved key').toBe(false);
  });

  // --- Round-44: one citation-scoped seam decoder — a NAMED-escape seam at the
  // book↔chapter position (previously a zero-ref bypass) is now caught, consistent
  // with the code-point escape and real seam — through the real transport. ---
  it('/invoke + /stream: named-escape (and code-point) seams at book↔chapter bind the fabricated book', async () => {
    const BS = String.fromCharCode(92);
    await runR25(app, [
      [`named Hezekiah${BS}n4:5 → invalid_book (finding #1 closed)`, `Hezekiah${BS}n4:5`, true],
      [`named Hezekiah${BS}t4:5 → invalid_book`, `Hezekiah${BS}t4:5`, true],
      [`code-point Hezekiah${BS}u000A4:5 → invalid_book`, `Hezekiah${BS}u000A4:5`, true],
      [`braced Hezekiah${BS}u{E0100}4:5 → invalid_book`, `Hezekiah${BS}u{E0100}4:5`, true],
      [`valid John${BS}n3:16 stays valid (consistent)`, `John${BS}n3:16`, false],
      ['valid John 3:16', 'John 3:16', false],
    ]);
  });

  it('/invoke + /stream catch a named-escape book↔chapter fabrication hidden under scripture_validation', async () => {
    const BS = String.fromCharCode(92);
    STREAM_TEXT = JSON.stringify({ scripture_validation: { note: `Hezekiah${BS}n4:5` } });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status, '/invoke named book-chapter seam under reserved key').toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok, '/stream named book-chapter seam under reserved key').toBe(false);
  });

  it('/invoke does NOT false-reject a non-citation-shaped escape (prose/code literal is prose-safe)', async () => {
    const BS = String.fromCharCode(92);
    // A Windows path and a JSON-ish value whose escapes are NOT between two word
    // chars forming a book↔number shape must pass (not screened as a citation).
    STREAM_TEXT = JSON.stringify({ path: `C:${BS}new${BS}temp`, width: `${BS}u002050px` });
    STREAM_THROW = false;
    const res = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(res.status, 'non-citation escapes must NOT 422').toBe(200);
  });

  // --- Round-45: seams adjacent to the ':' (chapter:verse) and '-' (range)
  // delimiters are now decoded inside the numeric citation span, so a named/
  // code-point escape there reaches the same verdict as a real seam (was a bypass
  // / silent truncation) — through the real transport. ---
  it('/invoke + /stream: seams next to ":" / "-" bind the fabricated/out-of-range/invalid-range ref', async () => {
    const BS = String.fromCharCode(92);
    await runR25(app, [
      [`Hezekiah 4${BS}n:5 → invalid_book`, `Hezekiah 4${BS}n:5`, true],
      [`Hezekiah 4:${BS}n5 → invalid_book`, `Hezekiah 4:${BS}n5`, true],
      [`John 999${BS}n:16 → out_of_range`, `John 999${BS}n:16`, true],
      [`John 3:1${BS}n-999 → out_of_range (range end preserved)`, `John 3:1${BS}n-999`, true],
      [`John 3:1-${BS}n999 → out_of_range`, `John 3:1-${BS}n999`, true],
      [`valid John 3${BS}n:16 stays valid`, `John 3${BS}n:16`, false],
    ]);
  });

  it('/invoke + /stream catch a delimiter-adjacent escaped-seam fabrication under scripture_validation', async () => {
    const BS = String.fromCharCode(92);
    STREAM_TEXT = JSON.stringify({ scripture_validation: { note: `Hezekiah 4${BS}n:5` } });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status, '/invoke delimiter seam under reserved key').toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok, '/stream delimiter seam under reserved key').toBe(false);
  });

  // --- Round-46: complete-by-construction seam coverage. An escaped seam after a
  // book ABBREVIATION dot (Gen.\n999:1) or in an ORDINAL separator (4th.\nJohn)
  // was a zero-ref bypass; both are now decoded like a real space — through the
  // real transport. A real sentence period + newline is NOT fabricated. ---
  it('/invoke + /stream: abbrev-dot and ordinal-separator escaped seams bind the ref (grammar-complete)', async () => {
    const BS = String.fromCharCode(92);
    await runR25(app, [
      [`Gen.${BS}n999:1 → out_of_range`, `Gen.${BS}n999:1`, true],
      [`Jn.${BS}n999:1 → out_of_range`, `Jn.${BS}n999:1`, true],
      [`Hez.${BS}n4:5 → invalid_book`, `Hez.${BS}n4:5`, true],
      [`4th.${BS}nJohn 1:1 → invalid_book`, `4th.${BS}nJohn 1:1`, true],
      [`valid Gen.${BS}n3:16 stays valid`, `Gen.${BS}n3:16`, false],
      ['valid John 3:16', 'John 3:16', false],
    ]);
  });

  it('/invoke does NOT false-reject a real sentence period + newline before a non-number word', async () => {
    const BS = String.fromCharCode(92);
    STREAM_TEXT = JSON.stringify({ note: `I read Gen.${BS}nThen we prayed.` });
    STREAM_THROW = false;
    const res = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(res.status, 'sentence period + newline must NOT 422').toBe(200);
  });

  it('/invoke + /stream catch an abbrev-dot escaped-seam fabrication under scripture_validation', async () => {
    const BS = String.fromCharCode(92);
    STREAM_TEXT = JSON.stringify({ scripture_validation: { note: `Hez.${BS}n4:5` } });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status, '/invoke abbrev-dot seam under reserved key').toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok, '/stream abbrev-dot seam under reserved key').toBe(false);
  });

  // --- Round-47: the seam decoder's TOKEN SURFACE now matches the grammar —
  // escaped seams around ROMAN chapter/verse/range delimiters are decoded (was a
  // bypass/truncation), and Unicode-Roman / fullwidth-digit prefixes are no longer
  // false-rejected — through the real transport. ---
  it('/invoke + /stream: escaped seams around ROMAN delimiters and Roman/fullwidth prefixes reach grammar parity', async () => {
    const BS = String.fromCharCode(92);
    await runR25(app, [
      [`Roman John XCIX${BS}n:I → out_of_range`, `John XCIX${BS}n:I`, true],
      [`Roman range John III:XVI${BS}n-CM → out_of_range (not truncated)`, `John III:XVI${BS}n-CM`, true],
      [`Unicode-Roman prefix IV John (ASCII) → invalid_book`, `IV${BS}nJohn 1:1`, true],
      [`fullwidth ordinal ２nd.${BS}nJohn 1:1 → valid 2 John`, `２nd.${BS}nJohn 1:1`, false],
      [`Unicode-Roman Ⅱ${BS}nJohn 1:1 → valid 2 John`, `Ⅱ${BS}nJohn 1:1`, false],
      ['valid John IV:2', 'John IV:2', false],
    ]);
  });

  it('/invoke + /stream catch a Roman-delimiter escaped-seam fabrication under scripture_validation', async () => {
    const BS = String.fromCharCode(92);
    STREAM_TEXT = JSON.stringify({ scripture_validation: { note: `John XCIX${BS}n:I` } });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status, '/invoke roman-delimiter seam under reserved key').toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok, '/stream roman-delimiter seam under reserved key').toBe(false);
  });

  // --- Round-48: the seam decoder's token surface is DERIVED from the fold tables —
  // FULLWIDTH LATIN ROMAN delimiters and FULLWIDTH / SUPERSCRIPT ordinal suffixes
  // now reach grammar parity (were a bypass / false-reject) — through the real
  // transport. ---
  it('/invoke + /stream: fullwidth-Latin-Roman delimiters and fullwidth/superscript ordinals reach parity', async () => {
    const BS = String.fromCharCode(92);
    await runR25(app, [
      [`fullwidth-Roman John ＸＣＩＸ${BS}n:Ｉ → out_of_range`, `John ＸＣＩＸ${BS}n:Ｉ`, true],
      [`fullwidth-Roman range John ＩＩＩ:ＸＶＩ${BS}n-ＣＭ → out_of_range (not truncated)`, `John ＩＩＩ:ＸＶＩ${BS}n-ＣＭ`, true],
      [`fullwidth ordinal ４ｔｈ.${BS}nJohn 1:1 → invalid_book`, `４ｔｈ.${BS}nJohn 1:1`, true],
      [`superscript ordinal ⁴ᵗʰ.${BS}nJohn 1:1 → invalid_book`, `⁴ᵗʰ.${BS}nJohn 1:1`, true],
      [`valid fullwidth ordinal ２ｎｄ.${BS}nJohn 1:1 → 2 John`, `２ｎｄ.${BS}nJohn 1:1`, false],
      ['valid John 3:16', 'John 3:16', false],
    ]);
  });

  it('/invoke + /stream catch a fullwidth-Roman-delimiter fabrication under scripture_validation', async () => {
    const BS = String.fromCharCode(92);
    STREAM_TEXT = JSON.stringify({ scripture_validation: { note: `John ＸＣＩＸ${BS}n:Ｉ` } });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status, '/invoke fullwidth-roman seam under reserved key').toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok, '/stream fullwidth-roman seam under reserved key').toBe(false);
  });

  // --- Round-49: the token surface is DERIVED from the ACTUAL normalization
  // (NFKC + explicit folds), so NFKC-only compatibility tokens — subscript digits,
  // mathematical letters, circled digits — reach grammar parity (were a bypass) —
  // through the real transport. ---
  it('/invoke + /stream: NFKC-only compatibility tokens (subscript, mathematical) reach parity', async () => {
    const BS = String.fromCharCode(92);
    const c = (x) => String.fromCodePoint(x);
    const sub = (d) => c(0x2080 + d);
    const mI = c(0x1D408), mV = c(0x1D415); // mathematical bold I, V
    await runR25(app, [
      [`subscript Hezekiah ${sub(4)}${BS}n:${sub(5)} → invalid_book`, `Hezekiah ${sub(4)}${BS}n:${sub(5)}`, true],
      [`mathematical Hezekiah 𝐈𝐕${BS}n:𝐕 → invalid_book`, `Hezekiah ${mI}${mV}${BS}n:${mV}`, true],
      [`subscript oor John ${sub(9)}${sub(9)}${sub(9)}${BS}n:1 → out_of_range`, `John ${sub(9)}${sub(9)}${sub(9)}${BS}n:1`, true],
      [`valid subscript John ${sub(3)}:${sub(1)}${sub(6)}`, `John ${sub(3)}:${sub(1)}${sub(6)}`, false],
      ['valid John 3:16', 'John 3:16', false],
    ]);
  });

  it('/invoke + /stream catch a subscript-token fabrication under scripture_validation', async () => {
    const BS = String.fromCharCode(92);
    const sub = (d) => String.fromCodePoint(0x2080 + d);
    STREAM_TEXT = JSON.stringify({ scripture_validation: { note: `Hezekiah ${sub(4)}${BS}n:${sub(5)}` } });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status, '/invoke subscript seam under reserved key').toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok, '/stream subscript seam under reserved key').toBe(false);
  });

  // --- Round-50: the token surface is now a FULL Unicode scan through the actual
  // normalization (no range allowlist), so the exact sources a range allowlist missed
  // — U+1D9C ᶜ→c, U+2C7D ⱽ→V, U+1F132 🄲→C — reach grammar parity through the
  // transport. ---
  it('/invoke + /stream: full-scan token sources (ᶜ, ⱽ, 🄲) reach grammar parity', async () => {
    const BS = String.fromCharCode(92);
    const c = (x) => String.fromCodePoint(x);
    await runR25(app, [
      [`ᶜ (U+1D9C) John ${c(0x1D9C)}${BS}n:I → John 100:1 out_of_range`, `John ${c(0x1D9C)}${BS}n:I`, true],
      [`🄲 (U+1F132) Hezekiah ${c(0x1F132)}${BS}n:I → invalid_book`, `Hezekiah ${c(0x1F132)}${BS}n:I`, true],
      [`ⱽ (U+2C7D) valid John ${c(0x2C7D)}${BS}n:I → John 5:1`, `John ${c(0x2C7D)}${BS}n:I`, false],
      ['valid John 3:16', 'John 3:16', false],
    ]);
  });

  it('/invoke + /stream catch a full-scan-source (ᶜ) fabrication under scripture_validation', async () => {
    const BS = String.fromCharCode(92);
    STREAM_TEXT = JSON.stringify({ scripture_validation: { note: `John ${String.fromCodePoint(0x1D9C)}${BS}n:I` } });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status, '/invoke ᶜ seam under reserved key').toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok, '/stream ᶜ seam under reserved key').toBe(false);
  });

  // --- Round-51: the ordinal-suffix scrub is now derived from the full-scan
  // normalization, so an NFKC-only ordinal suffix (circled ⓣⓗ) with a seam at the
  // digit↔suffix / suffix-internal position binds the fabricated numbered book —
  // through the real transport. ---
  it('/invoke + /stream: NFKC-only ordinal suffixes (circled ⓣⓗ) with a seam bind the fabricated book', async () => {
    const BS = String.fromCharCode(92);
    const c = (x) => String.fromCodePoint(x);
    const CT = c(0x24E3), CH = c(0x24D7), CN = c(0x24DD), CD = c(0x24D3), ZWSP = c(0x200B);
    await runR25(app, [
      [`4${ZWSP}ⓣⓗ John (real seam) → invalid_book`, `4${ZWSP}${CT}${CH} John 1:1`, true],
      [`4${BS}u200Bⓣⓗ John (escaped) → invalid_book`, `4${BS}u200B${CT}${CH} John 1:1`, true],
      [`4ⓣ${ZWSP}ⓗ John (suffix-internal) → invalid_book`, `4${CT}${ZWSP}${CH} John 1:1`, true],
      [`supported 2${ZWSP}ⓝⓓ John → 2 John (valid)`, `2${ZWSP}${CN}${CD} John 1:1`, false],
      ['valid John 3:16', 'John 3:16', false],
    ]);
  });

  it('/invoke + /stream catch a circled-ordinal fabrication under scripture_validation', async () => {
    const c = (x) => String.fromCodePoint(x);
    STREAM_TEXT = JSON.stringify({ scripture_validation: { note: `4${c(0x200B)}${c(0x24E3)}${c(0x24D7)} John 1:1` } });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status, '/invoke circled-ordinal seam under reserved key').toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok, '/stream circled-ordinal seam under reserved key').toBe(false);
  });

  // --- Round-52: a single glyph normalizing to a WHOLE two-letter suffix
  // (U+FB05/U+FB06 ﬅ/ﬆ → "st") with a seam binds the numbered book — through the
  // real transport. ---
  it('/invoke + /stream: a whole-suffix ligature (ﬆ → "st") with a seam binds the numbered book', async () => {
    const BS = String.fromCharCode(92);
    const c = (x) => String.fromCodePoint(x);
    const ST6 = c(0xFB06), ST5 = c(0xFB05), ZWSP = c(0x200B);
    await runR25(app, [
      [`1${ZWSP}ﬆ John 6:1 (real seam) → 1 John 6:1 out_of_range`, `1${ZWSP}${ST6} John 6:1`, true],
      [`1${BS}u200Bﬆ John 6:1 (escaped) → out_of_range`, `1${BS}u200B${ST6} John 6:1`, true],
      [`1ﬅ${ZWSP}John 6:1 (P9 suffix↔book) → out_of_range`, `1${ST5}${ZWSP}John 6:1`, true],
      [`supported 1ﬆ John 1:1 → 1 John (valid)`, `1${ST6} John 1:1`, false],
      ['valid John 3:16', 'John 3:16', false],
    ]);
  });

  it('/invoke + /stream catch a whole-suffix-ligature fabrication under scripture_validation', async () => {
    const c = (x) => String.fromCodePoint(x);
    STREAM_TEXT = JSON.stringify({ scripture_validation: { note: `1${c(0x200B)}${c(0xFB06)} John 6:1` } });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status, '/invoke ligature-ordinal seam under reserved key').toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok, '/stream ligature-ordinal seam under reserved key').toBe(false);
  });

  // --- Round-53: P10 digit↔superscript now uses the full-scan digit-source class,
  // so a NON-superscript compat digit (circled ①, subscript ₁) immediately before a
  // superscript fails closed (ambiguous), not silently the extended reading — through
  // the real transport. The all-superscript empty slot (¹⁶) stays valid data. ---
  it('/invoke + /stream: a compat digit before a superscript fails closed (not silently valid)', async () => {
    const BS = String.fromCharCode(92);
    const c = (x) => String.fromCodePoint(x);
    const C1 = c(0x2460), SUB1 = c(0x2081), S6 = c(0x2076), ZWSP = c(0x200B), S1 = c(0xB9);
    await runR25(app, [
      [`circled John 3:①⁶ → fail closed`, `John 3:${C1}${S6}`, true],
      [`circled seamed John 3:①${BS}u200B⁶ → fail closed`, `John 3:${C1}${BS}u200B${S6}`, true],
      [`circled real-seam John 3:①<ZWSP>⁶ → fail closed`, `John 3:${C1}${ZWSP}${S6}`, true],
      [`subscript John 3:₁⁶ → fail closed`, `John 3:${SUB1}${S6}`, true],
      [`empty-slot John 3:¹⁶ → valid (data)`, `John 3:${S1}${S6}`, false],
      ['valid John 3:16', 'John 3:16', false],
    ]);
  });

  it('/invoke + /stream catch a compat-digit-superscript fabrication under scripture_validation', async () => {
    const c = (x) => String.fromCodePoint(x);
    STREAM_TEXT = JSON.stringify({ scripture_validation: { note: `John 3:${c(0x2460)}${c(0x2076)}` } });
    STREAM_THROW = false;
    const inv = await request(app)
      .post('/api/ai/invoke')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' } });
    expect(inv.status, '/invoke circled-superscript under reserved key').toBe(422);
    expect(inv.body.scripture_unverified).toBe(true);

    const str = await request(app)
      .post('/api/ai/stream')
      .set('Cookie', [`ss_token=${tokenFor('u-s')}`])
      .send({ prompt: 'p', response_json_schema: { type: 'object' }, stream_result: true });
    expect(parseTrailer(str).scripture.ok, '/stream circled-superscript under reserved key').toBe(false);
  });
});
