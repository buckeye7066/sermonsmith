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
const RETIRED_FIELD_SCRUBBER_PATH = 'services/api/src/services/scriptureGate.js';

const RETIRED_FIELD = /\b(?:pastor_reviewed|ready_to_present|reviewed_by|reviewed_at|review_checklist(?:_version)?|needs_review)\b/giu;

const NORMALIZED_RULES = [
  ['manual-release-endorsement', /\bsign(?:s|ed|ing)? off(?:s)?\b/u],
  ['manual-release-endorsement', /\bsignoffs?\b/u],
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
];

const RAW_RULES = [
  ['removed-review-module', /@sermonsmith\/shared\/review\b/iu],
  ['removed-review-route', /\/:type\/:id\/review\b/iu],
];

const NAMED_CHARACTER_REFERENCES = new Map([
  ['amp', '&'],
  ['apos', "'"],
  ['ensp', ' '],
  ['emsp', ' '],
  ['hairsp', ' '],
  ['hyphen', '-'],
  ['ldquo', '"'],
  ['lsquo', "'"],
  ['mdash', '-'],
  ['nbsp', ' '],
  ['ndash', '-'],
  ['newline', '\n'],
  ['quot', '"'],
  ['rdquo', '"'],
  ['rsquo', "'"],
  ['tab', '\t'],
  ['thinsp', ' '],
  ['zwnj', ' '],
  ['zwj', ' '],
]);

/** Decode the character references browsers render before a user sees copy. */
export function decodeCharacterReferences(value) {
  let decoded = String(value);
  // A bounded repeat catches nested forms such as &amp;#32; without allowing
  // deliberately recursive input to consume unbounded work.
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded
      .replace(/&#(?:x([\da-f]+)|(\d+));?/giu, (reference, hexadecimal, decimal) => {
        const codePoint = Number.parseInt(hexadecimal || decimal, hexadecimal ? 16 : 10);
        if (!Number.isSafeInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return reference;
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return reference;
        }
      })
      .replace(/&([a-z]+);?/giu, (reference, name) => (
        NAMED_CHARACTER_REFERENCES.get(name.toLocaleLowerCase('en-US')) ?? reference
      ));
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

const STRING_LITERAL_PATTERN = String.raw`(?:'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|\x60(?:\\[\s\S]|[^\x60\\])*\x60)`;
const CHAIN_SEPARATOR_PATTERN = String.raw`(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*\+(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*`;
const STRING_LITERAL_CHAIN = new RegExp(`(${STRING_LITERAL_PATTERN})(?:${CHAIN_SEPARATOR_PATTERN}(${STRING_LITERAL_PATTERN}))+`, 'gu');
const STRING_LITERAL = new RegExp(STRING_LITERAL_PATTERN, 'gu');

function decodeJavascriptStringBody(literal) {
  if (literal.startsWith('`') && literal.includes('${')) return null;
  const body = literal.slice(1, -1);
  return body.replace(/\\(?:u\{([\da-f]+)\}|u([\da-f]{4})|x([\da-f]{2})|([nrtbfv0\\'"`]))/giu,
    (escape, unicodeLong, unicodeShort, hexadecimal, simple) => {
      const encoded = unicodeLong || unicodeShort || hexadecimal;
      if (encoded) {
        const codePoint = Number.parseInt(encoded, 16);
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return escape;
        }
      }
      return ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' })[simple] ?? simple;
    });
}

/** Join only actual adjacent JavaScript string literals, never arbitrary tokens. */
export function collapseLiteralChains(source) {
  return String(source).replace(STRING_LITERAL_CHAIN, (chain) => {
    const values = [...chain.matchAll(STRING_LITERAL)]
      .map(([literal]) => decodeJavascriptStringBody(literal));
    if (!values.length || values.some((value) => value === null)) return chain;
    return `"${values.join('').replaceAll('"', '\\"')}"`;
  });
}

/** Decode escapes in every non-interpolated JavaScript string literal. */
export function decodeJavascriptLiterals(source) {
  return String(source).replace(STRING_LITERAL, (literal) => {
    const decoded = decodeJavascriptStringBody(literal);
    return decoded === null ? literal : ` ${decoded} `;
  });
}

/**
 * Normalize a complete file before matching. In particular, whitespace,
 * hyphens and underscores become one separator, so wrapping a phrase over a
 * line or spelling it as a code-style identifier cannot evade the policy.
 */
export function normalizePolicyText(text) {
  return decodeCharacterReferences(text)
    .normalize('NFKC')
    .replace(/([\p{Ll}\d])([\p{Lu}])/gu, '$1 $2')
    .toLocaleLowerCase('en-US')
    .replace(/[\u2018\u2019]/gu, "'")
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim();
}

function policyTextViews(source) {
  const text = decodeCharacterReferences(source);
  const collapsedLiterals = collapseLiteralChains(text);
  const decodedLiterals = decodeJavascriptLiterals(text);
  return [
    normalizePolicyText(text),
    normalizePolicyText(text.replace(/['"`]/gu, ' ')),
    // A phrase split across JSX/HTML nodes must read as adjacent user copy,
    // while the raw view above still preserves phrases inside attributes.
    normalizePolicyText(text.replace(/<[^>]*>/gu, ' ')),
    normalizePolicyText(collapsedLiterals.replace(/['"`]/gu, ' ')),
    normalizePolicyText(decodedLiterals),
  ];
}

function scrubberRange(source) {
  const marker = source.includes('export const LEGACY_ATTESTATION_FIELDS = [')
    ? 'export const LEGACY_ATTESTATION_FIELDS = ['
    : 'const RETIRED_REVIEW_FIELDS = new Set([';
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const terminator = marker.includes('new Set') ? ']);' : '];';
  const end = source.indexOf(terminator, start);
  if (end < 0 || !/delete\s+data\[(?:key|field)\]/u.test(source)) return null;
  return { start, end: end + terminator.length };
}

function isCleanupOnlyRetiredOccurrence(path, source, match) {
  if (path !== RETIRED_FIELD_SCRUBBER_PATH) return false;
  const range = scrubberRange(source);
  if (range && match.index >= range.start && match.index < range.end) return true;

  // The one retired lifecycle value is accepted only in the explicit rewrite
  // from that value to a normal private draft.
  if (match[0].toLowerCase() === 'needs_review') {
    const lineStart = source.lastIndexOf('\n', match.index) + 1;
    const lineEnd = source.indexOf('\n', match.index);
    const line = source.slice(lineStart, lineEnd < 0 ? source.length : lineEnd);
    return /data\.status\s*===\s*['"]needs_review['"]\s*\)\s*data\.status\s*=\s*['"]draft['"]/u.test(line);
  }
  return false;
}

export function findReleaseLanguageViolations(path, source) {
  if (POLICY_IMPLEMENTATION_PATHS.has(path)) return [];

  const text = String(source);
  const violations = [];
  const retiredMatches = [...text.matchAll(RETIRED_FIELD)];
  for (const match of retiredMatches) {
    if (!isCleanupOnlyRetiredOccurrence(path, text, match)) {
      violations.push({
        path,
        rule: 'retired-attestation-field',
        excerpt: match[0],
      });
    }
  }

  // Cleanup-only exact occurrences do not become natural-language matches;
  // every spelling variant elsewhere remains subject to all normalized views.
  const naturalSource = text.replace(RETIRED_FIELD, (field, offset) => {
    const syntheticMatch = { 0: field, index: offset };
    return isCleanupOnlyRetiredOccurrence(path, text, syntheticMatch)
      ? ' retired migration key '
      : field;
  });
  for (const normalized of policyTextViews(naturalSource)) {
    for (const [rule, pattern] of NORMALIZED_RULES) {
      const match = normalized.match(pattern);
      if (!match) continue;
      violations.push({
        path,
        rule,
        excerpt: normalized.slice(Math.max(0, match.index - 32), match.index + match[0].length + 32),
      });
    }
  }

  for (const [rule, pattern] of RAW_RULES) {
    const match = text.match(pattern);
    if (match) violations.push({ path, rule, excerpt: match[0] });
  }

  return violations.filter((violation, index, all) => all.findIndex((candidate) => (
    candidate.path === violation.path
    && candidate.rule === violation.rule
    && candidate.excerpt === violation.excerpt
  )) === index);
}

function indexedFiles(cwd) {
  return execFileSync('git', ['ls-files', '--stage', '-z'], { cwd })
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^[0-7]+ ([\da-f]{40,64}) 0\t([\s\S]+)$/u);
      return match ? { path: match[2], blobSha: match[1] } : null;
    })
    .filter(Boolean);
}

export function scanTrackedFiles({ cwd = process.cwd(), trackedFiles } = {}) {
  const entries = trackedFiles
    ? trackedFiles.map((path) => ({ path, blobSha: null }))
    : indexedFiles(cwd);

  const violations = [];
  for (const { path, blobSha } of entries) {
    const sources = [];
    if (blobSha) {
      try {
        sources.push(execFileSync('git', ['cat-file', 'blob', blobSha], { cwd }));
      } catch {
        // A concurrently replaced index entry can disappear; the worktree
        // read below still examines the present file.
      }
    }
    try {
      const present = readFileSync(resolve(cwd, path));
      if (!sources.some((data) => data.equals(present))) sources.push(present);
    } catch {
      // An unstaged deletion remains covered by the indexed blob above.
    }
    for (const data of sources) {
      if (data.includes(0)) continue;
      violations.push(...findReleaseLanguageViolations(path, data.toString('utf8')));
    }
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
