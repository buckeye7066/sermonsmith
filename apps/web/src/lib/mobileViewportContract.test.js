import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../Layout.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('mobile viewport contract', () => {
  it('keeps Safari zoom available and opts into safe-area layout', () => {
    expect(html).toContain('viewport-fit=cover');
    expect(`${html}\n${layout}`).not.toMatch(/maximum-scale|user-scalable\s*=\s*no/i);
    expect(css).toContain('env(safe-area-inset-bottom, 0px)');
    expect(css).toContain('height: 100dvh');
  });
});
