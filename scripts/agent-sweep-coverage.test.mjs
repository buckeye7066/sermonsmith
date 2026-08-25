// Does the nightly sweep cover what the docs say it covers?
//
// PROJECT-BRIEF.md claimed:
//
//   "The nightly sweep (tools/agents/sweep.mjs) runs all 8 CI gates and writes
//    a health-score report to tools/agents/reports/"
//
// It does not. The sweep has 8 gates of its own — config:verify, typecheck,
// lint, test:api, test:web, build:web, e2e, audit — and the count matching 8
// is a coincidence that made the sentence read plausibly. Four PR checks are
// absent from it:
//
//   integration-test  (ci.yml)                    real Postgres + migrations
//   desktop-build-windows-smoke (ci.yml)           real Electron/NSIS packaging
//   policy            (release-language-policy.yml)
//   android-pr        (android-build.yml)         debug APK builds at all
//
// i.e. exactly the gates that catch a broken migration, prohibited release
// language, and an unbuildable Android package.
//
// This test pins the real relationship, so the claim cannot drift back:
//   * every sweep gate must name an npm script that exists;
//   * the set of PR-blocking CI jobs the sweep does NOT run must equal the
//     list documented below. Add a CI job and this fails until the docs and
//     this list are updated.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Workflows whose jobs run on a pull request, i.e. the gates a merge waits on. */
const PR_WORKFLOWS = ['ci.yml', 'release-language-policy.yml', 'android-build.yml'];

/** Jobs in those workflows that do not gate a PR. */
const NON_PR_JOBS = new Set(['android', 'publish']);

/**
 * CI gates the nightly sweep deliberately does NOT run, with the reason.
 * Keeping this explicit is the point: an uncovered gate must be named, not
 * absorbed into a round number.
 */
const KNOWN_UNCOVERED = {
  'integration-test': 'needs a live Postgres service container',
  'desktop-build-windows-smoke': 'needs a hosted Windows runner and Electron/NSIS toolchain',
  policy: 'release-language scan runs only in CI',
  'android-pr': 'needs the Android SDK/JDK toolchain',
};

function sweepGateIds() {
  const src = read('tools/agents/sweep.mjs');
  const block = /const GATES = \[([\s\S]*?)\n\];/.exec(src);
  assert.ok(block, 'tools/agents/sweep.mjs must declare a GATES array');
  return [...block[1].matchAll(/\{\s*id:\s*'([^']+)'/g)].map((m) => m[1]);
}

function sweepGateCommands() {
  const src = read('tools/agents/sweep.mjs');
  const block = /const GATES = \[([\s\S]*?)\n\];/.exec(src);
  return [...block[1].matchAll(/cmd:\s*'([^']+)'/g)].map((m) => m[1]);
}

function prBlockingJobs() {
  const jobs = [];
  for (const file of PR_WORKFLOWS) {
    const yaml = read(path.join('.github/workflows', file));
    for (const m of yaml.matchAll(/^ {2}([a-z0-9][a-z0-9-]*):$/gm)) {
      if (m[1] === 'push' || NON_PR_JOBS.has(m[1])) continue;
      jobs.push(m[1]);
    }
  }
  return jobs;
}

test('every sweep gate invokes an npm script that exists', () => {
  const pkg = JSON.parse(read('package.json'));
  const commands = sweepGateCommands();
  assert.ok(commands.length > 0, 'no sweep gate commands parsed — the guard cannot be trusted');
  for (const cmd of commands) {
    const m = /^npm run ([\w:-]+)/.exec(cmd);
    assert.ok(m, `sweep gate command is not an npm script: ${cmd}`);
    assert.ok(
      Object.prototype.hasOwnProperty.call(pkg.scripts, m[1]),
      `sweep runs "npm run ${m[1]}" but package.json has no such script — the gate would fail as an error, not a finding`,
    );
  }
});

test('the sweep does not silently drop a gate it used to run', () => {
  // Pinned so a gate cannot quietly disappear from the nightly run while the
  // report still reads as a full sweep.
  assert.deepEqual(sweepGateIds(), [
    'config:verify', 'typecheck', 'lint', 'test:api', 'test:web', 'build:web', 'e2e', 'audit',
  ]);
});

test('the CI gates the sweep does NOT cover are exactly the documented ones', () => {
  const jobs = prBlockingJobs();
  assert.ok(jobs.length > 0, 'no PR-blocking CI jobs found — the guard cannot be trusted');

  // Which CI jobs does a sweep gate stand in for?
  const coveredBy = {
    'lint-and-typecheck': ['typecheck', 'lint', 'config:verify'],
    test: ['test:api', 'test:web'],
    'build-web': ['build:web'],
    e2e: ['e2e'],
    'security-audit': ['audit'],
  };
  const gates = new Set(sweepGateIds());

  const uncovered = jobs.filter((job) => {
    const needs = coveredBy[job];
    return !needs || !needs.every((g) => gates.has(g));
  });

  assert.deepEqual(
    uncovered.sort(), Object.keys(KNOWN_UNCOVERED).sort(),
    'The set of CI gates the nightly sweep does not run has changed. Update '
    + 'KNOWN_UNCOVERED and the coverage sentence in PROJECT-BRIEF.md — a sweep '
    + 'report must never read as broader than it is.',
  );
});

test('PROJECT-BRIEF does not claim the sweep runs all CI gates', () => {
  const brief = read('PROJECT-BRIEF.md');
  assert.equal(
    /sweep[^.]*runs all \d+ CI gates/i.test(brief), false,
    'PROJECT-BRIEF.md claims the nightly sweep runs all CI gates; it does not run '
    + Object.keys(KNOWN_UNCOVERED).join(', '),
  );
  // ...and it must name the gaps rather than staying silent about them.
  for (const job of Object.keys(KNOWN_UNCOVERED)) {
    assert.ok(brief.includes(job), `PROJECT-BRIEF.md must name the uncovered gate ${job}`);
  }
});
