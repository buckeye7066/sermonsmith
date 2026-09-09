import { createHash, webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { fetchBrowserBuild, parseBrowserBuild, verifyBrowserBuildReady } from './browserUpdater';

const html = '<html>complete build</html>';
const script = 'console.log("complete build")';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const manifest = { version: '1.0.1.100', assets: [
  { path: 'app.html', sha256: hash(html) },
  { path: 'assets/main.js', sha256: hash(script) },
] };
function feed(overrides = {}) {
  return vi.fn(async (url) => {
    const pathname = new URL(url).pathname;
    const body = overrides[pathname] ?? ({ '/build-info.json': JSON.stringify(manifest), '/app.html': html, '/assets/main.js': script }[pathname]);
    return new Response(body, { status: body === null ? 404 : 200 });
  });
}
const options = (fetchImpl) => ({ fetchImpl, baseUrl: 'https://example.com', cryptoImpl: webcrypto });
describe('browser deployment readiness', () => {
  it('checks the deployed bytes for HTML and every declared asset before rechecking the current build', async () => {
    const fetchImpl = feed();
    await verifyBrowserBuildReady(manifest, options(fetchImpl));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls.every(([, init]) => init.cache === 'no-store')).toBe(true);
  });
  it('rejects an HTML fallback masquerading as a successfully served chunk', async () => {
    await expect(verifyBrowserBuildReady(manifest, options(feed({ '/assets/main.js': html })))).rejects.toThrow('not fully available');
  });
  it('rejects a promotion that changes while chunks are being checked', async () => {
    const changed = JSON.stringify({ ...manifest, version: '1.0.1.99' });
    await expect(verifyBrowserBuildReady(manifest, options(feed({ '/build-info.json': changed })))).rejects.toThrow('deployment changed');
  });
  it('reads the authoritative older version without imposing an upgrade-only comparison', async () => {
    const fetchImpl = feed({ '/build-info.json': JSON.stringify({ ...manifest, version: '1.0.1.99' }) });
    expect((await fetchBrowserBuild(options(fetchImpl))).version).toBe('1.0.1.99');
    expect(fetchImpl.mock.calls[0][0]).toContain('_update=');
  });
  it('uses the shared public transport without sending application credentials', async () => {
    const request = feed();
    vi.stubGlobal('fetch', request);
    try {
      expect((await fetchBrowserBuild({ baseUrl: 'https://example.com' })).version).toBe(manifest.version);
      expect(request.mock.calls[0][1]).toMatchObject({ credentials: 'omit', cache: 'no-store' });
      expect(request.mock.calls[0][0]).toMatch(/^https:\/\/example\.com\/build-info\.json\?/);
    } finally { vi.unstubAllGlobals(); }
  });
  it('refuses incomplete and external/traversing asset inventories', () => {
    expect(() => parseBrowserBuild({ version: '1.0.1.100', assets: [] })).toThrow();
    for (const path of ['https://example.net/main.js', 'assets/../main.js']) {
      expect(() => parseBrowserBuild({ ...manifest, assets: [...manifest.assets, { path, sha256: hash(script) }] })).toThrow();
    }
  });
});
