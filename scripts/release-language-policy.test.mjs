import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findReleaseLanguageViolations,
  normalizePolicyText,
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
  for (const phrase of ['sign off', 'sign-off', 'sign_off', 'sign-\noff']) {
    assert.ok(scan(phrase).some(({ rule }) => rule === 'manual-release-endorsement'));
  }
});

test('catches wrapped authenticated-reviewer wording', () => {
  const result = scan('Five distinct authenticated exact-head\nreviewers are expected.');
  assert.ok(result.some(({ rule }) => rule === 'release-endorsement'));
});

test('retired fields are allowed only in the migration scrubber and its behavior tests', () => {
  const field = ['pastor', 'reviewed'].join('_');
  assert.equal(scan(field, 'services/api/src/services/scriptureGate.js').length, 0);
  assert.equal(scan(field, 'services/api/src/__tests__/entitiesScriptureGate.test.js').length, 0);
  assert.ok(scan(field, 'apps/web/src/example.js').some(({ rule }) => rule === 'retired-attestation-field'));
});

test('migration exceptions do not allow natural-language gate copy', () => {
  const result = scan('This still requires pastoral review.', 'services/api/src/services/scriptureGate.js');
  assert.ok(result.some(({ rule }) => rule === 'sermon-attestation'));
});

test('ordinary code-review language remains allowed', () => {
  assert.deepEqual(scan('Open a pull request and address code review feedback.'), []);
});
