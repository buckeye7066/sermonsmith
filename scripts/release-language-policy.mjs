import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodeHTML } from 'entities';

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

/** Decode the character references browsers render before a user sees copy. */
export function decodeCharacterReferences(value) {
  let decoded = String(value);
  // A bounded repeat catches nested forms such as &amp;#32; without allowing
  // deliberately recursive input to consume unbounded work.
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decodeHTML(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

const STRING_LITERAL_PATTERN = String.raw`(?:'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|\x60(?:\\[\s\S]|[^\x60\\])*\x60)`;
const LINE_COMMENT_PATTERN = String.raw`\/\/[^\n\r\u2028\u2029]*(?:\r\n|[\n\r\u2028\u2029]|$)`;
const CHAIN_SEPARATOR_PATTERN = String.raw`(?:\s|\/\*[\s\S]*?\*\/|${LINE_COMMENT_PATTERN})*\+(?:\s|\/\*[\s\S]*?\*\/|${LINE_COMMENT_PATTERN})*`;
const STRING_LITERAL_CHAIN = new RegExp(`(${STRING_LITERAL_PATTERN})(?:${CHAIN_SEPARATOR_PATTERN}(${STRING_LITERAL_PATTERN}))+`, 'gu');
const STRING_LITERAL = new RegExp(STRING_LITERAL_PATTERN, 'gu');
const EXACT_STRING_LITERAL = new RegExp(`^${STRING_LITERAL_PATTERN}$`, 'u');

function decodedCodePoint(encoded) {
  const codePoint = Number.parseInt(encoded, 16);
  if (!Number.isSafeInteger(codePoint) || codePoint > 0x10ffff) return null;
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return null;
  }
}

// Decode one JavaScript string body with a small scanner rather than a regex.
// Consuming escapes from left to right preserves backslash parity: an escaped
// backslash remains a visible separator and can never expose a second escape.
function decodeJavascriptEscapes(body) {
  let decoded = '';
  for (let index = 0; index < body.length;) {
    if (body[index] !== '\\') {
      decoded += body[index];
      index += 1;
      continue;
    }

    const next = body[index + 1];
    if (next === undefined) {
      decoded += '\\';
      break;
    }
    if (next === '\r' && body[index + 2] === '\n') {
      index += 3;
      continue;
    }
    if (next === '\n' || next === '\r' || next === '\u2028' || next === '\u2029') {
      index += 2;
      continue;
    }

    if (next === 'u' && body[index + 2] === '{') {
      const close = body.indexOf('}', index + 3);
      const encoded = close < 0 ? '' : body.slice(index + 3, close);
      const value = /^[\da-f]+$/iu.test(encoded) ? decodedCodePoint(encoded) : null;
      if (value !== null) {
        decoded += value;
        index = close + 1;
        continue;
      }
    } else if (next === 'u') {
      const encoded = body.slice(index + 2, index + 6);
      const value = /^[\da-f]{4}$/iu.test(encoded) ? decodedCodePoint(encoded) : null;
      if (value !== null) {
        decoded += value;
        index += 6;
        continue;
      }
    } else if (next === 'x') {
      const encoded = body.slice(index + 2, index + 4);
      const value = /^[\da-f]{2}$/iu.test(encoded) ? decodedCodePoint(encoded) : null;
      if (value !== null) {
        decoded += value;
        index += 4;
        continue;
      }
    }

    // Classic scripts still accept Annex B octal escapes. Decode their exact
    // runtime value so legacy source cannot hide visible release copy.
    if (/^[0-7]$/u.test(next)) {
      const maxDigits = next <= '3' ? 3 : 2;
      let encoded = next;
      while (encoded.length < maxDigits && /^[0-7]$/u.test(body[index + 1 + encoded.length] || '')) {
        encoded += body[index + 1 + encoded.length];
      }
      decoded += String.fromCharCode(Number.parseInt(encoded, 8));
      index += encoded.length + 1;
      continue;
    }

    const simple = ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v' })[next];
    // Quotes, backticks, backslashes, and legacy identity escapes all evaluate
    // to the escaped character. The left-to-right scanner makes this safe for
    // even backslashes: \\\\ becomes one literal backslash, not an escape for
    // the character that follows it.
    decoded += simple ?? next;
    index += 2;
  }
  return decoded;
}

function templateExpressionEnd(body, start) {
  let depth = 0;
  let quote = '';
  for (let index = start; index < body.length; index += 1) {
    const character = body[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}' && depth > 0) {
      depth -= 1;
    } else if (character === '}') {
      return index;
    }
  }
  return -1;
}

function trimExpressionComments(expression) {
  return expression
    .replace(/^\s*(?:\/\*[\s\S]*?\*\/\s*)*/u, '')
    .replace(/(?:\s*\/\*[\s\S]*?\*\/)*\s*$/u, '');
}

function decodeConstantTemplate(literal) {
  const body = literal.slice(1, -1);
  let decoded = '';
  let raw = '';
  for (let index = 0; index < body.length;) {
    if (body[index] === '\\') {
      raw += body[index];
      if (body[index + 1] === '\r' && body[index + 2] === '\n') {
        raw += '\r\n';
        index += 3;
      } else if (body[index + 1] !== undefined) {
        raw += body[index + 1];
        index += 2;
      } else {
        index += 1;
      }
      continue;
    }
    if (body[index] !== '$' || body[index + 1] !== '{') {
      raw += body[index];
      index += 1;
      continue;
    }

    const end = templateExpressionEnd(body, index + 2);
    if (end < 0) return null;
    const expression = trimExpressionComments(body.slice(index + 2, end));
    if (!EXACT_STRING_LITERAL.test(expression)) return null;
    const value = decodeJavascriptStringBody(expression);
    if (value === null) return null;
    decoded += decodeJavascriptEscapes(raw) + value;
    raw = '';
    index = end + 1;
  }
  return decoded + decodeJavascriptEscapes(raw);
}

function decodeJavascriptStringBody(literal) {
  return literal.startsWith('`') && literal.includes('${')
    ? decodeConstantTemplate(literal)
    : decodeJavascriptEscapes(literal.slice(1, -1));
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
    // Default-ignorable characters and variation selectors render with no
    // separating glyph, so remove them rather than turning them into spaces.
    .replace(/[\p{Default_Ignorable_Code_Point}\uFE00-\uFE0F\u{E0100}-\u{E01EF}]+/gu, '')
    .replace(/([\p{Ll}\d])([\p{Lu}])/gu, '$1 $2')
    .toLocaleLowerCase('en-US')
    .replace(/[\u2018\u2019]/gu, "'")
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim();
}

function renderedMarkupView(text, separator = ' ') {
  return String(text)
    // These element bodies do not contribute visible page text. Removing the
    // whole body also reconnects visible siblings on either side.
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, separator)
    .replace(/<!--[\s\S]*?-->/gu, separator)
    .replace(/\{\/\*[\s\S]*?\*\/\}/gu, separator)
    .replace(/<[^>]*>/gu, separator);
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
    normalizePolicyText(renderedMarkupView(text)),
    // Inline elements have no implicit separator in rendered text. Keep a
    // compact reconstruction as well as the conservative spaced view above.
    normalizePolicyText(renderedMarkupView(text, '')),
    normalizePolicyText(collapsedLiterals.replace(/['"`]/gu, ' ')),
    normalizePolicyText(decodedLiterals),
  ];
}

function scrubberRange(source) {
  const legacyArray = source.includes('export const LEGACY_ATTESTATION_FIELDS = [');
  const marker = legacyArray
    ? 'export const LEGACY_ATTESTATION_FIELDS = ['
    : 'const RETIRED_REVIEW_FIELDS = new Set([';
  const identifier = legacyArray ? 'LEGACY_ATTESTATION_FIELDS' : 'RETIRED_REVIEW_FIELDS';
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const terminator = marker.includes('new Set') ? ']);' : '];';
  const end = source.indexOf(terminator, start);
  const cleanupLoop = new RegExp(
    `for\\s*\\(\\s*const\\s+(key|field)\\s+of\\s+${identifier}\\s*\\)\\s*delete\\s+data\\[\\s*\\1\\s*\\]`,
    'u',
  );
  if (end < 0 || !cleanupLoop.test(source)) return null;
  return {
    start,
    listStart: start + marker.lastIndexOf('['),
    end: end + terminator.length,
  };
}

function squareBracketDepth(source, start, end) {
  let depth = 0;
  let quote = '';
  let lineComment = false;
  let blockComment = false;
  for (let index = start; index < end; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === '\n' || character === '\r' || character === '\u2028' || character === '\u2029') {
        lineComment = false;
      }
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '/' && next === '/') {
      lineComment = true;
      index += 1;
    } else if (character === '/' && next === '*') {
      blockComment = true;
      index += 1;
    } else if (character === "'" || character === '"' || character === '`') {
      quote = character;
    } else if (character === '[') {
      depth += 1;
    } else if (character === ']') {
      depth -= 1;
    }
  }
  return depth;
}

function isExactScrubberListMember(source, match, range) {
  if (!range || match.index < range.start || match.index >= range.end) return false;
  const quote = source[match.index - 1];
  if ((quote !== "'" && quote !== '"') || source[match.index + match[0].length] !== quote) return false;
  const before = source.slice(range.start, match.index - 1).trimEnd().at(-1);
  const after = source.slice(match.index + match[0].length + 1, range.end).trimStart()[0];
  return squareBracketDepth(source, range.listStart, match.index - 1) === 1
    && (before === '[' || before === ',')
    && (after === ',' || after === ']');
}

function isCleanupOnlyRetiredOccurrence(path, source, match) {
  if (path !== RETIRED_FIELD_SCRUBBER_PATH) return false;
  const range = scrubberRange(source);
  if (isExactScrubberListMember(source, match, range)) return true;

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
  // Remove only exact raw cleanup literals before constructing executable
  // views. Encoded spellings are deliberately not eligible for the exception.
  const naturalSource = text.replace(RETIRED_FIELD, (field, offset) => {
    const syntheticMatch = { 0: field, index: offset };
    return isCleanupOnlyRetiredOccurrence(path, text, syntheticMatch)
      ? ' retired migration key '
      : field;
  });
  const decodedReferences = decodeCharacterReferences(naturalSource);
  const retiredViews = [
    naturalSource,
    decodedReferences,
    collapseLiteralChains(decodedReferences),
    decodeJavascriptLiterals(decodedReferences),
  ];
  for (const retiredView of retiredViews) {
    for (const match of retiredView.matchAll(RETIRED_FIELD)) {
      violations.push({
        path,
        rule: 'retired-attestation-field',
        excerpt: match[0],
      });
    }
  }

  // Cleanup-only exact occurrences do not become natural-language matches;
  // every spelling variant elsewhere remains subject to all normalized views.
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
