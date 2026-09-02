#!/usr/bin/env node
/**
 * SermonSmith nightly self-test sweep ("Sam/Anya lite").
 *
 * Modeled on GrantFlow's agent ecosystem (Sam: overnight sweep + safe
 * auto-fixes; Anya: findings report with health score + owner actions), but
 * right-sized for this repo: it runs the repo's REAL gates, auto-fixes only
 * provably-safe classes (eslint --fix), and writes a findings report.
 *
 * Safe by default:
 *   - Auto-fix only runs on a CLEAN tree, never on main, and its commit lands
 *     on a fresh agents/autofix-* branch ONLY after the full gate re-passes.
 *     If the gate fails after fixing, every fix is reverted.
 *   - Nothing is ever pushed. The report lists the branch for owner review.
 *
 * Usage:
 *   node tools/agents/sweep.mjs              # full sweep + safe auto-fix lane
 *   node tools/agents/sweep.mjs --no-fix     # observe/report only
 *   node tools/agents/sweep.mjs --email      # also email the report (needs RESEND_API_KEY)
 *
 * Artifacts (gitignored): tools/agents/reports/sweep-<date>.{md,json}
 * Scheduled: Windows task "SermonSmith Nightly Sweep" (see tools/agents/sweep.cmd)
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const reportsDir = path.join(__dirname, 'reports');
const args = new Set(process.argv.slice(2));
const doFix = !args.has('--no-fix');
const doEmail = args.has('--email');

const startedAt = new Date();
const stamp = startedAt.toISOString().slice(0, 19).replace(/[T:]/g, '-');
mkdirSync(reportsDir, { recursive: true });

function sh(command, { cwd = repoRoot, timeoutMs = 20 * 60 * 1000 } = {}) {
  const t0 = Date.now();
  const res = spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
  });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  return {
    command,
    ok: res.status === 0,
    status: res.status,
    seconds: Math.round((Date.now() - t0) / 1000),
    tail: out.split(/\r?\n/).filter(Boolean).slice(-25).join('\n'),
  };
}

function git(cmd) {
  return sh(`git ${cmd}`, { timeoutMs: 5 * 60 * 1000 });
}

// ─── The repo's real gates ───────────────────────────────────────────────────
const GATES = [
  { id: 'config:verify', cmd: 'npm run config:verify', what: 'Vercel routing/security policy' },
  { id: 'typecheck', cmd: 'npm run typecheck', what: 'web + api typecheck' },
  { id: 'lint', cmd: 'npm run lint', what: 'web + api ESLint (0 warnings tolerated by CI)' },
  { id: 'test:api', cmd: 'npm run test:api', what: 'API vitest suite' },
  { id: 'test:web', cmd: 'npm run test:web', what: 'web vitest suite' },
  { id: 'build:web', cmd: 'npm run build:web', what: 'production web build (also feeds the e2e preview server)' },
  {
    id: 'e2e',
    cmd: 'npm run test:e2e',
    what: 'Playwright user journeys (boot, auth surface incl. register, Bible Reader link renders scripture, sermon builder core + warning flows, shell layout)',
  },
  { id: 'audit', cmd: 'npm run audit', what: 'security advisories vs documented allowlist' },
];

function runGates(label) {
  console.log(`\n=== gate run: ${label} ===`);
  const results = [];
  for (const gate of GATES) {
    process.stdout.write(`  ${gate.id} ... `);
    const r = sh(gate.cmd);
    console.log(r.ok ? `PASS (${r.seconds}s)` : `FAIL (${r.seconds}s, exit ${r.status})`);
    results.push({ ...gate, ...r });
  }
  return results;
}

// ─── 1. Baseline gate run ────────────────────────────────────────────────────
const gitStatusBefore = git('status --porcelain');
const branchBefore = git('rev-parse --abbrev-ref HEAD').tail.trim();
const headBefore = git('rev-parse --short HEAD').tail.trim();

const baseline = runGates('baseline');

// ─── 2. Safe auto-fix lane (eslint --fix only) ───────────────────────────────
const autofix = { attempted: false, skippedReason: null, changedFiles: [], outcome: null, branch: null };
if (!doFix) {
  autofix.skippedReason = '--no-fix';
} else if (gitStatusBefore.tail.trim() !== '') {
  autofix.skippedReason = 'working tree not clean — never auto-fix over unrelated changes';
} else {
  autofix.attempted = true;
  console.log('\n=== auto-fix lane: eslint --fix (web + api) ===');
  sh('npx eslint . --fix', { cwd: path.join(repoRoot, 'apps', 'web') });
  sh('npx eslint "src/**/*.js" --fix', { cwd: path.join(repoRoot, 'services', 'api') });
  const changed = git('status --porcelain').tail.trim();
  if (!changed) {
    autofix.outcome = 'nothing to fix';
    console.log('  no fixable issues.');
  } else {
    // Porcelain lines are "XY path"; the surrounding .trim() may have eaten a
    // leading status char, so strip the status column by pattern, not offset.
    autofix.changedFiles = changed.split(/\r?\n/).map((l) => l.trim().replace(/^[A-Z?!]{1,2}\s+/i, ''));
    console.log(`  eslint --fix changed ${autofix.changedFiles.length} file(s); re-running full gate...`);
    const regate = runGates('post-autofix');
    if (regate.every((g) => g.ok)) {
      const branch = `agents/autofix-${stamp}`;
      git(`checkout -b ${branch}`);
      git('add -A -- apps services packages');
      const msg = [
        'chore(agents): nightly sweep auto-fix (eslint --fix)',
        '',
        `Files: ${autofix.changedFiles.join(', ')}`,
        'Full gate re-passed after fixing (config:verify, typecheck, lint, tests, e2e, audit).',
        '',
        'Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>',
      ].join('\n');
      writeFileSync(path.join(reportsDir, 'commit-msg.tmp'), msg);
      git(`commit -F "${path.join(reportsDir, 'commit-msg.tmp')}"`);
      git(`checkout ${branchBefore}`);
      autofix.outcome = 'committed';
      autofix.branch = branch;
      console.log(`  committed on ${branch}; back on ${branchBefore}. NOT pushed — owner review.`);
    } else {
      git('checkout -- .');
      autofix.outcome = 'reverted — gate failed after eslint --fix';
      console.log('  gate FAILED after fixes; all fix edits reverted.');
    }
  }
}

// ─── 3. Findings + health score ──────────────────────────────────────────────
const passed = baseline.filter((g) => g.ok);
const failed = baseline.filter((g) => !g.ok);
const healthScore = Math.round((passed.length / baseline.length) * 100);
const needsAttention = failed.map((g) => ({
  gate: g.id,
  what: g.what,
  exit: g.status,
  tail: g.tail,
}));

const report = {
  ranAt: startedAt.toISOString(),
  repo: 'sermonsmith',
  branch: branchBefore,
  head: headBefore,
  healthScore,
  gates: baseline.map(({ id, what, ok, status, seconds }) => ({ id, what, ok, exit: status, seconds })),
  needsAttention,
  autofix,
  durationSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
};

mkdirSync(reportsDir, { recursive: true });
const jsonPath = path.join(reportsDir, `sweep-${stamp}.json`);
writeFileSync(jsonPath, JSON.stringify(report, null, 2));

const md = [
  `# SermonSmith nightly sweep — ${startedAt.toISOString().slice(0, 10)}`,
  '',
  `- **Health score: ${healthScore}/100** (${passed.length}/${baseline.length} gates green)`,
  `- Branch \`${branchBefore}\` @ \`${headBefore}\` — ran ${report.durationSeconds}s`,
  '',
  '## Gates',
  '',
  '| gate | result | time | covers |',
  '|---|---|---|---|',
  ...baseline.map((g) => `| ${g.id} | ${g.ok ? 'PASS' : `**FAIL** (exit ${g.status})`} | ${g.seconds}s | ${g.what} |`),
  '',
  '## Auto-fix lane',
  '',
  autofix.attempted
    ? `- Outcome: ${autofix.outcome}${autofix.branch ? ` → branch \`${autofix.branch}\` (not pushed — review + merge)` : ''}${
        autofix.changedFiles.length ? `\n- Files: ${autofix.changedFiles.join(', ')}` : ''
      }`
    : `- Skipped: ${autofix.skippedReason}`,
  '',
  '## Needs attention',
  '',
  ...(needsAttention.length
    ? needsAttention.flatMap((n) => [`### ${n.gate} — ${n.what}`, '', '```', n.tail, '```', ''])
    : ['Nothing. All gates green.']),
].join('\n');

const mdPath = path.join(reportsDir, `sweep-${stamp}.md`);
writeFileSync(mdPath, md);
console.log(`\nreport: ${mdPath}\nhealth score: ${healthScore}/100`);

// ─── 4. Optional email (Anya-style daily report) via Resend ─────────────────
if (doEmail) {
  let key = process.env.RESEND_API_KEY;
  const envFile = path.join(repoRoot, 'services', 'api', '.env');
  if (!key && existsSync(envFile)) {
    const envContent = readFileSync(envFile, 'utf8');
    const m = envContent.match(/^RESEND_API_KEY="?([A-Za-z0-9_\-]{20,})"?/m);
    if (m && !/your/i.test(m[1])) key = m[1];
  }
  const to = process.env.SWEEP_EMAIL_TO || 'buckeye7066@gmail.com';
  if (!key) {
    console.log('email: skipped — no RESEND_API_KEY configured');
  } else {
    try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'SermonSmith <noreply@sermonsmith.app>',
        to: [to],
        subject: `[SermonSmith] nightly sweep — health ${healthScore}/100, ${failed.length} gate(s) failing`,
        text: md,
      }),
    });
    console.log(`email: ${resp.ok ? 'sent' : `FAILED (${resp.status})`} to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
  }
}

process.exit(failed.length === 0 ? 0 : 1);
