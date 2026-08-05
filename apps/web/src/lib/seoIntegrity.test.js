import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB = path.dirname(SRC);
const REPO = path.resolve(WEB, '..', '..');
const readWeb = (relativePath) => readFileSync(path.join(WEB, relativePath), 'utf8');

const PUBLIC_DOCUMENTS = {
  '/': { file: 'index.html', canonical: 'https://sermonsmith.axiombiolabs.org/' },
  '/Pricing': { file: 'pricing.html', canonical: 'https://sermonsmith.axiombiolabs.org/Pricing' },
  '/Downloads': { file: 'downloads.html', canonical: 'https://sermonsmith.axiombiolabs.org/Downloads' },
  '/privacy': { file: 'privacy.html', canonical: 'https://sermonsmith.axiombiolabs.org/privacy' },
};

describe('crawlable route documents', () => {
  it('gives each sitemap URL its own canonical indexable document', () => {
    const sitemap = readWeb('public/sitemap.xml');

    for (const { file, canonical } of Object.values(PUBLIC_DOCUMENTS)) {
      const html = readWeb(file);
      expect(html).toContain(`rel="canonical" href="${canonical}"`);
      expect(html).toContain(`property="og:url" content="${canonical}"`);
      expect(html).toContain('name="robots" content="index,follow,max-image-preview:large"');
      expect(sitemap).toContain(`<loc>${canonical}</loc>`);
    }
  });

  it('serves protected and login routes through a noindex shell', () => {
    const app = readWeb('app.html');
    expect(app).toContain('name="robots" content="noindex,nofollow,noarchive"');
    expect(app).not.toContain('rel="canonical"');

    for (const configPath of [
      path.join(REPO, 'vercel.json'),
      path.join(WEB, 'vercel.json'),
    ]) {
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      const rewrites = new Map(config.rewrites.map((entry) => [entry.source, entry.destination]));

      expect(rewrites.get('/')).toBe('/index.html');
      expect(rewrites.get('/Pricing')).toBe('/pricing.html');
      expect(rewrites.get('/Downloads')).toBe('/downloads.html');
      expect(rewrites.get('/privacy')).toBe('/privacy.html');
      expect(rewrites.get('/(.*)')).toBe('/app.html');
    }
  });

  it('uses a public-route allowlist instead of an incomplete protected-route denylist', () => {
    const robots = readWeb('public/robots.txt');

    expect(robots).toMatch(/^Allow: \/\$$/m);
    expect(robots).toMatch(/^Allow: \/Pricing\$$/m);
    expect(robots).toMatch(/^Allow: \/Downloads\$$/m);
    expect(robots).toMatch(/^Allow: \/privacy\$$/m);
    expect(robots).toMatch(/^Disallow: \/$/m);
    expect(robots).not.toMatch(/^Allow: \/$/m);
  });
});
