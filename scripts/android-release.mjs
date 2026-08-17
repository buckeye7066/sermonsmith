import { spawnSync } from 'node:child_process';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_GH_ATTEMPTS = 5;
const FIRST_RETRY_DELAY_MS = 2_000;

export class GhCommandError extends Error {
  constructor(message, { kind, args, result }) {
    super(message);
    this.name = 'GhCommandError';
    this.kind = kind;
    this.args = args;
    this.result = result;
  }
}

function commandResult(result) {
  return {
    status: Number.isInteger(result?.status) ? result.status : 1,
    stdout: String(result?.stdout || ''),
    stderr: String(result?.stderr || result?.error?.message || ''),
  };
}

export function classifyGhFailure(result) {
  const normalized = commandResult(result);
  if (normalized.status === 0) return 'success';

  const detail = `${normalized.stdout}\n${normalized.stderr}`;
  if (/\bHTTP\s+429\b|secondary rate limit|rate limit exceeded|too many requests/i.test(detail)) {
    return 'transient';
  }
  if (/\bHTTP\s+5\d\d\b|\b(500|502|503|504)\b|timed? out|timeout|ECONNRESET|ECONNREFUSED|TLS handshake|temporary failure|failed to connect/i.test(detail)) {
    return 'transient';
  }
  if (/\bHTTP\s+(401|403)\b|bad credentials|authentication failed|not authorized|resource not accessible|insufficient permission/i.test(detail)) {
    return 'auth';
  }
  if (/\bHTTP\s+404\b|release not found|could not resolve to a release|not found/i.test(detail)) {
    return 'not_found';
  }
  if (/already[_ ]exists|already exists|validation failed.*tag/i.test(detail)) {
    return 'already_exists';
  }
  return 'fatal';
}

function defaultExecutor(args) {
  return commandResult(spawnSync(process.env.GH_BIN || 'gh', args, {
    encoding: 'utf8',
    env: process.env,
  }));
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortDiagnostic(result) {
  const line = `${result.stderr}\n${result.stdout}`
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find(Boolean);
  return (line || `exit ${result.status}`).slice(0, 300);
}

export async function runGh(args, options = {}) {
  const executor = options.executor || defaultExecutor;
  const sleep = options.sleep || defaultSleep;
  const log = options.log || console.error;
  const maxAttempts = options.maxAttempts || MAX_GH_ATTEMPTS;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = commandResult(await executor(args));
    const kind = classifyGhFailure(result);
    if (kind === 'success') return { found: true, ...result };
    if (kind === 'not_found' && options.allowNotFound) {
      return { found: false, ...result };
    }
    if (kind === 'transient' && attempt < maxAttempts) {
      const delayMs = FIRST_RETRY_DELAY_MS * (2 ** (attempt - 1));
      log(`GitHub API transient failure (${shortDiagnostic(result)}); retry ${attempt + 1}/${maxAttempts} in ${delayMs / 1_000}s.`);
      await sleep(delayMs);
      continue;
    }
    throw new GhCommandError(
      `GitHub CLI failed (${kind}) after ${attempt} attempt${attempt === 1 ? '' : 's'}: ${shortDiagnostic(result)}`,
      { kind, args, result },
    );
  }
  throw new Error('unreachable');
}

function parseJson(output, label) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

async function viewRelease({ repo, tag, executor, sleep, log }) {
  const result = await runGh(
    ['release', 'view', tag, '--repo', repo, '--json', 'targetCommitish,isDraft,assets'],
    { executor, sleep, log, allowNotFound: true },
  );
  return result.found ? parseJson(result.stdout, `Release ${tag}`) : null;
}

function assertReleaseTarget(release, target, tag) {
  if (release.targetCommitish !== target) {
    throw new Error(`Existing ${tag} targets ${release.targetCommitish || '(empty)'}, expected exact commit ${target}`);
  }
}

async function createDraftRelease(options) {
  const { repo, tag, target, title, notes, executor = defaultExecutor, sleep = defaultSleep, log = console.error } = options;
  const args = [
    'release', 'create', tag,
    '--repo', repo,
    '--target', target,
    '--title', title,
    '--notes', notes,
    '--draft',
  ];

  for (let attempt = 1; attempt <= MAX_GH_ATTEMPTS; attempt += 1) {
    const result = commandResult(await executor(args));
    const kind = classifyGhFailure(result);
    if (kind === 'success') return;

    if (kind === 'transient' || kind === 'already_exists') {
      // A create request can succeed server-side even when the response is a
      // 5xx or the connection drops. Re-read before retrying so we never turn
      // that ambiguous outcome into a duplicate/non-idempotent create loop.
      const observed = await viewRelease({ repo, tag, executor, sleep, log });
      if (observed) {
        assertReleaseTarget(observed, target, tag);
        return;
      }
      if (attempt < MAX_GH_ATTEMPTS) {
        const delayMs = FIRST_RETRY_DELAY_MS * (2 ** (attempt - 1));
        log(`GitHub release creation is not yet observable; retry ${attempt + 1}/${MAX_GH_ATTEMPTS} in ${delayMs / 1_000}s.`);
        await sleep(delayMs);
        continue;
      }
    }

    throw new GhCommandError(
      `Unable to create ${tag} (${kind}) after ${attempt} attempt${attempt === 1 ? '' : 's'}: ${shortDiagnostic(result)}`,
      { kind, args, result },
    );
  }
}

function assetNames(release) {
  return new Set((release.assets || []).map((asset) => asset?.name).filter(Boolean));
}

export async function publishAndroidRelease(options) {
  const {
    repo,
    tag,
    target,
    title,
    notes,
    assets,
    executor = defaultExecutor,
    sleep = defaultSleep,
    log = console.error,
  } = options;
  if (!assets?.length) throw new Error('At least one Android release asset is required');

  let release = await viewRelease({ repo, tag, executor, sleep, log });
  if (!release) {
    await createDraftRelease({ repo, tag, target, title, notes, executor, sleep, log });
    release = await viewRelease({ repo, tag, executor, sleep, log });
    if (!release) throw new Error(`GitHub reported ${tag} created, but it could not be read back`);
  }
  assertReleaseTarget(release, target, tag);

  await runGh(
    ['release', 'upload', tag, ...assets, '--repo', repo, '--clobber'],
    { executor, sleep, log },
  );
  await runGh(
    ['release', 'edit', tag, '--repo', repo, '--target', target, '--title', title, '--notes', notes, '--draft=false'],
    { executor, sleep, log },
  );

  const verified = await viewRelease({ repo, tag, executor, sleep, log });
  if (!verified) throw new Error(`${tag} disappeared after publication`);
  assertReleaseTarget(verified, target, tag);
  if (verified.isDraft) throw new Error(`${tag} is still a draft after publication`);

  const publishedAssets = assetNames(verified);
  const missing = assets.map((asset) => path.basename(asset)).filter((name) => !publishedAssets.has(name));
  if (missing.length) throw new Error(`${tag} is missing release assets: ${missing.join(', ')}`);
  return verified;
}

function normalizeFingerprint(value, label) {
  const fingerprint = value.toLowerCase().replace(/[:\s]/g, '');
  if (!/^[0-9a-f]{64}$/.test(fingerprint)) {
    throw new Error(`${label} is not a normalized SHA-256 certificate fingerprint`);
  }
  return fingerprint;
}

export async function verifySigningBaseline(options) {
  const {
    repo,
    fingerprintPath,
    downloadDir,
    executor = defaultExecutor,
    sleep = defaultSleep,
    log = console.error,
  } = options;
  const list = await runGh(
    ['release', 'list', '--repo', repo, '--limit', '100', '--json', 'tagName,isDraft'],
    { executor, sleep, log },
  );
  const releases = parseJson(list.stdout, 'GitHub release list');
  const baseline = releases.find((release) => release?.tagName?.startsWith('android-v') && !release.isDraft);
  if (!baseline) return { bootstrap: true, tag: null };

  await mkdir(downloadDir, { recursive: true });
  await runGh(
    [
      'release', 'download', baseline.tagName,
      '--repo', repo,
      '--pattern', 'sermonsmith-signing-cert.sha256',
      '--dir', downloadDir,
      '--clobber',
    ],
    { executor, sleep, log },
  );

  const configured = normalizeFingerprint(await readFile(fingerprintPath, 'utf8'), 'Configured keystore fingerprint');
  const downloadedPath = path.join(downloadDir, 'sermonsmith-signing-cert.sha256');
  const prior = normalizeFingerprint(await readFile(downloadedPath, 'utf8'), `Signing fingerprint from ${baseline.tagName}`);
  if (configured !== prior) {
    throw new Error('Configured keystore certificate differs from prior Android releases');
  }
  return { bootstrap: false, tag: baseline.tagName };
}

function parseArgs(argv) {
  const values = { assets: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--') || i + 1 >= argv.length) throw new Error(`Invalid argument: ${key}`);
    const value = argv[i + 1];
    i += 1;
    if (key === '--asset') values.assets.push(value);
    else values[key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  return values;
}

function requireValues(values, names) {
  for (const name of names) {
    if (!values[name]) throw new Error(`Missing --${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
  }
}

async function main() {
  const [command, ...argv] = process.argv.slice(2);
  const values = parseArgs(argv);
  if (command === 'baseline') {
    requireValues(values, ['repo', 'fingerprint', 'downloadDir']);
    const result = await verifySigningBaseline({
      repo: values.repo,
      fingerprintPath: values.fingerprint,
      downloadDir: values.downloadDir,
    });
    console.log(result.bootstrap
      ? 'No prior signed Android release: this build will establish the signing fingerprint.'
      : `Signing identity matches ${result.tag}.`);
    return;
  }
  if (command === 'publish') {
    requireValues(values, ['repo', 'tag', 'target', 'title', 'notes']);
    for (const asset of values.assets) {
      const details = await stat(asset);
      if (!details.isFile() || details.size === 0) throw new Error(`Release asset is missing or empty: ${asset}`);
    }
    await publishAndroidRelease({
      repo: values.repo,
      tag: values.tag,
      target: values.target,
      title: values.title,
      notes: values.notes,
      assets: values.assets,
    });
    console.log(`Published and verified ${values.tag} at exact commit ${values.target}.`);
    return;
  }
  throw new Error('Usage: android-release.mjs <baseline|publish> [options]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
