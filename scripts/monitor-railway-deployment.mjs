import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEPLOYMENT_ATTEMPTS = 40;
const DEPLOYMENT_POLL_MS = 15_000;
const LIVE_ATTEMPTS = 12;
const LIVE_POLL_MS = 5_000;

function commandResult(result) {
  return {
    status: Number.isInteger(result?.status) ? result.status : 1,
    stdout: String(result?.stdout || ''),
    stderr: String(result?.stderr || result?.error?.message || ''),
  };
}

function defaultExecutor(args) {
  return commandResult(spawnSync(process.env.RAILWAY_BIN || 'railway', args, {
    encoding: 'utf8',
    env: process.env,
  }));
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function diagnostic(result) {
  return `${result.stderr}\n${result.stdout}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 500) || `exit ${result.status}`;
}

export function selectExactDeployment(deployments, expectedSha) {
  if (!Array.isArray(deployments)) {
    throw new Error('Railway deployment list JSON must be an array');
  }
  return deployments
    .filter((deployment) => deployment?.meta?.commitHash === expectedSha)
    .sort((left, right) => {
      const leftTime = String(left?.createdAt || left?.updatedAt || '');
      const rightTime = String(right?.createdAt || right?.updatedAt || '');
      return leftTime.localeCompare(rightTime);
    })
    .at(-1) || null;
}

function parseDeploymentList(output) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error('Railway deployment list returned invalid JSON');
  }
}

async function fetchReadiness(readyUrl, fetchFn) {
  const response = await fetchFn(readyUrl, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`readiness returned HTTP ${response.status}`);
  return response.json();
}

async function emitLogs(executor, args, errorLog) {
  const result = commandResult(await executor(args));
  if (result.stdout) errorLog(result.stdout.trimEnd());
  if (result.stderr) errorLog(result.stderr.trimEnd());
}

export async function waitForExactDeployment(options) {
  const {
    service,
    expectedSha,
    readyUrl,
    executor = defaultExecutor,
    fetchFn = globalThis.fetch,
    sleep = defaultSleep,
    log = console.log,
    errorLog = console.error,
    deploymentAttempts = DEPLOYMENT_ATTEMPTS,
    deploymentPollMs = DEPLOYMENT_POLL_MS,
    liveAttempts = LIVE_ATTEMPTS,
    livePollMs = LIVE_POLL_MS,
  } = options;
  let lastMatch = null;

  log(`Watching ${service} for exact commit ${expectedSha}`);
  for (let attempt = 1; attempt <= deploymentAttempts; attempt += 1) {
    const list = commandResult(await executor([
      'deployment', 'list', '--service', service, '--limit', '100', '--json',
    ]));
    if (list.status !== 0) {
      errorLog(`Railway deployment list unavailable (${diagnostic(list)}), attempt ${attempt}/${deploymentAttempts}.`);
      if (attempt < deploymentAttempts) await sleep(deploymentPollMs);
      continue;
    }

    lastMatch = selectExactDeployment(parseDeploymentList(list.stdout), expectedSha);
    if (!lastMatch) {
      log(`No deployment for exact commit yet (attempt ${attempt}/${deploymentAttempts}).`);
      if (attempt < deploymentAttempts) await sleep(deploymentPollMs);
      continue;
    }

    const status = String(lastMatch.status || 'UNKNOWN').toUpperCase();
    const deploymentId = lastMatch.id || '(missing id)';
    if (status === 'FAILED' || status === 'CRASHED') {
      errorLog(`Exact deployment ${deploymentId} for ${expectedSha} ended in ${status}.`);
      if (lastMatch.id) {
        await emitLogs(executor, ['logs', lastMatch.id, '--service', service, '--build', '--lines', '200'], errorLog);
        await emitLogs(executor, ['logs', lastMatch.id, '--service', service, '--deployment', '--lines', '200'], errorLog);
      }
      throw new Error(`Exact Railway deployment failed: ${deploymentId} (${status})`);
    }

    if (status === 'SUCCESS') {
      log(`Railway reports exact deployment ${deploymentId} successful; verifying live identity.`);
      for (let liveAttempt = 1; liveAttempt <= liveAttempts; liveAttempt += 1) {
        try {
          const readiness = await fetchReadiness(readyUrl, fetchFn);
          if (readiness?.releaseSha === expectedSha) {
            log(`Live readiness confirms exact release ${expectedSha}`);
            return { deployment: lastMatch, readiness };
          }
          log(`Live release identity is '${readiness?.releaseSha || 'missing'}', expected ${expectedSha} (attempt ${liveAttempt}/${liveAttempts}).`);
        } catch (error) {
          log(`Live readiness unavailable (${error.message}), attempt ${liveAttempt}/${liveAttempts}.`);
        }
        if (liveAttempt < liveAttempts) await sleep(livePollMs);
      }
      throw new Error(`Railway deployment ${deploymentId} succeeded, but live readiness never reported exact release ${expectedSha}`);
    }

    log(`Exact deployment ${deploymentId} is ${status}; waiting.`);
    if (attempt < deploymentAttempts) await sleep(deploymentPollMs);
  }

  const suffix = lastMatch ? ` Last exact deployment: ${lastMatch.id || 'unknown'} (${lastMatch.status || 'unknown'}).` : '';
  throw new Error(`No successful Railway deployment for exact commit ${expectedSha} landed in time.${suffix}`);
}

async function main() {
  const service = process.env.RAILWAY_SERVICE || 'sermonsmith-api';
  const expectedSha = process.env.EXPECTED_SHA;
  const readyUrl = process.env.READY_URL;
  if (!process.env.RAILWAY_TOKEN) throw new Error('RAILWAY_TOKEN is required');
  if (!/^[0-9a-f]{40}$/i.test(expectedSha || '')) throw new Error('EXPECTED_SHA must be an exact 40-character commit SHA');
  if (!readyUrl) throw new Error('READY_URL is required');
  await waitForExactDeployment({ service, expectedSha, readyUrl });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
