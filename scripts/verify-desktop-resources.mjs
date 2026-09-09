import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const resources = path.resolve(process.argv[2] || 'dist-electron/win-unpacked/resources');
const web = path.join(resources, 'web');
const html = fs.readFileSync(path.join(web, 'app.html'), 'utf8');
const identity = JSON.parse(fs.readFileSync(path.join(web, 'build-info.json'), 'utf8'));
assert.match(identity.version, /^\d+(\.\d+){3}$/);
assert.ok(identity.assets?.length > 0, 'build asset inventory is missing');
for (const asset of identity.assets) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(web, asset.path))).digest('hex'), asset.sha256, asset.path);
}
assert.ok(fs.existsSync(path.join(resources, 'icons', 'icon.png')), 'packaged icon is missing');
const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)"/g)].map((match) => match[1]);
assert.ok(assets.some((asset) => asset.endsWith('.js')), 'desktop entry has no relative JavaScript entrypoint');
for (const asset of assets) assert.ok(fs.existsSync(path.join(web, asset)), `missing packaged asset: ${asset}`);
console.log(`Verified packaged desktop entry, ${assets.length} assets and build ${identity.version}`);
