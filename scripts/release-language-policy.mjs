import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// These two files necessarily contain the policy vocabulary as executable
// rule data and test fixtures. They are never shipped as product copy.
const POLICY_IMPLEMENTATION_PATHS = new Set([
  'scripts/release-language-policy.mjs',
  'scripts/release-language-policy.test.mjs',
]);

// Old persisted entities can still carry these exact keys/status. The gate and
// its migration tests may name them only so a normal edit can remove them.
const RETIRED_FIELD_MIGRATION_PATHS = new Set([
  'services/api/src/services/scriptureGate.js',
  'services/api/src/__tests__/entitiesScriptureGate.test.js',
  'services/api/src/__tests__/entitiesScriptureGateExtended.test.js',
]);

const RETIRED_FIELD = /\b(?:pastor_reviewed|ready_to_present|reviewed_by|reviewed_at|review_checklist(?:_version)?|needs_review)\b/giu;

const NORMALIZED_RULES = [
  ['manual-release-endorsement', /\bsign off\b/u],
  ['sermon-attestation', /\bpastoral review\b/u],
  ['sermon-attestation', /\bpastor reviewed\b/u],
  ['sermon-attestation', /\breview acknowledg(?:e)?ment\b/u],
  ['sermon-attestation', /\brequires? (?:a )?(?:human|pastoral) review\b/u],
  ['sermon-attestation', /\bi(?:'|’)ve reviewed this sermon\b/u],
  ['release-endorsement', /\bauthenticated (?:release )?reviewers?\b/u],
  ['release-endorsement', /\b(?:independent|external) (?:release )?reviewers? (?:are )?required\b/u],
  ['release-endorsement', /\bmandatory (?:independent|external|second) review(?:er)?\b/u],
  ['release-endorsement', /\b(?:five|5) (?:distinct )?(?:authenticated )?(?:exact head )?reviewers?\b/u],
  ['release-endorsement', /\b(?:five|5) (?:exact head )?(?:independent )?approvals?\b/u],
  ['release-endorsement', /\brequired reviewers?\b/u],
  ['release-endorsement', /\breviewer authenticated\b/u],
  ['removed-review-module', /@sermonsmith\/shared\/review\b/u],
  ['removed-review-route', /\/:type\/:id\/review\b/u],
];

/**
 * Normalize a complete file before matching. In particular, whitespace,
 * hyphens and underscores become one separator, so wrapping a phrase over a
 * line or spelling it as a code-style identifier cannot evade the policy.
 */
export function normalizePolicyText(text) {
  return String(text)
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\u2018\u2019]/gu, "'")
    .replace(/[\s\-\u2010-\u2015_]+/gu, ' ')
    .trim();
}

export function findReleaseLanguageViolations(path, source) {
  if (POLICY_IMPLEMENTATION_PATHS.has(path)) return [];

  const text = String(source);
  const violations = [];
  const retiredMatches = [...text.matchAll(RETIRED_FIELD)];
  const migrationFile = RETIRED_FIELD_MIGRATION_PATHS.has(path);

  if (!migrationFile) {
    for (const match of retiredMatches) {
      violations.push({
        path,
        rule: 'retired-attestation-field',
        excerpt: match[0],
      });
    }
  }

  // Exact legacy keys are removed before natural-language normalization only
  // in the three migration files above. Hyphenated, spaced or wrapped aliases
  // remain subject to the repository-wide rules.
  const naturalSource = migrationFile
    ? text.replace(RETIRED_FIELD, ' retired migration key ')
    : text;
  const normalized = normalizePolicyText(naturalSource);

  for (const [rule, pattern] of NORMALIZED_RULES) {
    const match = normalized.match(pattern);
    if (match) {
      violations.push({
        path,
        rule,
        excerpt: normalized.slice(Math.max(0, match.index - 32), match.index + match[0].length + 32),
      });
    }
  }

  return violations;
}

export function scanTrackedFiles({ cwd = process.cwd(), trackedFiles } = {}) {
  const names = trackedFiles || execFileSync('git', ['ls-files', '-z'], { cwd })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);

  const violations = [];
  for (const path of names) {
    let data;
    try {
      data = readFileSync(resolve(cwd, path));
    } catch {
      continue;
    }
    if (data.includes(0)) continue;
    violations.push(...findReleaseLanguageViolations(path, data.toString('utf8')));
  }
  return violations;
}

function main() {
  const violations = scanTrackedFiles();
  if (violations.length) {
    console.error('Prohibited release or sermon-attestation language found:');
    for (const violation of violations) {
      console.error(`${violation.path} [${violation.rule}]: ${violation.excerpt}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('Release language policy passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
