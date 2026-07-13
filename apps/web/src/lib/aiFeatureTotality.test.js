/**
 * AI feature-id totality test.
 *
 * Every `InvokeLLM(` / `StreamLLM(` call site in apps/web/src must pass a
 * `feature: '<id>'` property in its first-argument object literal, and that
 * id must be registered in the canonical @sermonsmith/shared/aiFeatures
 * registry. This guarantees no production AI call ships unlabelled (audit
 * rows stay consistent, and per-feature server contracts can attach later).
 *
 * Implementation is a pragmatic source scan: for each call token we inspect
 * the following window of source text for a `feature: '...'` property. That
 * window comfortably covers the argument object even for the largest inline
 * schemas in this codebase.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_FEATURES } from '@sermonsmith/shared/aiFeatures';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function collectSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, out);
      continue;
    }
    if (!/\.(js|jsx)$/.test(entry.name)) continue;
    if (/\.(test|spec)\./.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

// Window of source scanned after each call token for the feature property.
// Large enough to span the biggest inline response_json_schema objects.
const SCAN_WINDOW = 4000;

function findCallSites(source) {
  const sites = [];
  const re = /\b(InvokeLLM|StreamLLM)\s*\(/g;
  const callIndices = [];
  let match;
  while ((match = re.exec(source)) !== null) {
    callIndices.push({ index: match.index, fn: match[1] });
  }
  for (let i = 0; i < callIndices.length; i++) {
    const { index: start, fn } = callIndices[i];
    // Never scan past the NEXT call token — a featureless call must not
    // borrow the feature id of the call that follows it.
    const hardEnd = i + 1 < callIndices.length ? callIndices[i + 1].index : source.length;
    const window = source.slice(start, Math.min(start + SCAN_WINDOW, hardEnd));
    const featureMatch = window.match(/\bfeature:\s*['"]([a-z_]+)['"]/);
    const line = source.slice(0, start).split('\n').length;
    sites.push({
      fn,
      line,
      feature: featureMatch ? featureMatch[1] : null,
    });
  }
  return sites;
}

describe('AI feature id totality', () => {
  const files = collectSourceFiles(SRC_ROOT);
  const allSites = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    if (!/InvokeLLM\s*\(|StreamLLM\s*\(/.test(source)) continue;
    const rel = path.relative(SRC_ROOT, file).replace(/\\/g, '/');
    // apiClient.js defines the InvokeLLM/StreamLLM wrappers themselves; its
    // internal references are not call sites that supply a request payload.
    if (rel === 'api/apiClient.js') continue;
    for (const site of findCallSites(source)) {
      allSites.push({ ...site, file: rel });
    }
  }

  it('finds AI call sites to check (sanity)', () => {
    expect(allSites.length).toBeGreaterThan(30);
  });

  it('every InvokeLLM/StreamLLM call carries a feature id', () => {
    const missing = allSites.filter((s) => !s.feature);
    expect(
      missing.map((s) => `${s.file}:${s.line} ${s.fn}( … ) has no feature: '<id>'`),
    ).toEqual([]);
  });

  it('every feature id is registered in AI_FEATURES', () => {
    const unregistered = allSites.filter(
      (s) => s.feature && !Object.prototype.hasOwnProperty.call(AI_FEATURES, s.feature),
    );
    expect(
      unregistered.map((s) => `${s.file}:${s.line} uses unregistered feature '${s.feature}'`),
    ).toEqual([]);
  });
});
