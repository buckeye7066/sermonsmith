import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const serviceWorker = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');

describe('service worker lifecycle contract', () => {
  it('does not take over a live Safari page midway through its request lifecycle', () => {
    expect(serviceWorker).toContain("self.addEventListener('activate'");
    expect(serviceWorker).not.toContain('clients.claim(');
  });
});
