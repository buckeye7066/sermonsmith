import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { publishMobileBundle } from './build-mobile-bundle.mjs';
test('feed uses the exact version embedded by Vite in the installed bundle', () => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sermonsmith-identity-'));
  try {
    fs.writeFileSync(path.join(distDir, 'index.html'), '<title>app</title>');
    fs.writeFileSync(path.join(distDir, 'build-info.json'), JSON.stringify({ version: '1.0.1.1789000123456' }));
    assert.equal(publishMobileBundle({ distDir }).manifest.version, '1.0.1.1789000123456');
  } finally { fs.rmSync(distDir, { recursive: true, force: true }); }
});
