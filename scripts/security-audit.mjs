// CI production-dependency audit with a DOCUMENTED allowlist.
//
// `npm audit --omit=dev --audit-level=high` is a hard gate with no ignore
// mechanism, so a single unfixable advisory blocks every PR in the repo.
// That happened on 2026-07-25: GHSA-qwww-vcr4-c8h2 (React Router RSC-mode
// CSRF) is fixed only in react-router@8.3.0, which requires react>=19.2.7 —
// a React 18→19 migration, not a dependency bump. This wrapper keeps the
// gate's teeth (any high/critical advisory NOT allowlisted still fails, and
// an EXPIRED allowlist entry fails loudly) while letting a consciously
// assessed, unexploitable advisory through with its reasoning on record.
//
// Every entry MUST carry: the GHSA id, why it does not apply to this app,
// what the real fix is, and a review-by date after which CI fails again so
// the exception cannot quietly become permanent.
import { execFileSync, execSync } from 'node:child_process';

const ALLOWLIST = [
  {
    id: 'GHSA-qwww-vcr4-c8h2',
    reason:
      'React Router RSC-mode CSRF. SermonSmith is a classic BrowserRouter SPA — ' +
      'no RSC, no server actions, no framework-mode server runtime — so the ' +
      'vulnerable code path is never reachable. Real fix: react-router@8.3.0, ' +
      'which peer-requires react>=19.2.7 (a React 18→19 migration). ' +
      'Mirrored on GitHub: Dependabot alert #176 dismissed 2026-08-02 as ' +
      'not_used — when this entry is reviewed, re-assess that dismissal too, ' +
      'and drop BOTH the moment RSC/data routers or React 19 land.',
    reviewBy: '2026-10-01',
  },
  {
    id: 'GHSA-7p8r-x3mc-p8w7',
    reason:
      'fast-uri host confusion via a backslash authority introducer. It is not a ' +
      'direct dependency: the only production path is @sermonsmith/desktop -> ' +
      'electron-store -> conf -> ajv (verified with `npm ls fast-uri --omit=dev`; ' +
      'the web app and the API never ship it). There ajv uses fast-uri to resolve ' +
      'JSON Schema $ref/$id URIs while electron-store validates the desktop app ' +
      "against a schema we author ourselves. The flaw matters where a parsed " +
      'host drives a security decision (origin allowlists, SSRF filters); no such ' +
      'decision exists on this path, and no attacker-controlled URL reaches it. ' +
      'Real fix: fast-uri >= 3.1.5 — an npm `overrides` pin is the intended route, ' +
      'but npm 11.16.0 did not apply it to the nested ajv copy (the lock kept ' +
      '3.1.4, and a from-scratch regeneration also kept 3.1.4 while churning 76 ' +
      'unrelated entries). Prefer an upstream ajv bump from conf/electron-store; ' +
      're-try the override at review time and drop this entry the moment either lands.',
    reviewBy: '2026-09-15',
  },
];

let raw;
try {
  // No user input anywhere near this invocation. On Linux/macOS (CI) run npm
  // directly with an argument array and no shell. On Windows npm's entry point
  // is npm.cmd, which Node (CVE-2024-27980 mitigation) refuses to spawn
  // without a shell — so use the shell there with this FIXED literal string
  // only; never interpolate anything into it.
  const opts = { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
  raw =
    process.platform === 'win32'
      ? execSync('npm audit --omit=dev --json', opts)
      : execFileSync('npm', ['audit', '--omit=dev', '--json'], opts);
} catch (err) {
  // npm audit exits non-zero when vulnerabilities exist — the JSON is still on stdout.
  raw = err.stdout;
  if (!raw) {
    console.error('[security-audit] npm audit produced no output:', err.message);
    process.exit(1);
  }
}

const report = JSON.parse(raw);
const today = new Date().toISOString().slice(0, 10);
const failures = [];
const allowed = [];

for (const [name, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  if (!['high', 'critical'].includes(vuln.severity)) continue;
  // Advisory ids for this package. An entry whose `via` is only strings is a
  // pure dependency-chain echo of another package's advisory — the advisory
  // itself is judged where it appears with an id.
  const ids = (vuln.via ?? [])
    .filter((v) => typeof v === 'object' && v.url)
    .map((v) => String(v.url).split('/').pop());
  if (ids.length === 0) continue;
  for (const id of ids) {
    const entry = ALLOWLIST.find((a) => a.id === id);
    if (!entry) {
      failures.push(`${name}: ${id} (${vuln.severity}) — not allowlisted`);
    } else if (entry.reviewBy < today) {
      failures.push(`${name}: ${id} — allowlist entry EXPIRED ${entry.reviewBy}; re-assess or fix`);
    } else {
      allowed.push(`${name}: ${id} — allowlisted until ${entry.reviewBy}`);
    }
  }
}

for (const line of allowed) console.log(`[security-audit] ALLOWED ${line}`);
if (failures.length > 0) {
  for (const line of failures) console.error(`[security-audit] FAIL ${line}`);
  process.exit(1);
}
console.log('[security-audit] OK — no unallowlisted high/critical production advisories');
