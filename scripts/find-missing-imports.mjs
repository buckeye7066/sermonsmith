#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'apps/web/src');
const exts = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json'];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, files);
    } else if (/\.(jsx?|tsx?|mjs|cjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function tryResolve(spec, fromFile) {
  let basePath;
  if (spec.startsWith('@/')) {
    basePath = path.join(ROOT, spec.slice(2));
  } else if (spec.startsWith('./') || spec.startsWith('../')) {
    basePath = path.resolve(path.dirname(fromFile), spec);
  } else {
    return true;
  }
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) return true;
  for (const ext of exts) {
    if (fs.existsSync(basePath + ext) && fs.statSync(basePath + ext).isFile()) return true;
  }
  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    for (const ext of exts) {
      if (fs.existsSync(path.join(basePath, 'index' + ext))) return true;
    }
  }
  return false;
}

const files = walk(ROOT);
const importRegex = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"]+?\s+from\s+)?['"]([^'"\n]+)['"]/g;
const dynamicImportRegex = /import\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;
const requireRegex = /require\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;

const missing = new Map();
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  for (const re of [importRegex, dynamicImportRegex, requireRegex]) {
    let m;
    while ((m = re.exec(code))) {
      const spec = m[1];
      if (!spec.startsWith('@/') && !spec.startsWith('./') && !spec.startsWith('../')) continue;
      if (!tryResolve(spec, file)) {
        let resolved;
        if (spec.startsWith('@/')) {
          resolved = path.join(ROOT, spec.slice(2));
        } else {
          resolved = path.resolve(path.dirname(file), spec);
        }
        const list = missing.get(resolved) || [];
        list.push(file);
        missing.set(resolved, list);
      }
    }
  }
}

for (const [k, v] of missing) {
  console.log(`MISSING: ${path.relative(process.cwd(), k)}`);
  for (const f of v.slice(0, 3)) {
    console.log(`  used in: ${path.relative(process.cwd(), f)}`);
  }
}
console.log(`Total missing: ${missing.size}`);
