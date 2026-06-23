#!/usr/bin/env node
/**
 * API "typecheck": syntax-check EVERY source file, not just the entry point.
 *
 * The API is plain ESM JavaScript (no TS), so there is no type layer to check,
 * but `node --check src/index.js` only parsed one file — a syntax/parse error
 * in any other route/service/middleware sailed through CI. This walks src/ and
 * runs `node --check` on each .js file, failing if any does not parse.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = walk(SRC);
let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed++;
    process.stderr.write(`✗ ${file}\n${err.stderr?.toString() || err.message}\n`);
  }
}

if (failed) {
  console.error(`\nTypecheck failed: ${failed}/${files.length} file(s) did not parse.`);
  process.exit(1);
}
console.log(`Typecheck OK: ${files.length} files parsed.`);
