import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  selectExactDeployment,
  waitForExactDeployment,
} from './monitor-railway-deployment.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

test('imports from a clean checkout without a workspace install', async (context) => {
  const cleanRoot = await mkdtemp(join(tmpdir(), 'sermonsmith-railway-monitor-'));
  context.after(() => rm(cleanRoot, { recursive: true, force: true }));

  await Promise.all([
    mkdir(join(cleanRoot, 'scripts'), { recursive: true }),
    mkdir(join(cleanRoot, 'packages/shared/api'), { recursive: true }),
  ]);
  await Promise.all([
    copyFile(join(REPO_ROOT, 'package.json'), join(cleanRoot, 'package.json')),
    copyFile(
      join(REPO_ROOT, 'scripts/monitor-railway-deployment.mjs'),
      join(cleanRoot, 'scripts/monitor-railway-deployment.mjs'),
    ),
    copyFile(
      join(REPO_ROOT, 'packages/shared/api/index.js'),
      join(cleanRoot, 'packages/shared/api/index.js'),
    ),
  ]);

  assert.equal(existsSync(join(cleanRoot, 'node_modules')), false);
  const monitorUrl = pathToFileURL(join(cleanRoot, 'scripts/monitor-railway-deployment.mjs')).href;
  const imported = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', `await import(${JSON.stringify(monitorUrl)})`],
    { cwd: cleanRoot, encoding: 'utf8', env: { ...process.env, NODE_PATH: '' } },
  );

  assert.equal(imported.status, 0, `${imported.stderr}\n${imported.stdout}`);
});

test('selects the latest deployment for the exact commit and ignores newer unrelated pushes', () => {
  const selected = selectExactDeployment([
    { id: 'exact-old', status: 'FAILED', createdAt: '2026-08-17T10:00:00Z', meta: { commitHash: SHA } },
    { id: 'unrelated-new', status: 'SUCCESS', createdAt: '2026-08-17T12:00:00Z', meta: { commitHash: 'f'.repeat(40) } },
    { id: 'exact-new', status: 'SUCCESS', createdAt: '2026-08-17T11:00:00Z', meta: { commitHash: SHA } },
  ], SHA);

  assert.equal(selected.id, 'exact-new');
});

test('waits through live identity lag and accepts only the expected release SHA', async () => {
  const delays = [];
  let liveCalls = 0;
  const result = await waitForExactDeployment({
    service: 'sermonsmith-api',
    expectedSha: SHA,
    apiBaseUrl: 'https://example.test',
    executor: () => ({
      status: 0,
      stdout: JSON.stringify([{ id: 'deploy-1', status: 'SUCCESS', meta: { commitHash: SHA } }]),
    }),
    apiClient: {
      getReadiness: async () => {
        liveCalls += 1;
        return { status: 'ready', releaseSha: liveCalls === 1 ? 'f'.repeat(40) : SHA };
      },
    },
    sleep: async (ms) => delays.push(ms),
    log: () => {},
    errorLog: () => {},
  });

  assert.equal(result.deployment.id, 'deploy-1');
  assert.equal(result.readiness.releaseSha, SHA);
  assert.deepEqual(delays, [5_000]);
});

test('retries a transient list failure before matching the exact commit', async () => {
  let lists = 0;
  const delays = [];
  await waitForExactDeployment({
    service: 'sermonsmith-api',
    expectedSha: SHA,
    apiBaseUrl: 'https://example.test',
    executor: () => {
      lists += 1;
      if (lists === 1) return { status: 1, stderr: 'temporary network failure' };
      return {
        status: 0,
        stdout: JSON.stringify([{ id: 'deploy-2', status: 'SUCCESS', meta: { commitHash: SHA } }]),
      };
    },
    apiClient: { getReadiness: async () => ({ status: 'ready', releaseSha: SHA }) },
    sleep: async (ms) => delays.push(ms),
    log: () => {},
    errorLog: () => {},
  });

  assert.equal(lists, 2);
  assert.deepEqual(delays, [15_000]);
});

test('surfaces exact failed-deployment build and deploy logs', async () => {
  const calls = [];
  const errors = [];
  await assert.rejects(
    waitForExactDeployment({
      service: 'sermonsmith-api',
      expectedSha: SHA,
      apiBaseUrl: 'https://example.test',
      executor: (args) => {
        calls.push(args);
        if (args[0] === 'deployment') {
          return {
            status: 0,
            stdout: JSON.stringify([{ id: 'deploy-failed', status: 'FAILED', meta: { commitHash: SHA } }]),
          };
        }
        return { status: 0, stdout: args.includes('--build') ? 'build failed' : 'deploy crashed' };
      },
      apiClient: { getReadiness: async () => assert.fail('failed deployment must not probe live readiness') },
      sleep: async () => {},
      log: () => {},
      errorLog: (message) => errors.push(message),
    }),
    /Exact Railway deployment failed/,
  );

  assert.equal(calls.filter((args) => args[0] === 'logs').length, 2);
  assert.ok(errors.some((message) => message.includes('build failed')));
  assert.ok(errors.some((message) => message.includes('deploy crashed')));
});

test('times out when only unrelated commit deployments exist', async () => {
  const delays = [];
  await assert.rejects(
    waitForExactDeployment({
      service: 'sermonsmith-api',
      expectedSha: SHA,
      apiBaseUrl: 'https://example.test',
      executor: () => ({
        status: 0,
        stdout: JSON.stringify([{ id: 'other', status: 'SUCCESS', meta: { commitHash: 'f'.repeat(40) } }]),
      }),
      apiClient: { getReadiness: async () => assert.fail('unrelated deployment must not probe readiness') },
      sleep: async (ms) => delays.push(ms),
      log: () => {},
      errorLog: () => {},
      deploymentAttempts: 2,
    }),
    /No successful Railway deployment for exact commit/,
  );
  assert.deepEqual(delays, [15_000]);
});
