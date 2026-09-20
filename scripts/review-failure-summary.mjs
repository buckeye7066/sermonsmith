import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Never print execution text: it can contain prompts, tool output, or credentials.
// Only fixed category names and booleans leave this process. This step does not
// turn a failed review into success or enable the action's full-output logging.
const empty = (category) => ({ category, failed_result: false,
  provider_usage_recorded: false });
let summary = empty('execution_log_unreadable');
try {
  const path = process.env.CLAUDE_EXECUTION_FILE
    || join(process.env.RUNNER_TEMP || '.', 'claude-execution-output.json');
  if (statSync(path).size > 16 * 1024 * 1024) throw new Error('log_limit');
  const events = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(events)) throw new Error('invalid_log');
  const result = events.findLast((event) => event?.type === 'result');
  if (result?.is_error !== true) {
    summary = empty('no_failed_result');
  } else {
    const text = typeof result.result === 'string' ? result.result.slice(0, 32768) : '';
    const usage = result.modelUsage;
    summary = { category: 'unknown_failure', failed_result: true,
      provider_usage_recorded: Boolean(usage && typeof usage === 'object'
        && !Array.isArray(usage) && Object.keys(usage).length) };
    if (/oauth.{0,60}expir|invalid.{0,30}(?:api key|token)|authentication_error|unauthorized/i.test(text)) {
      summary.category = 'authentication';
    } else if (/rate.limit|hit your limit|usage.limit|quota.exceeded|too many requests/i.test(text)) {
      summary.category = 'rate_limit';
    } else if (/credit balance|insufficient.credit|billing_error/i.test(text)) {
      summary.category = 'billing';
    } else if (/unknown (?:skill|slash command|command)|skill.{0,40}not found/i.test(text)) {
      summary.category = 'command_unavailable';
    } else if (/model.{0,50}(?:not found|unavailable|not supported)/i.test(text)) {
      summary.category = 'model_unavailable';
    } else if (/permission.denied|not permitted|access.denied/i.test(text)) {
      summary.category = 'permission';
    }
  }
} catch {
  // Filesystem and parsing errors can also contain sensitive paths or content.
}
process.stdout.write(`${JSON.stringify(summary)}\n`);
