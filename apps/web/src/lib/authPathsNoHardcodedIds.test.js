/**
 * Regression audit for the 2026-07-06 "Object Not Found Matching Id:4" report:
 * the investigation proved the error was injected by Microsoft Outlook's
 * SafeLinks scanner (which pre-fetches /Login?reset_token=… links from
 * password-reset emails), NOT by app code — every DB id is a UUID and no auth
 * code path targets a numeric record id. This test keeps it that way: no
 * hardcoded numeric record IDs may creep into the login/auth/reporting paths.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const AUTH_PATH_FILES = [
  'pages/Login.jsx',
  'lib/AuthContext.jsx',
  'api/apiClient.js',
  'lib/reportClientError.js',
];

// Matches hardcoded numeric ids like `id: 4`, `Id = 4`, `userId: 4`,
// `update(4,` — the shapes a regressed hardcoded record id would take.
const HARDCODED_NUMERIC_ID = /\b\w*[iI]d\s*[:=]\s*['"]?\d+['"]?(?![.\d])|\.update\(\s*\d+\s*[,)]/;

describe('auth paths contain no hardcoded numeric record IDs', () => {
  for (const rel of AUTH_PATH_FILES) {
    it(rel, () => {
      const source = readFileSync(path.join(SRC, rel), 'utf8');
      const lines = source.split('\n');
      const offenders = lines
        .map((line, i) => ({ line, n: i + 1 }))
        // Comment lines may legitimately cite the scanner signature.
        .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .filter(({ line }) => HARDCODED_NUMERIC_ID.test(line.replace(/\/\/.*$/, '')));
      expect(offenders, `hardcoded numeric id in ${rel}: ${offenders.map((o) => `L${o.n}: ${o.line.trim()}`).join(' | ')}`).toEqual([]);
    });
  }
});
