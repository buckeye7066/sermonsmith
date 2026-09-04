import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

describe('API startup boundary', () => {
  it('can construct the API dependencies without DATABASE_URL so liveness can boot', () => {
    const authModule = new URL('../middleware/auth.js', import.meta.url).href;
    const env = { ...process.env };
    delete env.DATABASE_URL;

    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', `await import(${JSON.stringify(authModule)})`],
      { env, encoding: 'utf8', timeout: 10_000 },
    );

    expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
  });
});
