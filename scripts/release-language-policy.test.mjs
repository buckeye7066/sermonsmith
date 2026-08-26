import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  collapseLiteralChains,
  decodeCharacterReferences,
  findReleaseLanguageViolations,
  normalizePolicyText,
  scanTrackedFiles,
} from './release-language-policy.mjs';

const scan = (text, path = 'docs/example.md') => findReleaseLanguageViolations(path, text);

test('normalizes a complete file across whitespace, hyphens and underscores', () => {
  assert.equal(normalizePolicyText('Alpha\n\tBeta-gamma_delta'), 'alpha beta gamma delta');
});

test('catches a wrapped sermon attestation phrase', () => {
  assert.ok(scan('This requires pastoral\nreview before use.')
    .some(({ rule }) => rule === 'sermon-attestation'));
});

test('catches every separator variant of manual release endorsement', () => {
  for (const phrase of [
    'sign off',
    'sign-off',
    'sign_off',
    'sign-\noff',
    'owner signs off',
    'signing off',
    'signed off',
    'sign offs',
    'sign-offs',
    'signoff',
    'signoffs',
  ]) {
    assert.ok(scan(phrase).some(({ rule }) => rule === 'manual-release-endorsement'));
  }
});

test('catches wrapped authenticated-reviewer wording', () => {
  const result = scan('Five distinct authenticated exact-head\nreviewers are expected.');
  assert.ok(result.some(({ rule }) => rule === 'release-endorsement'));
});

test('retired fields are allowed only inside the deletion list of the migration scrubber', () => {
  const field = ['pastor', 'reviewed'].join('_');
  const cleanup = `const RETIRED_REVIEW_FIELDS = new Set(['${field}']);\nfor (const key of RETIRED_REVIEW_FIELDS) delete data[key];`;
  assert.equal(scan(cleanup, 'services/api/src/services/scriptureGate.js').length, 0);
  assert.ok(scan(`const RETIRED_REVIEW_FIELDS = new Set(['${field}']);`, 'services/api/src/services/scriptureGate.js')
    .some(({ rule }) => rule === 'retired-attestation-field'));
  assert.ok(scan(`enable('${field}')`, 'services/api/src/services/scriptureGate.js')
    .some(({ rule }) => rule === 'retired-attestation-field'));
  assert.ok(scan(field, 'apps/web/src/example.js').some(({ rule }) => rule === 'retired-attestation-field'));
  const oldState = ['needs', 'review'].join('_');
  assert.equal(scan(`if (data.status === '${oldState}') data.status = 'draft';`, 'services/api/src/services/scriptureGate.js').length, 0);
  assert.ok(scan(`data.status = '${oldState}';`, 'services/api/src/services/scriptureGate.js')
    .some(({ rule }) => rule === 'retired-attestation-field'));
});

test('migration exceptions do not allow natural-language gate copy', () => {
  const result = scan('This still requires pastoral review.', 'services/api/src/services/scriptureGate.js');
  assert.ok(result.some(({ rule }) => rule === 'sermon-attestation'));
});

test('ordinary code-review language remains allowed', () => {
  assert.deepEqual(scan('Open a pull request and address code review feedback.'), []);
});

test('catches phrases split by JSX nodes, string concatenation, and camel case', () => {
  const fixtures = [
    '<span>pastoral</span><span>review</span>',
    "const copy = 'sign' + 'off';",
    '<span>owner signs</span>{" "}<span>off</span>',
    'const requiredReviewer = true;',
  ];
  for (const fixture of fixtures) assert.ok(scan(fixture).length > 0, fixture);
});

test('decodes rendered character references before applying the rules', () => {
  assert.equal(decodeCharacterReferences('signs&#32;off'), 'signs off');
  for (const fixture of [
    'owner signs&#32;off',
    'owner signs&#x20;off',
    'owner signs&nbsp;off',
    'owner signs&Tab;off',
    'owner&#32;signs&amp;#32;off',
    '&#115;&#105;&#103;&#110;&#115;&#32;&#111;&#102;&#102;',
  ]) {
    assert.ok(scan(fixture).some(({ rule }) => rule === 'manual-release-endorsement'), fixture);
  }
});

test('reconstructs complete multi-literal chains without joining non-literals', () => {
  const chain = "const copy = 'owner ' + 'sig' + 'ns ' + '-' + 'off';";
  assert.match(collapseLiteralChains(chain), /owner signs -off/u);
  assert.ok(scan(chain).some(({ rule }) => rule === 'manual-release-endorsement'));
  assert.equal(scan("const copy = 'sign' + runtimeValue + 'off';").length, 0);
});

test('decodes escapes in standalone JavaScript literals', () => {
  for (const fixture of [
    String.raw`const copy = "pastoral\u0020review";`,
    String.raw`const copy = "owner signs\x20off";`,
    String.raw`const copy = 'sign\u{20}offs';`,
  ]) {
    assert.ok(scan(fixture).length > 0, fixture);
  }
});

test('keeps lexical boundaries around nearby ordinary words', () => {
  for (const fixture of ['assign office', 'cosigning officers', 'signal offset', 'designer signifier']) {
    assert.deepEqual(scan(fixture), [], fixture);
  }
});

test('scans the indexed blob and any different present worktree copy', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'sermonsmith-policy-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd });
    writeFileSync(join(cwd, 'indexed.md'), 'owner signs&#32;off');
    writeFileSync(join(cwd, 'present.md'), 'ordinary text');
    execFileSync('git', ['add', 'indexed.md', 'present.md'], { cwd });
    unlinkSync(join(cwd, 'indexed.md'));
    writeFileSync(join(cwd, 'present.md'), "const copy = 'sign' + 'ing ' + 'off';");

    const paths = new Set(scanTrackedFiles({ cwd }).map(({ path }) => path));
    assert.deepEqual(paths, new Set(['indexed.md', 'present.md']));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
