import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('every bundled first-run path uses the declared local API port', () => {
  const firstRun = read('apps/desktop/electron/first-run.html');
  const apiEnv = read('services/api/src/config/env.js');
  const apiClient = read('apps/web/src/api/apiClient.js');

  assert.match(firstRun, /value="http:\/\/localhost:3101"/);
  assert.doesNotMatch(firstRun, /value="http:\/\/localhost:3001"/);
  assert.match(apiEnv, /PORT:[\s\S]*?\.default\(3101\)/);
  assert.match(apiClient, /resolved = 'http:\/\/localhost:3101'/);
});
