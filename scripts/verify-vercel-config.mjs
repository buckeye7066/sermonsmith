import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const API_REWRITE = {
  source: '/api/:path*',
  destination: 'https://sermonsmith-api-production.up.railway.app/api/:path*',
};
const SPA_REWRITE = { source: '/(.*)', destination: '/app.html' };
const PUBLIC_DOCUMENT_REWRITES = new Map([
  ['/', '/index.html'],
  ['/Home', '/index.html'],
  ['/home', '/index.html'],
  ['/Pricing', '/pricing.html'],
  ['/pricing', '/pricing.html'],
  ['/Downloads', '/downloads.html'],
  ['/downloads', '/downloads.html'],
  ['/privacy', '/privacy.html'],
  ['/Privacy', '/privacy.html'],
]);

const REQUIRED_SECURITY_HEADERS = new Map([
  [
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://sermonsmith-api-production.up.railway.app; media-src 'self' data: blob: https:; worker-src 'self' blob:; manifest-src 'self'; frame-src 'none'; upgrade-insecure-requests",
  ],
  ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  [
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self), usb=(), browsing-topics=()',
  ],
  ['Cross-Origin-Opener-Policy', 'same-origin-allow-popups'],
  ['Cross-Origin-Resource-Policy', 'same-origin'],
]);

function loadJson(relativePath) {
  const absolutePath = resolve(ROOT, relativePath);
  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not parse ${relativePath}: ${error.message}`);
  }
}

function route(config, source, label) {
  const match = config.headers?.find((entry) => entry.source === source);
  assert.ok(match, `${label}: missing headers rule for ${source}`);
  assert.ok(Array.isArray(match.headers), `${label}: ${source} headers must be an array`);
  return new Map(match.headers.map(({ key, value }) => [key, value]));
}

function assertHeader(map, key, expected, label) {
  assert.equal(map.get(key), expected, `${label}: ${key} is missing or has drifted`);
}

function verifyConfig(config, label, { root = false } = {}) {
  assert.ok(Array.isArray(config.rewrites), `${label}: rewrites must be an array`);
  assert.deepEqual(
    config.rewrites[0],
    API_REWRITE,
    `${label}: /api must remain the first rewrite so the SPA fallback cannot swallow API calls`,
  );
  assert.deepEqual(
    config.rewrites.at(-1),
    SPA_REWRITE,
    `${label}: protected and login routes must use the noindex SPA shell`,
  );
  assert.equal(config.trailingSlash, false, `${label}: canonical routes must not fork on trailing slashes`);

  const rewrites = new Map(config.rewrites.map((entry) => [entry.source, entry.destination]));
  for (const [source, destination] of PUBLIC_DOCUMENT_REWRITES) {
    assert.equal(
      rewrites.get(source),
      destination,
      `${label}: ${source} must use its route-specific crawlable document`,
    );
  }

  const securityHeaders = route(config, '/(.*)', label);
  assert.equal(
    securityHeaders.size,
    REQUIRED_SECURITY_HEADERS.size,
    `${label}: unexpected global security-header count`,
  );
  for (const [key, value] of REQUIRED_SECURITY_HEADERS) {
    assertHeader(securityHeaders, key, value, label);
  }

  const csp = securityHeaders.get('Content-Security-Policy');
  for (const directive of [
    "default-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "connect-src 'self' https://sermonsmith-api-production.up.railway.app",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ]) {
    assert.ok(csp.includes(directive), `${label}: CSP lost required directive: ${directive}`);
  }

  // The app currently uses next-themes' inline bootstrap and Sonner's injected
  // styles. These two allowances are intentional compatibility exceptions. This
  // gate makes them visible rather than letting a broad policy change unnoticed.
  assert.ok(
    csp.includes("script-src 'self' 'unsafe-inline'"),
    `${label}: CSP must account for the current inline theme bootstrap`,
  );
  assert.ok(
    csp.includes("style-src 'self' 'unsafe-inline'"),
    `${label}: CSP must account for current runtime style injection`,
  );

  const assets = route(config, '/assets/(.*)', label);
  assertHeader(assets, 'Cache-Control', 'public, max-age=31536000, immutable', label);

  const serviceWorker = route(config, '/sw.js', label);
  assertHeader(serviceWorker, 'Cache-Control', 'public, max-age=0, must-revalidate', label);
  assertHeader(serviceWorker, 'Service-Worker-Allowed', '/', label);

  for (const source of [
    '/index.html',
    '/app.html',
    '/pricing.html',
    '/downloads.html',
    '/privacy.html',
    '/manifest.webmanifest',
  ]) {
    const headers = route(config, source, label);
    assertHeader(headers, 'Cache-Control', 'public, max-age=0, must-revalidate', label);
  }

  if (root) {
    assert.equal(config.framework, 'vite', `${label}: framework must remain vite`);
    assert.equal(config.installCommand, 'npm ci', `${label}: install must remain reproducible`);
    assert.equal(config.buildCommand, 'npm run build:web', `${label}: wrong monorepo build command`);
    assert.equal(config.outputDirectory, 'apps/web/dist', `${label}: wrong web output directory`);
  }
}

const rootConfig = loadJson('vercel.json');
const webConfig = loadJson('apps/web/vercel.json');

verifyConfig(rootConfig, 'vercel.json', { root: true });
verifyConfig(webConfig, 'apps/web/vercel.json');

assert.deepEqual(
  webConfig.rewrites,
  rootConfig.rewrites,
  'Root and apps/web Vercel rewrite policies have drifted',
);
assert.deepEqual(
  webConfig.headers,
  rootConfig.headers,
  'Root and apps/web Vercel response-header policies have drifted',
);

console.log('Vercel configuration verified: public metadata routing, protected noindex shell, security headers, and cache policy are aligned.');
