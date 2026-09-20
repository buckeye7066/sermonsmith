import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('./review-failure-summary.mjs', import.meta.url));
const marker = 'PRIVATE-CONTENT-MUST-NOT-APPEAR';
function summarize(events, raw = false) {
  const dir = mkdtempSync(join(tmpdir(), 'review-summary-test-'));
  try {
    const path = join(dir, 'execution.json');
    writeFileSync(path, raw ? events : JSON.stringify(events));
    const result = spawnSync(process.execPath, [script], {
      encoding: 'utf8', timeout: 10000,
      env: { ...process.env, CLAUDE_EXECUTION_FILE: path },
    });
    assert.equal(result.status, 0, 'failure diagnostic must run without changing review outcome');
    assert.equal(result.stderr, '');
    assert.ok(!result.stdout.includes(marker), 'raw execution content must stay private');
    return JSON.parse(result.stdout);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('classifies provider authentication without exposing its text', () => {
  const result = summarize([{ type: 'result', is_error: true,
    result: `OAuth token has expired: ${marker}`, modelUsage: {} }]);
  assert.equal(result.category, 'authentication');
  assert.equal(result.provider_usage_recorded, false);
});
test('distinguishes limits from authentication and application defects', () => {
  const result = summarize([{ type: 'result', is_error: true,
    result: `You've hit your limit. ${marker}`, modelUsage: {} }]);
  assert.equal(result.category, 'rate_limit');
});
test('identifies an unavailable command without exposing command arguments', () => {
  assert.equal(summarize([{ type: 'result', is_error: true,
    result: `Unknown skill: ${marker}` }]).category, 'command_unavailable');
});
test('ignores tool output, prompts, and successful model text', () => {
  const result = summarize([{ type: 'user', message: { content: marker } },
    { type: 'assistant', message: { content: [{ type: 'text', text: `OAuth token expired ${marker}` }] } },
    { type: 'result', is_error: false, result: marker }]);
  assert.equal(result.category, 'no_failed_result');
});
test('malformed and unexpected execution files never print their content', () => {
  assert.equal(summarize(marker, true).category, 'execution_log_unreadable');
  assert.equal(summarize({ token: marker }).category, 'execution_log_unreadable');
});
test('unknown errors remain unknown and never become a passing review', () => {
  const result = summarize([{ type: 'result', is_error: true, result: marker,
    modelUsage: { private_model_name: { inputTokens: 12 } } }]);
  assert.deepEqual(result, { category: 'unknown_failure', failed_result: true,
    provider_usage_recorded: true });
});
test('workflow runs safe diagnostics on review failure without bypassing it', () => {
  const workflow = readFileSync(new URL('../.github/workflows/claude-code-review.yml', import.meta.url), 'utf8');
  assert.match(workflow, /node --test scripts\/review-failure-summary\.test\.mjs/);
  assert.match(workflow, /failure\(\) && steps\.claude-review\.outcome == 'failure'/);
  assert.match(workflow, /node scripts\/review-failure-summary\.mjs/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true|show_full_output:\s*true/);
});
