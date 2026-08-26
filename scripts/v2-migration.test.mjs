import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packagePaths = [
  'package.json',
  'apps/desktop/package.json',
  'apps/mobile/package.json',
  'apps/web/package.json',
  'packages/shared/package.json',
  'services/api/package.json',
];

test('the coordinated client and API packages share the 2.0 major version', async () => {
  for (const path of packagePaths) {
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(manifest.version, '2.0.0', `${path} must be 2.0.0`);
  }

  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  for (const path of ['', 'apps/desktop', 'apps/mobile', 'apps/web', 'packages/shared', 'services/api']) {
    assert.equal(lock.packages[path].version, '2.0.0', `package-lock entry ${path || '<root>'} must be 2.0.0`);
  }
});

test('native shells and the migration guide declare the same major boundary', async () => {
  const android = await readFile('apps/mobile/android/app/build.gradle', 'utf8');
  const ios = await readFile('apps/mobile/ios/App/App.xcodeproj/project.pbxproj', 'utf8');
  const migration = await readFile('docs/V2-MIGRATION.md', 'utf8');

  assert.match(android, /resolvedVersionCode = .*"3"/u);
  assert.match(android, /resolvedVersionName = .*"2\.0\.0"/u);
  assert.equal((ios.match(/CURRENT_PROJECT_VERSION = 2;/gu) || []).length, 2);
  assert.equal((ios.match(/MARKETING_VERSION = 2\.0\.0;/gu) || []).length, 2);
  assert.match(migration, /^# SermonSmith 2\.0 installed-client migration$/mu);
  assert.match(migration, /^## Coordinated deployment order$/mu);
  assert.match(migration, /^## Rollback$/mu);
});
