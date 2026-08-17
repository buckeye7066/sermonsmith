import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  GhCommandError,
  publishAndroidRelease,
  runGh,
  verifySigningBaseline,
} from './android-release.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const CERT = 'a'.repeat(64);

test('GitHub CLI retries transient failures at bounded exponential delays', async () => {
  const results = [
    { status: 1, stderr: 'HTTP 503 Service Unavailable' },
    { status: 1, stderr: 'HTTP 429 too many requests' },
    { status: 0, stdout: 'ok' },
  ];
  const delays = [];
  const result = await runGh(['release', 'list'], {
    executor: () => results.shift(),
    sleep: async (ms) => delays.push(ms),
    log: () => {},
  });

  assert.equal(result.stdout, 'ok');
  assert.deepEqual(delays, [2_000, 4_000]);
});

test('GitHub CLI stops after five transient attempts', async () => {
  let attempts = 0;
  const delays = [];
  await assert.rejects(
    runGh(['release', 'upload'], {
      executor: () => {
        attempts += 1;
        return { status: 1, stderr: 'HTTP 503 Service Unavailable' };
      },
      sleep: async (ms) => delays.push(ms),
      log: () => {},
    }),
    (error) => error instanceof GhCommandError && error.kind === 'transient',
  );
  assert.equal(attempts, 5);
  assert.deepEqual(delays, [2_000, 4_000, 8_000, 16_000]);
});

test('not-found is opt-in and authentication failures are never retried', async () => {
  let calls = 0;
  const notFound = await runGh(['release', 'view', 'missing'], {
    executor: () => {
      calls += 1;
      return { status: 1, stderr: 'HTTP 404 release not found' };
    },
    allowNotFound: true,
    sleep: async () => assert.fail('404 must not sleep'),
  });
  assert.equal(notFound.found, false);
  assert.equal(calls, 1);

  await assert.rejects(
    runGh(['release', 'list'], {
      executor: () => ({ status: 1, stderr: 'HTTP 401 Bad credentials' }),
      sleep: async () => assert.fail('auth failure must not retry'),
    }),
    (error) => error instanceof GhCommandError && error.kind === 'auth',
  );
});

test('publication reconciles an ambiguous create, clobbers assets, and verifies exact target', async () => {
  const calls = [];
  const delays = [];
  let exists = false;
  let draft = true;
  let uploadAttempts = 0;
  let assets = [];

  const executor = (args) => {
    calls.push(args);
    const operation = `${args[0]} ${args[1]}`;
    if (operation === 'release view') {
      if (!exists) return { status: 1, stderr: 'HTTP 404 release not found' };
      return { status: 0, stdout: JSON.stringify({ targetCommitish: SHA, isDraft: draft, assets }) };
    }
    if (operation === 'release create') {
      exists = true;
      return { status: 1, stderr: 'HTTP 503 Service Unavailable' };
    }
    if (operation === 'release upload') {
      uploadAttempts += 1;
      if (uploadAttempts === 1) return { status: 1, stderr: 'HTTP 502 Bad Gateway' };
      assets = ['app.apk', 'app.aab', 'checksums.sha256'].map((name) => ({ name }));
      return { status: 0 };
    }
    if (operation === 'release edit') {
      draft = false;
      return { status: 0 };
    }
    throw new Error(`Unexpected fake gh call: ${args.join(' ')}`);
  };

  await publishAndroidRelease({
    repo: 'owner/repo',
    tag: 'android-v1.2.3',
    target: SHA,
    title: 'Android 1.2.3',
    notes: 'notes',
    assets: ['app.apk', 'app.aab', 'checksums.sha256'],
    executor,
    sleep: async (ms) => delays.push(ms),
    log: () => {},
  });

  assert.equal(calls.filter((args) => args[1] === 'create').length, 1);
  assert.equal(calls.filter((args) => args[1] === 'upload').length, 2);
  assert.ok(calls.find((args) => args[1] === 'upload').includes('--clobber'));
  assert.ok(calls.find((args) => args[1] === 'create').includes(SHA));
  assert.deepEqual(delays, [2_000]);
});

test('publication refuses to overwrite a release for a different commit', async () => {
  const calls = [];
  await assert.rejects(
    publishAndroidRelease({
      repo: 'owner/repo',
      tag: 'android-v1.2.3',
      target: SHA,
      title: 'Android 1.2.3',
      notes: 'notes',
      assets: ['app.apk'],
      executor: (args) => {
        calls.push(args);
        return {
          status: 0,
          stdout: JSON.stringify({ targetCommitish: 'f'.repeat(40), isDraft: false, assets: [] }),
        };
      },
      sleep: async () => {},
      log: () => {},
    }),
    /expected exact commit/,
  );
  assert.equal(calls.filter((args) => args[1] === 'upload').length, 0);
});

test('signing baseline retries list failures and compares the downloaded certificate', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'sermonsmith-release-test-'));
  const fingerprintPath = path.join(temp, 'configured.sha256');
  const downloadDir = path.join(temp, 'download');
  await writeFile(fingerprintPath, `${CERT}\n`);
  let listAttempts = 0;
  const delays = [];

  try {
    const result = await verifySigningBaseline({
      repo: 'owner/repo',
      fingerprintPath,
      downloadDir,
      executor: async (args) => {
        if (args[1] === 'list') {
          listAttempts += 1;
          if (listAttempts === 1) return { status: 1, stderr: 'HTTP 503 Service Unavailable' };
          return { status: 0, stdout: JSON.stringify([{ tagName: 'android-v1.0.42', isDraft: false }]) };
        }
        if (args[1] === 'download') {
          await writeFile(path.join(downloadDir, 'sermonsmith-signing-cert.sha256'), `${CERT}\n`);
          return { status: 0 };
        }
        throw new Error(`Unexpected fake gh call: ${args.join(' ')}`);
      },
      sleep: async (ms) => delays.push(ms),
      log: () => {},
    });

    assert.deepEqual(result, { bootstrap: false, tag: 'android-v1.0.42' });
    assert.deepEqual(delays, [2_000]);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
