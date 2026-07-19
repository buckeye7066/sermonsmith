/**
 * Canonical, canon-aware Scripture reference validator.
 *
 * This is THE single source of truth for reference validation across
 * SermonSmith. The web app re-exports it via `apps/web/src/lib/scriptureRefs.js`
 * and the API imports it directly, so client and server can never drift.
 *
 * The LLM prompts tell Larry and Arlynn not to invent verses, but the
 * server cannot guarantee the model obeys. For a sermon / Bible study
 * app, hallucinated references erode trust quickly — so AI-generated
 * content is run through this validator before being shown or saved.
 *
 * Canon awareness: SermonSmith serves Protestant, Catholic, and Orthodox
 * ministers. A Catholic citation of Wisdom 3:1 is real Scripture in that
 * tradition and must NOT be reported as a fabricated book — but we also
 * must not pretend we verified its verse numbers when we carry no
 * versification table for it. The status vocabulary keeps those states
 * distinct:
 *
 *   - 'valid'             book + chapter + verse (and range end) all verified
 *   - 'chapter_checked'   book + chapter verified for the selected canon, but
 *                         we have no versification table for the verse level
 *                         (deuterocanon / Greek Daniel) — needs source review
 *   - 'unsupported_canon' a real book in another Christian canon that is not
 *                         part of the selected validation canon
 *   - 'out_of_range'      chapter, verse, or range end-point out of range
 *                         (also reversed ranges like John 3:20-16)
 *   - 'invalid_book'      not a book in any canon we know
 *   - 'unparseable'       book recognized but chapter:verse could not be read
 *
 * Deuterocanon scope note: we include the Catholic deuterocanon (Tobit,
 * Judith, Wisdom, Sirach, Baruch, 1-2 Maccabees) plus Greek Daniel 13-14.
 * Chapter counts are standard across Catholic editions. We deliberately do
 * NOT carry verse-level tables for these books (versification varies across
 * editions) and we do NOT extend Esther (the Greek additions use lettered /
 * Vulgate-specific chapter numbering that plain "Esther N:V" citations
 * cannot address unambiguously). Orthodox-only books (1 Esdras, 3-4
 * Maccabees, Prayer of Manasseh, Psalm 151) are not yet registered; they
 * will be added when a translation source in the registry can actually
 * supply them.
 *
 * Exports:
 *   - CANONS
 *   - extractScriptureRefs(text) -> string[]
 *   - extractScriptureRefsDeep(obj) -> string[]   (recursive, shape-agnostic)
 *   - validateScriptureRefs(refs, { canon }) ->
 *       Array<{ ref, validBook, chapter, verse, verseEnd, status, canon }>
 *   - validateAiSermon(sermon, { canon }) -> { refs, allValid, summary, counts }
 *   - validateAiContent(content, { canon }) -> { refs, allValid, summary, counts }
 *       (same shape as validateAiSermon, for any persisted AI content type)
 *   - re-exports VERSE_COUNTS / versesInChapter / chaptersInBook
 */

import { versesInChapter } from './bibleVerseCounts.js';

export { VERSE_COUNTS, versesInChapter, chaptersInBook } from './bibleVerseCounts.js';

export const CANONS = ['protestant', 'catholic', 'orthodox'];

const BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Psalm',
  'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Song of Songs',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
  'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
  'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts',
  'Romans', '1 Corinthians', '2 Corinthians', 'Galatians',
  'Ephesians', 'Philippians', 'Colossians',
  '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
  'Jude', 'Revelation',
];

const BOOK_LOOKUP = new Set(BOOKS.map((b) => b.toLowerCase()));

// Canonical chapter counts (Protestant 66-book canon). Used to range-check the
// chapter number of an extracted reference. Aliases (Psalm/Psalms, Song of
// Solomon/Song of Songs) map to the same count.
const CHAPTER_COUNTS = {
  genesis: 50, exodus: 40, leviticus: 27, numbers: 36, deuteronomy: 34,
  joshua: 24, judges: 21, ruth: 4, '1 samuel': 31, '2 samuel': 24,
  '1 kings': 22, '2 kings': 25, '1 chronicles': 29, '2 chronicles': 36,
  ezra: 10, nehemiah: 13, esther: 10, job: 42, psalms: 150, psalm: 150,
  proverbs: 31, ecclesiastes: 12, 'song of solomon': 8, 'song of songs': 8,
  isaiah: 66, jeremiah: 52, lamentations: 5, ezekiel: 48, daniel: 12,
  hosea: 14, joel: 3, amos: 9, obadiah: 1, jonah: 4, micah: 7,
  nahum: 3, habakkuk: 3, zephaniah: 3, haggai: 2, zechariah: 14, malachi: 4,
  matthew: 28, mark: 16, luke: 24, john: 21, acts: 28,
  romans: 16, '1 corinthians': 16, '2 corinthians': 13, galatians: 6,
  ephesians: 6, philippians: 4, colossians: 4,
  '1 thessalonians': 5, '2 thessalonians': 3, '1 timothy': 6, '2 timothy': 4,
  titus: 3, philemon: 1, hebrews: 13, james: 5,
  '1 peter': 5, '2 peter': 3, '1 john': 5, '2 john': 1, '3 john': 1,
  jude: 1, revelation: 22,
};

// Catholic deuterocanon, keyed by every accepted alias (lower-cased). Chapter
// counts are stable across Catholic editions; verse-level counts are NOT
// carried (versification varies), so these books validate to
// 'chapter_checked' rather than 'valid'.
const DEUTERO_CHAPTER_COUNTS = {
  tobit: 14,
  judith: 16,
  wisdom: 19, 'wisdom of solomon': 19,
  sirach: 51, ecclesiasticus: 51,
  baruch: 6,
  '1 maccabees': 16,
  '2 maccabees': 15,
};

// Books whose chapter range extends beyond the Protestant count in the
// Catholic/Orthodox canons (Greek Daniel: 13 Susanna, 14 Bel and the Dragon).
const CANON_EXTRA_CHAPTERS = {
  daniel: { catholic: 14, orthodox: 14 },
};

// Longest chapter in the Bible is Psalm 119 with 176 verses. Fallback ceiling
// only, for core books whose exact per-chapter count is somehow unavailable.
const MAX_VERSE = 176;

// ---------------------------------------------------------------------------
// Citation extraction — normalization + variant-tolerant parsing.
//
// A single tight regex is not enough: an AI naturally produces citations in many
// FORMS, and each form that the extractor misses is a total gate bypass (every
// consumer — validateAiSermon, validateAiContent, assertAiReplyExposable,
// screenStreamedScripture — sees "zero references → all valid"). We therefore:
//   1. normalize unicode spaces / fullwidth digits / colon + dash variants to
//      ASCII (so "Ｈｅｚ ４：５" / non-breaking spaces don't evade the matcher);
//   2. match a permissive citation shape that allows a numeric/roman/worded
//      prefix, an abbreviated book (with or without a trailing period), an
//      optional "of X" clause, and flexible whitespace AROUND the colon;
//   3. canonicalize each match (prefix → 1/2/3 BOUND to the book, abbreviation →
//      full book) into a clean "Book C:V[-V]" string that validateScriptureRefs
//      already understands — so `II John 1:20` validates as 2 John (v20 fails,
//      not silently attributed to John), `Hez. 4:5` / `hezekiah 4 : 5` are
//      caught as fabricated, and `Gen. 1:1` / `1 Cor 13:4` / `II Tim 1:7`
//      validate correctly.
// A looksLikeReference guard still drops ordinary prose (times/ratios/scores)
// so the tolerant matcher does not over-match.
// ---------------------------------------------------------------------------

// Invisible / zero-width / format / control code points a model can splice INTO
// a citation to break the reference regex, EXCLUDING real whitespace
// (tab/newline/CR, which must survive as separators). Covers \p{Cc} (C0/C1/DEL),
// \p{Cf} (ZWSP/ZWNJ/ZWJ/word-joiner/BOM/soft-hyphen) and
// \p{Default_Ignorable_Code_Point} (variation selectors, CGJ, Mongolian FVS,
// Hangul fillers, …). In the NORMAL pass these are replaced GLOBALLY with a
// space (below) so a numeral-prefix↔book seam like "II​John" still reads as two
// tokens ("II John" → 2 John) and no accented word is mangled. The aggressive
// POSITION-AWARE handling that DELETES an invisible inside a letter run
// ("Joh​n" → "John") or a digit run ("3:9​9" → "3:99") lives only in the
// book-shape-gated detection shadow (markStrippedText), where a fused non-book
// like "IIJohn" is simply dropped rather than turned into a false positive.
const ZERO_WIDTH = '(?:(?![\\t\\n\\r])[\\p{Cc}\\p{Cf}\\p{Default_Ignorable_Code_Point}])';
// Combined invisible-or-combining-mark class for the detection shadow's
// position-aware pass (boundary → space; inside a letter/digit run → delete).
const SHADOW_HIDDEN = `(?:${ZERO_WIDTH}|\\p{M})`;
const SHADOW_AT_BOOK_CHAPTER = new RegExp(`(?<=\\p{L})${SHADOW_HIDDEN}+(?=\\p{Nd})`, 'gu');
const SHADOW_AT_CHAPTER_BOOK = new RegExp(`(?<=\\p{Nd})${SHADOW_HIDDEN}+(?=\\p{L})`, 'gu');
const SHADOW_HIDDEN_ANY = new RegExp(`${SHADOW_HIDDEN}+`, 'gu');
// The CONTEXT seam class — a single char class used ONLY inside the two BOUNDED
// context-scrubs (ordinal digit↔suffix, decimal-digit↔superscript). It must be a
// TRUE SUPERSET of everything the tokenizer treats as a separator, so no seam can
// survive the scrub and then be collapsed into a token separator downstream:
//   • CITATION_RE separators = JS `\s` (the `u` flag does NOT change `\s`): TAB,
//     LF, VT, FF, CR, SPACE, NBSP, all \p{Zs}, LS (U+2028), PS (U+2029), BOM.
//   • normalizeCitationText collapses every \p{Cc}, \p{Cf}, \p{Default_Ignorable}
//     and Unicode separator to a space.
// CONTEXT_SEAM = \p{Cc} (ALL C0/C1 controls incl. TAB/LF/CR/VT/FF + NEL — NOT
// excluded here, unlike the global hidden class, because inside these bounded
// digit↔suffix / digit↔superscript patterns a control IS a seam) + \p{Cf}
// + \p{Default_Ignorable_Code_Point} (variation selectors + tag chars) + \p{M}
// + \p{Zs} + \p{Zl} + \p{Zp}. By construction this ⊇ JS `\s` (proven by the
// superset guard test) — closing the seam class BY CONSTRUCTION, not one char at
// a time. It ALSO matches a LITERAL JSON-STYLE ESCAPE for a whitespace/control
// char (one or more backslashes + n/r/t/v/f/b/0 or a \x../\u.... control form) —
// a model can DOUBLE-escape a citation ({"text":"4\\nth John"} → after one
// JSON.parse the value still holds a literal backslash+n), and that literal
// escape survives into the parsed value and would otherwise split the token. It
// is contextual: only between two citation tokens (digit↔ordinal-suffix,
// decimal-digit↔SUPERSCRIPT), never a general inter-word separator and never a
// legitimate literal backslash in prose. The superscript scrub additionally
// requires a SUPERSCRIPT digit after the seam, so a newline between two real refs
// ("…3:16\nMark 1:1") is untouched, and a bare numeric with no st/nd/rd/th suffix
// ("2\tJohn") is not an ordinal → the r30 outline and multi-line refs preserved.
// The seam CHAR class (real codepoints) — single source of truth for membership.
const SEAM_CHARS = '\\p{Cc}\\p{Cf}\\p{Default_Ignorable_Code_Point}\\p{M}\\p{Zs}\\p{Zl}\\p{Zp}';
const SEAM_CHAR_RE = new RegExp(`^[${SEAM_CHARS}]$`, 'u');
// ESCAPE_SEAM matches a GENERIC backslash-escape token (one+ backslashes then a
// JSON-style escape: \uXXXX, \xXX, or a single letter/digit like \n). It does NOT
// itself decide seam-hood — the scrub's replace function DECODES the token and
// keeps it as a seam ONLY when the decoded codepoint ∈ the seam char set (see
// escapeDecodesToSeam). So the escaped-seam coverage is BY CONSTRUCTION against
// SEAM_CHARS: adding a codepoint to the seam set automatically covers its escaped
// form, and a non-seam escape (A = "A") is NEVER treated as a seam.
// An escape token is a run of backslashes then one JSON-style escape FORM:
//   \u{HHHHHH}  ES6 code-point escape (1..6 hex; astral codepoints)
//   \uHHHH      a single UTF-16 code UNIT (a surrogate HALF for astral chars)
//   \xHH        a byte
//   \<char>     a named/simple escape (\n \t …) or a literal letter/digit
// The forms are ordered longest-first so \u{…} wins over \uHHHH.
const ESCAPE_SEAM = '\\\\+(?:u\\{[0-9a-fA-F]{1,6}\\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[a-zA-Z0-9])';
// A LONE surrogate code UNIT (U+D800–DFFF). Under the `u` flag this range matches
// ONLY an UNPAIRED surrogate in the subject — a valid astral char is read as its
// combined codepoint (never as halves). Adding it to the seam-run class lets a
// LITERAL surrogate half be CAPTURED into the run so it can recombine, in the
// decode-then-check, with an ESCAPED half of the other representation. This is the
// structural close for the whole surrogate-REPRESENTATION class: real-codepoint,
// escaped-BMP, escaped-pair, and MIXED literal/escaped halves (either order) all
// decode to the SAME codepoint and hit the SAME seam test — no representation is
// special. A genuinely lone surrogate stays non-seam (seamRunIsAllSeam rejects it).
const LONE_SURROGATE = '\\uD800-\\uDFFF';
const CONTEXT_SEAM = `(?:[${SEAM_CHARS}${LONE_SURROGATE}]|${ESCAPE_SEAM})`;
const NAMED_ESCAPE_CP = { n: 0x0A, r: 0x0D, t: 0x09, v: 0x0B, f: 0x0C, b: 0x08, 0: 0x00 };
// Decode ONE escape token to the raw string fragment it represents: a single
// UTF-16 code unit for \uHHHH (which may be a lone surrogate half), or a full
// codepoint for \u{…}/\xHH/named. Returns null for an unknown/malformed form
// (e.g. \A, \5, or \u{110000}) — such a token is NOT a seam.
function escapeToChars(esc) {
  const body = esc.replace(/^\\+/, '');
  const brace = /^u\{([0-9a-fA-F]{1,6})\}$/.exec(body);
  if (brace) {
    const cp = parseInt(brace[1], 16);
    if (cp > 0x10FFFF) return null; // out of Unicode range → not a seam (no throw)
    return String.fromCodePoint(cp);
  }
  if (/^u[0-9a-fA-F]{4}$/.test(body)) return String.fromCharCode(parseInt(body.slice(1), 16)); // 16-bit unit; may be a surrogate half
  if (/^x[0-9a-fA-F]{2}$/.test(body)) return String.fromCharCode(parseInt(body.slice(1), 16));
  if (body.length === 1 && Object.prototype.hasOwnProperty.call(NAMED_ESCAPE_CP, body)) return String.fromCharCode(NAMED_ESCAPE_CP[body]);
  return null; // \A / \5 → a literal letter/digit, NOT a control
}
const ESCAPE_TOKEN_RE = new RegExp(ESCAPE_SEAM, 'gu');
// Is a captured seam RUN entirely seam? The run may contain real SEAM_CHARS
// chars, LITERAL surrogate code units (captured via LONE_SURROGATE), and escape
// tokens. We DECODE the run in place — each escape token → the char(s) it stands
// for (a single UTF-16 unit for \uHHHH, which may itself be a surrogate half),
// real chars kept as-is — then iterate the decoded string BY CODEPOINT, so a
// truly-adjacent surrogate PAIR (high U+D800-DBFF then low U+DC00-DFFF)
// recombines into its one supplementary codepoint BEFORE the seam-membership test
// REGARDLESS of whether each half came from an escape or a literal. So an astral
// seam char (U+E0100 variation selector, U+E0000 tag, …) written literally,
// fully-escaped, or as MIXED literal/escaped halves (either order) all decode to
// the same codepoint and hit the same test; a non-seam codepoint (emoji
// \u{1F600}, "A"), a lone/unpaired surrogate, or a malformed escape is NOT a
// seam. Never throws.
function seamRunIsAllSeam(run) {
  let bad = false;
  const decoded = run.replace(ESCAPE_TOKEN_RE, (esc) => {
    const frag = escapeToChars(esc);
    if (frag == null) { bad = true; return ''; }
    return frag;
  });
  if (bad) return false;
  for (const ch of decoded) {
    if (ch.length === 1) {
      const u = ch.charCodeAt(0);
      if (u >= 0xD800 && u <= 0xDFFF) return false; // lone surrogate → not a valid codepoint
    }
    if (!SEAM_CHAR_RE.test(ch)) return false;
  }
  return true;
}

// ONE citation-shaped seam decoder. Instead of teaching each seam POSITION (digit↔
// suffix, digit↔superscript, suffix↔book, book↔chapter, chapter↔verse, …) to see
// through escapes — always one behind — a single pre-pass canonicalizes seams
// UNIFORMLY across EVERY representation, scoped to CITATION-CANDIDATE spans. A
// candidate seam is one at an INTERNAL position of a citation shape: either BETWEEN
// TWO WORD CHARACTERS (`\p{L}`/`\p{Nd}` — book↔number, prefix/ordinal↔book, digit↔
// suffix), OR inside a NUMBER↔delimiter↔NUMBER span around the chapter:verse ':'
// and range '-' (the positions CITATION_RE puts `\s*` around). Within such a run,
// ALL escape representations are decoded via the
// SAME by-construction decode-then-check as `seamRunIsAllSeam`: real seam
// codepoints, EXPLICIT code-point escapes (\uXXXX / \u{…} / \xHH, incl. surrogate
// pairs and MIXED literal/escaped halves, both orders), AND short NAMED escapes
// (\n \r \t \v \f \b \0). When every decoded codepoint is a seam, the run is
// REPLACED with the real codepoint(s); then the ordinary real-seam paths
// (normalizeCitationText Cf/Cc/Zs→space, the ordinal/superscript scrubs) handle
// every position uniformly — escaped == real at EVERY position, by construction.
//
// SCOPING gives prose-safety WITHOUT excluding named escapes (the r43 trade-off):
// an escape NOT between two word chars — a Windows path ("C:\name": the seam sits
// after ":", a non-word char), a standalone/edge escape, a regex/LaTeX literal not
// forming a book↔number shape — is NOT a candidate and is left untouched (no
// fabricated ref, no false-reject). Guards: a decoded NON-seam codepoint anywhere
// (A=A, \u{1F600}=emoji) leaves the run literal; a malformed / lone / reversed
// surrogate or \u{110000} is left as-is (non-seam) and never throws.
//
// DOCUMENTED RESIDUAL (r25 over-flag class): a fabricated/wrong book+chapter shape
// that appears INSIDE a code/JSON literal with an ESCAPED seam ({"x":"Hezekiah
// 4:5"}) IS a citation candidate (word↔word), so it is screened as a citation and
// over-flagged (invalid_book). This is the fail-safe direction and is REQUIRED for
// representation-consistency: a real space, a  , and a \n between the same
// book and chapter must all reach the same verdict — a screen cannot let the
// ENCODING of a seam decide whether a smuggled reference is checked. Shape cannot
// soundly tell a smuggled citation from a code-literal one, so the screen prefers
// to flag. Content whose escapes do NOT form a book↔number shape is unaffected.
// Decode ONE captured seam run: return the real seam codepoint(s) it denotes when
// EVERY decoded codepoint is a seam, else the run UNCHANGED. Escapes decode via the
// by-construction escapeToChars (surrogate pairs recombine when iterated by
// codepoint); a decoded non-seam codepoint, a lone/reversed surrogate, or a
// malformed escape leaves the run literal. Never throws.
function decodeSeamRun(run) {
  if (run.indexOf('\\') === -1) return run; // pure real-seam run → already real; downstream handles it
  let bad = false;
  const decoded = run.replace(ESCAPE_TOKEN_RE, (esc) => {
    const frag = escapeToChars(esc);
    if (frag == null) { bad = true; return esc; }
    return frag;
  });
  if (bad) return run;
  for (const ch of decoded) {
    if (ch.length === 1) {
      const u = ch.charCodeAt(0);
      if (u >= 0xD800 && u <= 0xDFFF) return run; // lone/unpaired surrogate → non-seam
    }
    if (!SEAM_CHAR_RE.test(ch)) return run; // any non-seam codepoint → run stays literal
  }
  return decoded;
}
// COMPLETE-BY-CONSTRUCTION seam coverage against the grammar. Auditing CITATION_RE
// and the compact/ordinal/abbreviation sub-grammars, these are EVERY internal
// position where they tolerate whitespace (`\s` / `\s*`) — a seam of ANY
// representation must reach the SAME verdict as a real space at each:
//   P1 prefix↔book         `(prefix)\s+book`            "4\nJohn"          → word↔word
//   P2 book-internal "of"  `\s+of\s+`                   "Song of\nSolomon" → word↔word
//   P3 book↔chapter        `book\s+NUM`                 "Hezekiah\n4:5"    → word↔word
//   P4 abbrev-dot↔chapter  `book\.?\s+NUM` (dotted)     "Gen.\n999:1"      → ABBREV-DOT pass
//   P5 chapter↔':'↔verse   `NUM\s*:\s*NUM`              "4\n:5" / "4:\n5"  → numeric span
//   P6 range↔'-'           `NUM\s*-\s*NUM`              "3:1\n-999"        → numeric span
//   P7 ordinal-sep↔stem    `\d+(st|nd|rd|th)\s*[.\-]?\s*stem` "4th.\nJohn" → ORDINAL-SEP pass
//   P8 digit↔suffix        ORD digits↔suffix            "4\nth John"       → word↔word (+ bounded scrub)
//   P9 suffix↔book         suffix↔stem                  "4th\nJohn"        → word↔word
//   P10 digit↔superscript  digit↔\p{No}                 "3:1\n⁶"           → bounded AMBIGUOUS_SUPERSCRIPT scrub
// decodeCitationSeams runs a scoped pass for each, all sharing the one
// by-construction decodeSeamRun. The grammar-derived parity test asserts P1–P10 ×
// every representation reach the real-space verdict — so a boundary CITATION_RE
// tolerates but a pass misses FAILS that test (the lock). Prose-safety: every pass
// is anchored to a citation shape (a number-delimited span, a book/abbrev/ordinal
// token adjacent to a number/stem), so a lone escaped seam in a path/regex/version/
// phone/non-citation literal is not a candidate and is left untouched.
const WORDISH = '[\\p{L}\\p{Nd}]';
const CITATION_SEAM_RUN_RE = new RegExp(`(?<=${WORDISH})(${CONTEXT_SEAM}+)(?=${WORDISH})`, 'gu');
// The chapter:verse and range delimiters, including the Unicode colon/dash variants
// normalizeCitationText later folds to ASCII ':' / '-'.
const CITE_DELIM = '(?::|-|[\\uFF1A\\u2236\\u02D0\\uA789\\u2010-\\u2015\\u2212\\uFF0D])';
// P5/P6 — a numeric citation span: a digit run joined to further digit runs by a
// chapter:verse / range delimiter, with seam runs (any representation) as the
// connective tissue. Anchored by an ACTUAL number-delimiter-number shape, so a
// lone escaped seam in prose/code (no numeric-delimited neighbours) is not matched.
const NUMERIC_CITATION_SPAN_RE = new RegExp(`\\p{Nd}+(?:${CONTEXT_SEAM}*${CITE_DELIM}${CONTEXT_SEAM}*\\p{Nd}+)+`, 'gu');
// P4 — abbreviation-dot↔chapter: a seam between a BOOK-SHAPED word + trailing '.'
// and a chapter DIGIT ("Gen.\n999:1", "Jn.\n4:5"). Anchored to two+ letters then a
// dot then a digit, so a sentence period before a non-number word ("Gen.\nThen")
// is NOT matched, and a digit-dot ("4.\n5") is NOT matched. Escaped==real (a real
// "book.\n number:number" already binds), so no NEW over-flag beyond the r44 class.
const ABBREV_DOT_SEAM_RE = new RegExp(`(?<=\\p{L}\\p{L}\\.)(${CONTEXT_SEAM}+)(?=\\p{Nd})`, 'gu');
// P7 — ordinal-suffix prefix ↔ book stem, across the optional '.'/'-' separator
// with surrounding whitespace ("4th.\nJohn", "4th\n-John"). Decode the seam runs in
// the connector, KEEPING the '.'/'-', so ORDINAL_NUMBERED_RE binds it like a real
// space. Anchored to `\d(st|nd|rd|th)` + a following letter, so it only fires on an
// ordinal-suffix → word shape.
const ORDINAL_SEP_SPAN_RE = new RegExp(`(\\d+(?:st|nd|rd|th))((?:${CONTEXT_SEAM}|[.\\-])+)(?=\\p{L})`, 'giu');
const SEAM_RUN_ONLY_RE = new RegExp(`${CONTEXT_SEAM}+`, 'gu');
function decodeCitationSeams(text) {
  let out = String(text);
  // P1/P2/P3/P8/P9 — WORD↔WORD seams (book↔number, prefix/ordinal↔book, "of",
  // digit↔suffix, digit↔digit).
  out = out.replace(CITATION_SEAM_RUN_RE, decodeSeamRun);
  // P4 — abbreviation-dot↔chapter.
  out = out.replace(ABBREV_DOT_SEAM_RE, decodeSeamRun);
  // P7 — ordinal-suffix separator: decode the seam runs in the connector, keep '.'/'-'.
  out = out.replace(ORDINAL_SEP_SPAN_RE, (m, g1, g2) => g1 + g2.replace(SEAM_RUN_ONLY_RE, decodeSeamRun));
  // P5/P6 — NUMBER↔':'/'-'↔NUMBER: within each numeric citation span, decode every
  // seam run, so a seam adjacent to ':' / '-' behaves identically to a real space.
  out = out.replace(NUMERIC_CITATION_SPAN_RE, (span) => span.replace(SEAM_RUN_ONLY_RE, decodeSeamRun));
  return out;
}

// Non-ASCII DECIMAL digits (Unicode \p{Nd}) render as ordinary numerals but do
// NOT match the matcher's ASCII `\d`, and NFKC does not fold most of them
// (Arabic-Indic, Devanagari, Kawi, Nag Mundari, …) to ASCII. A model can write a
// visibly out-of-range chapter/verse ("John 3:٣٧", "John ٩٩:١", "John 𑽓:𑽓𑽗")
// that extracts NO ref. We map EVERY decimal digit to its ASCII value with a
// COMPLETE, Unicode-version-agnostic rule instead of a hand-listed table: for a
// digit code point, walk down to the start of its contiguous \p{Nd} run
// (decimal-digit sets are always 10 contiguous code points encoding 0–9 in
// order) and take (codePoint − runStart) mod 10. The `mod 10` keeps it correct
// even for two script blocks encoded back-to-back. Memoized per code point.
const ND_ONE_RE = /\p{Nd}/u;
const DIGIT_VALUE_CACHE = new Map();
function decimalDigitToAscii(ch) {
  const cp = ch.codePointAt(0);
  if (cp >= 0x30 && cp <= 0x39) return ch; // ASCII 0-9 fast path
  let value = DIGIT_VALUE_CACHE.get(cp);
  if (value === undefined) {
    // Walk to the start of the MAXIMAL contiguous \p{Nd} run (NOT capped at 9 —
    // several styled decimal blocks are encoded back-to-back, e.g. the 50-wide
    // mathematical-digit run U+1D7CE–U+1D7FF). A decimal run is always a
    // concatenation of aligned 10-code-point script blocks, so the value is the
    // offset from the run start MOD 10 — correct even across adjacent blocks.
    // The previous 9-step cap stopped mid-run and derived a digit's value from a
    // NEIGHBOUR block (phantom "0:00" refs); walking to the true run start fixes it.
    let start = cp;
    while (start > 0 && ND_ONE_RE.test(String.fromCodePoint(start - 1))) {
      start -= 1;
    }
    value = String((cp - start) % 10);
    DIGIT_VALUE_CACHE.set(cp, value);
  }
  return value;
}

// EVERY Unicode ROMAN NUMERAL code point (U+2160–U+2188) → ASCII the matcher can
// consume, folded in EVERY pass (incl. the normal display pass) so a Unicode-
// Roman PREFIX ("Ⅳ John") is bound and consumed — otherwise the normal pass,
// which does not NFKC-fold, would emit a spurious bare "John 1:1". Only these
// dedicated numeral code points are folded (not general NFKC), so ordinary
// accents are untouched. U+2160–U+217F fold to ASCII roman via NFKC (Ⅳ→"IV",
// ⅱ→"ii"); the ARCHAIC / apostrophus forms U+2180–U+2188 (ↀ ↁ ↂ Ↄ ↄ ↅ ↆ ↇ ↈ)
// do NOT NFKC-fold to ASCII, so they are mapped EXPLICITLY to their decimal
// value — none is 1/2/3, so a numbered-book prefix built from them is a
// fabricated numbered book (invalid_book), and a chapter/verse is out_of_range.
const ROMAN_NUMERAL_FOLD = new Map();
for (let cp = 0x2160; cp <= 0x217F; cp += 1) {
  const ch = String.fromCodePoint(cp);
  const folded = ch.normalize('NFKC');
  if (/^[ivxlcdm]+$/i.test(folded)) ROMAN_NUMERAL_FOLD.set(ch, folded);
}
const ARCHAIC_ROMAN = {
  'ↀ': '1000', 'ↁ': '5000', 'ↂ': '10000', 'Ↄ': '100',
  'ↄ': '100', 'ↅ': '6', 'ↆ': '50', 'ↇ': '50000', 'ↈ': '100000',
};
for (const [ch, val] of Object.entries(ARCHAIC_ROMAN)) ROMAN_NUMERAL_FOLD.set(ch, val);
const ROMAN_NUMERAL_RE = /[Ⅰ-ↈ]/g;

// Superscript / compatibility ORDINAL characters → their ASCII form. Used ONLY
// by the BOUNDED ordinal-prefix normalization (ORDINAL_PREFIX_RE below), never
// globally: a global fold would corrupt FOOTNOTE markers adjacent to a citation
// ("John 3:16¹" → "John 3:161"; "John²:1" → minted "John 2:1"). Superscript
// digits are category No (not Nd), so decimalDigitToAscii does not catch them.
const SUPERSCRIPT_FOLD = {
  '¹': '1', '²': '2', '³': '3', '⁰': '0', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  'ˢ': 's', 'ᵗ': 't', 'ⁿ': 'n', 'ᵈ': 'd', 'ʳ': 'r', 'ʰ': 'h',
};

function normalizeCitationText(text) {
  return String(text)
    // NFC FIRST: recompose legit decomposed accents (e + U+0301 → é, a single
    // Letter), so ordinary accented prose ("café 4:5", "résumé 4:5") is NOT
    // treated as a hidden-mark split and wrongly turned into a fabricated
    // citation. An un-composable attack sequence (h + U+0300 has no precomposed
    // form) still leaves a standalone combining mark for the boundary rule below.
    .normalize('NFC')
    // Precomposed Unicode roman numerals → ASCII letters ("Ⅳ"→"IV"), so a
    // Unicode-Roman PREFIX is consumed by the matcher in the normal pass too (no
    // spurious bare-book duplicate). Targeted — does not touch ordinary accents.
    .replace(ROMAN_NUMERAL_RE, (c) => ROMAN_NUMERAL_FOLD.get(c) || c)
    // Control characters (C0 + C1 + DEL, i.e. Unicode Cc) → space, EXCEPT real
    // whitespace tab/newline/CR. \p{Cc} also covers C1 (incl. NEL U+0085) and
    // DEL (U+007F). GLOBAL → space keeps a numeral-prefix↔book seam ("II​John")
    // as two tokens; the shadow pass handles the delete-and-rejoin cases.
    .replace(/\p{Cc}/gu, (c) => (c === '\t' || c === '\n' || c === '\r' ? c : ' '))
    // Truly-invisible zero-width / format / default-ignorable characters → space
    // (GLOBAL): \p{Cf} (zero-width space/joiner/non-joiner, word joiner, BOM,
    // soft hyphen) and \p{Default_Ignorable_Code_Point} (variation selectors,
    // CGJ U+034F, Mongolian FVS, Hangul fillers, …).
    .replace(/[\p{Cf}\p{Default_Ignorable_Code_Point}]/gu, ' ')
    // Combining marks (\p{M}) are BOUNDARY-AWARE: after NFC a residual mark that
    // sits at a book↔chapter boundary — between a letter and a digit — is a
    // hidden separator and becomes a space (so "Hezekiah<U+0300>4:5" recombines
    // to "Hezekiah 4:5" and is caught). A mark that stays WORD-INTERNAL
    // (letter↔letter) is left alone, so decomposed accented prose is never split
    // into a false citation. Both directions of the boundary are covered.
    .replace(/(?<=\p{L})\p{M}+(?=\p{Nd})/gu, ' ')
    .replace(/(?<=\p{Nd})\p{M}+(?=\p{L})/gu, ' ')
    // Unicode spaces → ASCII space.
    .replace(/[   -   　]/g, ' ')
    // ALL Unicode decimal digits (fullwidth, Arabic-Indic, Devanagari, Kawi,
    // math, …) → ASCII, so a visibly out-of-range "John 3:٣٧" / "John ٩٩:١" is
    // matched by the ASCII `\d` matcher and range-checked. Detection-only.
    .replace(/\p{Nd}/gu, decimalDigitToAscii)
    // Fullwidth Latin letters (U+FF21–FF3A / U+FF41–FF5A) → ASCII letters.
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    // Colon variants (fullwidth colon, ratio, modifier letter colon) → ':'.
    .replace(/[：∶ː꞉]/g, ':')
    // Dash variants → '-'.
    .replace(/[‐-―−－]/g, '-')
    // COMPACT numbered-book forms → spaced, so the matcher's spaced-prefix
    // grammar binds them to the numbered book: "2John"/"2-John"/"2.John"/
    // "IIJohn" → "2 John". Restricted to actual numbered-book stems (see
    // COMPACT_NUMBERED_RE) so a real book name is never split ("Isaiah" stays
    // "Isaiah", never "1 Saiah") and prose is never mis-bound. This also stops
    // "2-John" from extracting as a bare, valid "John" (it becomes "2 John").
    .replace(COMPACT_NUMBERED_RE, '$1 $2')
    // ORDINAL-SUFFIX prefix (1st/2nd/…) binds the numbered book across a
    // SPACED separator too ("4th. John" → "4th John"); never an outline marker.
    .replace(ORDINAL_NUMBERED_RE, '$1 $2')
    // COMPACT numeric/Roman prefix fused to a book-SHAPED (possibly fabricated)
    // token → spaced numbered form ("2Hezekiah 4:5"/"2-Hezekiah 4:5" → invalid
    // "2 Hezekiah 4:5"), gated so "Isaiah" is never split (see spaceCompactPrefix).
    .replace(COMPACT_PREFIX_BOOKSHAPED_RE, spaceCompactPrefix)
    // COMPACT book↔chapter with NO space → insert a space so a glued known /
    // book-shaped ref binds ("John3:37"/"Jn3:37"/"Hezekiah4:5"). Book-shape-gated,
    // so "cafe4:5" (not book-shaped) is left alone.
    .replace(COMPACT_BOOK_CHAPTER_RE, '$1 ');
}

// Book ABBREVIATION (no numeric prefix) → canonical lowercase book key. Numbered
// books map by their SUFFIX (e.g. "cor" → "corinthians"); the numeric prefix is
// bound separately. Full names validate directly and need no entry here. NONE of
// these collide with a common English word (ambiguous forms like "is"/"am" are
// deliberately omitted — use "isa"/"amos") so they never false-positive prose.
const BOOK_ABBREV = {
  gen: 'genesis', gn: 'genesis', ge: 'genesis',
  ex: 'exodus', exo: 'exodus', exod: 'exodus',
  lev: 'leviticus', lv: 'leviticus',
  num: 'numbers', nm: 'numbers', nb: 'numbers',
  deut: 'deuteronomy', dt: 'deuteronomy', deu: 'deuteronomy',
  josh: 'joshua', jos: 'joshua', jsh: 'joshua',
  judg: 'judges', jdg: 'judges', jgs: 'judges',
  rth: 'ruth', ru: 'ruth',
  sam: 'samuel', sm: 'samuel',
  kgs: 'kings', kg: 'kings', ki: 'kings',
  chr: 'chronicles', chron: 'chronicles',
  ezr: 'ezra',
  neh: 'nehemiah',
  esth: 'esther', est: 'esther',
  ps: 'psalms', psa: 'psalms', psalm: 'psalms', pss: 'psalms', psm: 'psalms',
  prov: 'proverbs', prv: 'proverbs', pro: 'proverbs',
  eccl: 'ecclesiastes', ecc: 'ecclesiastes', eccles: 'ecclesiastes', qoh: 'ecclesiastes',
  song: 'song of solomon', sos: 'song of solomon', cant: 'song of solomon', canticles: 'song of solomon',
  isa: 'isaiah', isai: 'isaiah',
  jer: 'jeremiah', jr: 'jeremiah',
  lam: 'lamentations',
  ezek: 'ezekiel', eze: 'ezekiel', ezk: 'ezekiel',
  dan: 'daniel', dn: 'daniel',
  hos: 'hosea',
  jl: 'joel', joe: 'joel',
  amo: 'amos', amos: 'amos',
  obad: 'obadiah', ob: 'obadiah',
  jon: 'jonah', jnh: 'jonah',
  mic: 'micah',
  nah: 'nahum', na: 'nahum',
  hab: 'habakkuk',
  zeph: 'zephaniah', zep: 'zephaniah',
  hag: 'haggai', hg: 'haggai',
  zech: 'zechariah', zec: 'zechariah',
  mal: 'malachi',
  matt: 'matthew', mt: 'matthew', mat: 'matthew',
  mrk: 'mark', mk: 'mark', mar: 'mark',
  luk: 'luke', lk: 'luke',
  jn: 'john', joh: 'john', jhn: 'john',
  act: 'acts',
  rom: 'romans', rm: 'romans',
  cor: 'corinthians', co: 'corinthians',
  gal: 'galatians', ga: 'galatians',
  eph: 'ephesians',
  phil: 'philippians', php: 'philippians', philipp: 'philippians',
  col: 'colossians',
  thess: 'thessalonians', thes: 'thessalonians', ths: 'thessalonians',
  tim: 'timothy', ti: 'timothy', tm: 'timothy',
  tit: 'titus',
  philem: 'philemon', phlm: 'philemon', phm: 'philemon',
  heb: 'hebrews',
  jas: 'james', jm: 'james',
  pet: 'peter', pt: 'peter', pe: 'peter',
  jud: 'jude',
  rev: 'revelation', rv: 'revelation', apoc: 'revelation',
  tob: 'tobit', tb: 'tobit',
  jdt: 'judith', jth: 'judith',
  wis: 'wisdom', wisd: 'wisdom',
  sir: 'sirach', ecclus: 'sirach',
  bar: 'baruch',
  macc: 'maccabees', mac: 'maccabees', mcc: 'maccabees',
};

// Stems of the NUMBERED books (full names + their 3+ character abbreviations)
// for the compact-form rewrite. Derived from the book tables so it can never
// drift. 2-character abbreviations are deliberately EXCLUDED so an ordinary word
// cannot be split by a fused prefix (e.g. "ism" must not become "1 sm"/1 Samuel;
// only clear stems like "john"/"cor"/"sam" bind). Longest-first so the greedy
// alternation prefers the full name over its abbreviation.
const NUMBERED_FULL_BASES = new Set();
for (const key of BOOK_LOOKUP) {
  const m = /^[123]\s+(.+)$/.exec(key);
  if (m) NUMBERED_FULL_BASES.add(m[1]);
}
for (const key of Object.keys(DEUTERO_CHAPTER_COUNTS)) {
  const m = /^[123]\s+(.+)$/.exec(key);
  if (m) NUMBERED_FULL_BASES.add(m[1]);
}
const NUMBERED_ABBREV_STEMS = Object.keys(BOOK_ABBREV)
  .filter((a) => a.length >= 3 && NUMBERED_FULL_BASES.has(BOOK_ABBREV[a]));
const COMPACT_STEMS = [...NUMBERED_FULL_BASES, ...NUMBERED_ABBREV_STEMS]
  .sort((a, b) => b.length - a.length);
// Ordinal-WORD prefixes (first..tenth). Only first/second/third denote a REAL
// numbered book; the rest are unsupported and, bound to a numbered stem, name a
// fabricated numbered book (classified invalid by validation, never dropped).
const ORDINAL_WORDS = 'first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth';
// EVERY numbered-book prefix FORM: any-length numeric (post Unicode-digit fold),
// any Roman run, or an ordinal word. Shared by the compact rewrites so every form
// binds in the compact / hyphen / dot cases (not just the whitespace case
// CITATION_RE handles). An UNSUPPORTED value (not 1-3) bound to a numbered stem
// is a fabricated numbered book — parseCitation keeps the number so validation
// flags it, and NEVER lets the matcher fall back to the bare (valid) book.
// The numeric alternative also accepts an ORDINAL SUFFIX (1st, 2nd, 3rd, 4th,
// 11th, …; the suffix letters match case-insensitively via CITATION_RE's `i`
// flag). `\d+(?:st|nd|rd|th)?` keeps a bare number working too; prefixToNumber
// strips the suffix. So "1st John"/"2nd-John"/"3rdJohn1:1" bind like their bare-
// number twins (1/2/3 John valid; 4th/5th/11th → invalid_book, never bare John).
const COMPACT_PREFIX_ALT = `\\d+(?:st|nd|rd|th)?|[ivxlcdm]+|${ORDINAL_WORDS}`;
// ONE shared prefix↔book separator: nothing (glued), or a hyphen / dot with NO
// surrounding whitespace. Only these UNAMBIGUOUS compact forms ("2John",
// "2-John", "2.John") bind as a numbered-book prefix. A separator with
// SURROUNDING SPACES ("2 - John", "2 . John") is an OUTLINE / LIST marker, NOT a
// prefix — see the DOCUMENTED TRADE-OFF at CITATION_RE. (Reverts the r29
// `\s*[.\-]?\s*`, which wrongly rejected a valid Gospel-John ref written as a
// numbered outline item, e.g. "2 - John 3:16".)
const COMPACT_SEP = '[.\\-]?';
// Lookahead for a chapter:verse (ASCII digits OR Roman, any length) following.
const CV_LOOKAHEAD = '(?:\\d+|[ivxlcdm]+)\\s*:\\s*(?:\\d+|[ivxlcdm]+)';
// A numeric / Roman / worded prefix joined to a numbered-book stem by that
// separator → rewritten to the spaced form ("$1 $2"), so "2John", "IIJohn",
// "Second-John", "Third.John" all bind to the numbered book. The stem must be
// followed by EITHER a word boundary (keeps "2content"/"IIJohnny"/"secondary"
// from matching a stem inside a word) OR a glued chapter:verse — so a compact
// citation with the chapter DIGIT glued to the stem ("2John1:1", "2-John1:1",
// "1Cor13:4") still binds to the numbered book instead of being dropped or
// rebinding to a bare "John" (the later book↔chapter spacing pass then inserts
// the "John 1:1" space). A glued chapter never occurs in prose.
const COMPACT_NUMBERED_RE = new RegExp(
  `\\b(${COMPACT_PREFIX_ALT})${COMPACT_SEP}(${COMPACT_STEMS.join('|')})(?:\\b|(?=${CV_LOOKAHEAD}))`,
  'giu',
);
// An ORDINAL-SUFFIX prefix (1st/2nd/3rd/4th/…) is NEVER an outline marker, so it
// binds the numbered book across a separator WITH surrounding whitespace too
// ("4th. John", "4th- John", "2nd - John") — unlike a bare numeric, where a
// spaced separator stays an outline marker (r30). The st/nd/rd/th suffix is the
// discriminator. Rewritten to the spaced form so CITATION_RE binds it (supported
// → valid numbered book, unsupported → invalid_book, never bare John).
const ORDINAL_SUFFIX_PREFIX = '\\d+(?:st|nd|rd|th)';
const ORDINAL_NUMBERED_RE = new RegExp(
  `\\b(${ORDINAL_SUFFIX_PREFIX})\\s*[.\\-]?\\s*(${COMPACT_STEMS.join('|')})(?:\\b|(?=${CV_LOOKAHEAD}))`,
  'giu',
);

// BOUNDED ordinal-prefix normalizer (applied EARLY in normalizeCitationText,
// before the hidden→space passes). Matches an ordinal PREFIX whose digits and/or
// suffix letters may be ASCII or SUPERSCRIPT and may have hidden/combining chars
// (\p{Cf}, \p{Default_Ignorable_Code_Point}, \p{M} — incl. U+200B) spliced in —
// ONLY when it sits immediately before a NUMBERED-book stem. `foldOrdinalPrefix`
// rewrites it to the bare ASCII ordinal ("4​th"/"4́th"/"⁴ᵗʰ"→"4th"), deleting the
// internal hidden chars so the digit↔suffix seam is never turned into a space,
// and folding superscripts. Requiring the ordinal SUFFIX + a following stem
// bounds the fold so a lone superscript footnote marker is never touched.
const SUP_DIGITS = Object.keys(SUPERSCRIPT_FOLD).filter((c) => /[0-9]/.test(SUPERSCRIPT_FOLD[c])).join('');
const SUP_LETTERS = Object.keys(SUPERSCRIPT_FOLD).filter((c) => /[a-z]/.test(SUPERSCRIPT_FOLD[c])).join('');
// The ordinal digit↔suffix seam uses the COMPLETE seam class (hidden + Unicode
// separators). SHADOW_HIDDEN alone (hidden only) missed \p{Zs}/\p{Zl}/\p{Zp},
// which normalizeCitationText turns into an ASCII space LATER — so a Unicode-
// space seam ("4<U+200A>th", "2<U+00A0>nd") split the ordinal → bare John. Using
// CONTEXT_SEAM here (a superset of the shadow's hidden class) closes the whole
// seam-class gap at once and keeps the two paths from drifting.
const ORD_HIDDEN = CONTEXT_SEAM;
// Ordinal DIGIT: any Unicode decimal digit (\p{Nd} — ASCII, fullwidth,
// Arabic-Indic, mathematical, …) PLUS superscript digits (\p{No}, not Nd). The
// leading digits fold to ASCII in foldOrdinalPrefix regardless of script.
const ORD_DIGIT = `[\\p{Nd}${SUP_DIGITS}]`;
const ORD_SUFFIX = `(?:[sˢ]${ORD_HIDDEN}*[tᵗ]|[nⁿ]${ORD_HIDDEN}*[dᵈ]|[rʳ]${ORD_HIDDEN}*[dᵈ]|[tᵗ]${ORD_HIDDEN}*[hʰ])`;
const ORD_SEP = `(?:[\\s.\\-]|${ORD_HIDDEN})`;
// Start boundary is a Unicode-aware negative lookbehind (NOT `\b`, which does not
// fire before a SUPERSCRIPT digit — category No, not a word char — so "⁴ᵗʰ" would
// be missed): the ordinal must not start mid-word or mid-number.
const ORDINAL_PREFIX_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(${ORD_DIGIT}+)(${ORD_HIDDEN}*)(${ORD_SUFFIX})(?=${ORD_SEP}*(?:${COMPACT_STEMS.join('|')}))`,
  'giu',
);
function foldOrdinalPrefix(m, digits, seam, suffix) {
  // If the digit↔suffix seam contains a backslash-escape that does NOT decode to
  // a seam codepoint (e.g. "A" = "A"), it is not really a seam → leave the
  // match untouched (it is not an ordinal, so the bare book is extracted later).
  if (!seamRunIsAllSeam(seam)) return m;
  const d = [...digits].map((c) => {
    if (SUPERSCRIPT_FOLD[c] !== undefined) return SUPERSCRIPT_FOLD[c]; // superscript digit
    if (/\p{Nd}/u.test(c)) return decimalDigitToAscii(c);             // any Unicode decimal digit
    return c;
  }).join('');
  const s = [...suffix].map((c) => SUPERSCRIPT_FOLD[c] || c).filter((c) => /[a-z]/i.test(c)).join('');
  return d + s;
}
// A superscript digit run that is ADJACENT TO (immediately after) an ASCII/
// decimal digit is an AMBIGUOUS mixed number: the two readings — footnote
// (delete → the shorter ASCII value) vs number data (fold → a longer value) —
// yield DIFFERENT numbers, and there is no sound, non-gameable way to tell them
// apart (an adversary can always write an evasion as "N<superscript>"). FAIL
// CLOSED: replace the superscript run with a malformed-token MARKER (a letter),
// so the number becomes malformed and the strict validator flags the reference —
// NEVER silently emitting a valid ref that DIFFERS from the visible text.
// Applies to trailing ("3:16¹"→"3:16z", "3:3⁷"→"3:3z"), between-digit
// ("3:1⁶5"→"3:1z5"), and range-end ("3:1-3⁶") superscripts — INCLUDING when a
// CONTEXT_SEAM (hidden OR Unicode separator OR ASCII whitespace incl. tab/LF/CR)
// is wedged between the decimal digit and the superscript ("3:1<U+200B>⁶",
// "3:1<TAB>⁶"): the seam is consumed and the superscript run replaced with the
// marker, so no inserted seam can smuggle the shortened/extended reading past the
// fail-closed rule. A superscript filling an EMPTY chapter/verse slot (NOT
// preceded by a digit — "John 3:¹⁶", "John²:1") is UNAMBIGUOUS number data →
// LEFT for NFKC to fold (r35 rule, unchanged). The required SUPERSCRIPT digit
// after the seam keeps a newline between two real refs ("…3:16\nMark 1:1") safe.
const SUP_AMBIG_MARK = 'z'; // a letter → NUM_TOKEN captures it as a trailing char → malformedToken flags
const AMBIGUOUS_SUPERSCRIPT_RE = new RegExp(`(\\p{Nd})(${CONTEXT_SEAM}*)[${SUP_DIGITS}]+`, 'gu');
// Fail-closed only when the digit↔superscript seam is entirely seam; a non-seam
// escape between them means they are not adjacent → leave the match untouched.
function markAmbiguousSuperscript(m, digit, seam) {
  return seamRunIsAllSeam(seam) ? digit + SUP_AMBIG_MARK : m;
}
// A superscript ORDINAL LETTER not consumed by the ordinal-prefix fold is never
// number data → delete.
const STRAY_SUP_LETTER_RE = new RegExp(`[${SUP_LETTERS}]`, 'gu');
// Scrub superscript / Unicode-digit ordinal look-alikes on the RAW text, run
// FIRST in every pass — ahead of NFKC (pass 2) and the shadow's hidden→space
// handling (pass 3). (1) Fold an ordinal prefix before a numbered stem (any
// Unicode digit + hidden/combining seams + superscript suffix) to the bare ASCII
// ordinal; (2) FAIL-CLOSED mark a superscript-after-a-digit (ambiguous mixed
// number) so it is flagged, never silently shortened, while LEAVING an
// empty-slot superscript for NFKC to fold; (3) delete stray superscript letters.
function scrubSuperscripts(text) {
  return String(text)
    .replace(ORDINAL_PREFIX_RE, foldOrdinalPrefix)
    .replace(AMBIGUOUS_SUPERSCRIPT_RE, markAmbiguousSuperscript)
    .replace(STRAY_SUP_LETTER_RE, '');
}

// Canonical lowercase book key → display (Title Case) for a clean `ref` string.
const DISPLAY_NAME = {};
for (const b of BOOKS) DISPLAY_NAME[b.toLowerCase()] = b;
Object.assign(DISPLAY_NAME, {
  tobit: 'Tobit', judith: 'Judith', wisdom: 'Wisdom', 'wisdom of solomon': 'Wisdom of Solomon',
  sirach: 'Sirach', ecclesiasticus: 'Ecclesiasticus', baruch: 'Baruch',
  '1 maccabees': '1 Maccabees', '2 maccabees': '2 Maccabees',
});

// Common English words that legitimately precede "N:N" in ordinary prose (times,
// ratios, scores, counts, pronoun-verb sequences) and must NOT be mistaken for a
// (fabricated) book name. Real book names / abbreviations are NEVER added here
// and always win (see looksLikeReference), so genuine citations are never
// dropped; anything else shaped like "<Word> N:N" is kept as a possible
// fabrication, so a lowercase/abbreviated evasion is still caught.
const NON_BOOK_WORDS = new Set([
  'at', 'by', 'to', 'of', 'in', 'on', 'up', 'as', 'is', 'am', 'was', 'are', 'were', 'be', 'been', 'being',
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'from', 'with', 'without', 'within', 'into', 'onto',
  'this', 'that', 'these', 'those', 'our', 'your', 'their', 'his', 'her', 'its', 'my', 'we', 'you',
  'they', 'it', 'he', 'she', 'i', 'me', 'us', 'them', 'him', 'about', 'around', 'approximately',
  'approx', 'roughly', 'over', 'under', 'near', 'between', 'than', 'then', 'ratio', 'ratios', 'score',
  'scored', 'scores', 'time', 'times', 'hour', 'hours', 'minute', 'minutes', 'page', 'pages', 'line',
  'lines', 'room', 'number', 'no', 'version', 'level', 'round', 'size', 'part', 'parts', 'step',
  'steps', 'figure', 'table', 'item', 'day', 'days', 'week', 'weeks', 'year', 'years', 'vs', 'versus',
  'meeting', 'meetings', 'session', 'sessions', 'appointment', 'grade', 'model', 'chapter', 'verse',
  'first', 'second', 'third', 'saw', 'see', 'seen', 'do', 'did', 'does', 'go', 'went', 'get', 'got',
  'had', 'has', 'have', 'will', 'would', 'could', 'should', 'can', 'may', 'said', 'says', 'know', 'knew',
  'make', 'made', 'take', 'took', 'come', 'came', 'meet', 'met', 'want', 'need', 'call', 'called',
  // Common accented words whose mark-stripped ASCII base could look like a book
  // token; kept out of the candidate set so "café 4:5" / "résumé 4:5" (and their
  // ASCII forms) are never a false citation.
  'cafe', 'café', 'resume', 'résumé', 'fiance', 'fiancé', 'cliche', 'cliché', 'naive', 'naïve',
]);

// A chapter / verse / range-end NUMBER token: the FULL contiguous run of ASCII
// digits (with any TRAILING letters/marks captured so a malformed "16I"/"5abc"
// reaches the validator instead of being truncated to "16"/"5"), OR a Roman
// run WITH its own trailing capture. ONE shared token-end rule for numeric AND
// Roman: capture the full contiguous run plus ANY trailing letters/marks, so a
// malformed suffix ("16I", "Xé", "XЖ", "IVé") is handed to VALIDATION to
// classify rather than truncated to the valid prefix. NEVER length-capped, so an
// overlong token ("1000", a 16-I Roman) is captured too. A real separator (space
// / ASCII punctuation / EOL) ends a token cleanly, so "John 3:16 is" is fine.
// CHAPTER/VERSE Roman keeps `(?![a-z])` so it is not the head of an ASCII WORD
// ("Luke 2:live" is prose, not a citation) — a NON-ASCII trailing char is still
// captured as malformed. Unicode roman/digit code points are folded to ASCII
// first (ROMAN_NUMERAL_FOLD / decimalDigitToAscii).
// ONE shared token for chapter, verse, AND range-end: a digit-run OR a Roman-run,
// each capturing ANY trailing letters/marks. No ASCII-word guard in the regex —
// the trailing run is captured for numeric AND Roman alike ("16I", "Xabc", "IVé",
// "XЖ", "3:1-Vabc"), then classifyNumberToken (case-SENSITIVE, plain JS) decides:
// clean digits / canonical Roman → number; a lowercase-ASCII word that is not a
// canonical Roman ("live", "ivy") → PROSE (the match is dropped, so "John 2:live"
// stays clean); anything else (digits+letters, UPPERCASE Roman + junk, non-ASCII
// trailing) → MALFORMED (kept and flagged by the validator).
const TOK_TRAIL = '[\\p{L}\\p{M}]*';
const NUM_TOKEN = `(\\d+${TOK_TRAIL}|[ivxlcdm]+${TOK_TRAIL})`;
// Permissive citation matcher (run on normalized text). Groups:
//   1 prefix (optional): 1-3 / I-III / first-third
//   2 book (with optional trailing '.', optional "of X")
//   3 chapter   4 verse   5 verseEnd (optional) — each ASCII digits OR Roman
// A leading Unicode-aware negative lookbehind stops the ASCII book token from
// starting in the MIDDLE of a non-ASCII word: the ASCII `\b` treats the seam
// between an accented letter and an ASCII letter as a boundary, so "naïve 4:5"
// used to yield "ve 4:5" and "L'Oréal 4:5" yielded "al 4:5" (both then screened
// as fabricated). Requiring the match not be preceded by a Unicode letter,
// combining mark, or apostrophe forces a real word start (BoS / whitespace /
// non-letter punctuation). The `u` flag is needed for the \p{…} classes.
// The prefix accepts EVERY form (any-length numeric, any Roman, ordinal word),
// not just the supported 1-3 — so an UNSUPPORTED prefix ("4 John", "IV John",
// "Fourth John") is CONSUMED by the match and bound (parseCitation classifies it
// invalid for a numbered stem, or drops a spurious number for a non-numbered
// book), instead of the matcher restarting at the bare book and reinterpreting
// it as a valid Gospel. The prefix is followed by whitespace ONLY (`\s+`, no
// `\.?`): a dot/hyphen after the number with a following space ("2. John 3:16",
// "2 - John 3:16") is an OUTLINE / LIST marker and reads as the BARE book, so a
// valid Gospel-John reference in a numbered list is NOT wrongly rejected.
// DOCUMENTED TRADE-OFF: consequently a FABRICATED numbered book written with a
// spaced separator ("4 - John 1:1") reads as the valid bare "John 1:1" — an
// accepted low-risk residual (exotic input), because a rejected VALID citation
// is a worse harm than an exotic fabrication slipping. The no-space / single-
// space unsupported-prefix trapping ("4John", "4-John", "Fourth John") is kept.
const CITATION_RE = new RegExp(
  `(?<![\\p{L}\\p{M}'’])\\b(?:(${COMPACT_PREFIX_ALT})\\s+)?`
  + `([a-z]{2,}\\.?(?:\\s+of\\s+[a-z]+)?)\\s+`
  + `${NUM_TOKEN}\\s*:\\s*${NUM_TOKEN}(?:\\s*[-]\\s*${NUM_TOKEN})?`,
  'giu',
);

const titleCase = (s) => s.split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

// Roman numeral (I V X L C D M, any case) → integer. Lenient subtractive parse;
// the resulting number is range-checked afterward, so a large/odd value simply
// reads as out_of_range rather than being silently accepted.
const ROMAN_VALUE = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
function romanToInt(s) {
  const t = s.toLowerCase();
  let total = 0;
  for (let i = 0; i < t.length; i += 1) {
    const cur = ROMAN_VALUE[t[i]] || 0;
    const next = ROMAN_VALUE[t[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}
// Canonical Roman-numeral grammar (case-insensitive). A token of Roman letters
// that is NOT well-formed (e.g. "IIV", "VV", "IIII") must NOT be coerced into a
// number — see numberTokenToDecimal.
const ROMAN_CANONICAL_RE = /^m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;
// A number token from the matcher → its decimal-string value: ASCII digits pass
// through; a CANONICAL Roman numeral is converted; a NON-canonical Roman token
// is returned RAW (non-numeric), so buildCanonical emits a non-numeric
// chapter/verse/range that validateScriptureRefs flags (invalid_book /
// unparseable / out_of_range) rather than silently accepting a coerced value.
// null/undefined stays as-is.
function numberTokenToDecimal(tok) {
  if (tok == null) return tok;
  if (/^\d+$/.test(tok)) return tok;
  return ROMAN_CANONICAL_RE.test(tok) ? String(romanToInt(tok)) : tok;
}

// Classify a captured chapter/verse/range token (CASE-SENSITIVE — the plain JS
// regexes below carry no `i` flag, unlike CITATION_RE's `giu`):
//   'number'   — clean digits or a canonical Roman numeral (any case) → a real
//                chapter/verse; the citation is kept and range-checked.
//   'prose'    — an all-lowercase-ASCII word that is NOT a canonical Roman
//                ("live", "ivy", "vabc"): a Roman-looking prose word, NOT a
//                citation. The match is DROPPED (so "John 2:live" stays clean).
//   'malformed'— anything else: digits with a trailing letter ("16I", "5abc"),
//                an UPPERCASE Roman + junk ("Xabc", "IVabc"), a non-canonical
//                Roman ("IIV"), or a non-ASCII trailing char ("Xé", "XЖ"). Kept,
//                and the validator classifies it out_of_range / unparseable.
// Case is the practical signal that separates a deliberate numeral ("Xabc") from
// ordinary lowercase prose ("live").
function classifyNumberToken(tok) {
  if (tok == null) return 'number';
  if (/^\d+$/.test(tok)) return 'number';
  if (/^\d/.test(tok)) return 'malformed';            // digits + trailing junk
  if (ROMAN_CANONICAL_RE.test(tok)) return 'number';  // clean canonical Roman (any case)
  // A token made up ONLY of Roman-numeral letters that is NOT canonical is a
  // MALFORMED numeral, even all-lowercase ("iiii", "vv", "iiv") — an adversary
  // lowercases the bad numeral to dodge the prose escape. Route it to the strict
  // validator (→ malformed / out_of_range), do NOT silently drop it as prose.
  if (/^[ivxlcdm]+$/.test(tok)) return 'malformed';
  if (/^[a-z]+$/.test(tok)) return 'prose';           // lowercase word with a NON-Roman letter (live, ivy)
  return 'malformed';                                 // uppercase-Roman+junk / non-ASCII / non-canonical
}

// Ordinal WORD → number (first..tenth). Only 1-3 are supported numbered books.
const ORDINAL_NUM = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};
// A prefix token (numeric, numeric-ordinal-suffix, Roman, or ordinal word) → its
// integer value, or null.
function prefixToNumber(raw) {
  const t = raw.toLowerCase().replace(/\./g, '');
  const ord = /^(\d+)(?:st|nd|rd|th)$/.exec(t); // 1st, 2nd, 3rd, 4th, 11th, …
  if (ord) return Number(ord[1]);
  if (/^\d+$/.test(t)) return Number(t);
  if (ORDINAL_NUM[t] != null) return ORDINAL_NUM[t];
  if (/^[ivxlcdm]+$/.test(t)) return romanToInt(t);
  return null;
}

function parseCitation(m) {
  const rawPrefix = m[1] ? m[1].toLowerCase().replace(/\./g, '') : '';
  const num = rawPrefix ? prefixToNumber(rawPrefix) : null;
  const rawBook = m[2].toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ').trim();
  const base = BOOK_ABBREV[rawBook] || rawBook;
  const isNumberedStem = NUMBERED_FULL_BASES.has(base);
  // Bind the prefix number to the book when it is a SUPPORTED ordinal (1-3) OR
  // the book actually HAS numbered forms. An unsupported number on a numbered
  // stem ("4 John", "IV John", "Fourth John") stays bound so validation flags it
  // as a fabricated numbered book (invalid_book) — it is NEVER dropped to the
  // bare valid Gospel. A number on a NON-numbered book ("5 Psalms 119:1") is
  // spurious and dropped, so the bare book validates as before.
  const bind = num != null && ((num >= 1 && num <= 3) || isNumberedStem);
  const prefixNum = bind ? String(num) : '';
  const canonicalKey = prefixNum ? `${prefixNum} ${base}` : base;
  // If ANY number position is a Roman-looking prose WORD (lowercase, non-numeral),
  // this is not a citation ("John 2:live") — flag it so collect() drops the match.
  const prose = classifyNumberToken(m[3]) === 'prose'
    || classifyNumberToken(m[4]) === 'prose'
    || (m[5] != null && classifyNumberToken(m[5]) === 'prose');
  return {
    prefixNum,
    base,
    canonicalKey,
    prose,
    chapter: numberTokenToDecimal(m[3]),
    verse: numberTokenToDecimal(m[4]),
    verseEnd: numberTokenToDecimal(m[5]),
  };
}

function looksLikeReference({ base, canonicalKey }) {
  // A known book (with prefix bound, or the bare base) is always a reference —
  // this also protects deuterocanon words that resemble nouns (Wisdom, Song).
  if (BOOK_LOOKUP.has(canonicalKey) || DEUTERO_CHAPTER_COUNTS[canonicalKey] != null) return true;
  if (BOOK_LOOKUP.has(base) || DEUTERO_CHAPTER_COUNTS[base] != null) return true;
  // Otherwise keep it as a possible fabrication unless the leading word is a
  // common non-book word (filters times/ratios/scores/prose out).
  const firstWord = base.split(' ')[0];
  return !NON_BOOK_WORDS.has(firstWord);
}

function buildCanonical({ canonicalKey, base, prefixNum, chapter, verse, verseEnd }) {
  const display = DISPLAY_NAME[canonicalKey]
    || (prefixNum ? `${prefixNum} ${titleCase(base)}` : titleCase(base));
  const range = verseEnd != null ? `-${verseEnd}` : '';
  return `${display} ${chapter}:${verse}${range}`;
}

// Suffixes shared by real and fabricated Bible BOOK / proper-noun names
// (Hezekiah, Zephaniah, Ezekiel, Samuel, Nathanael, Jonah, Judith, …). Ordinary
// English words — including accented common words reconstructed from their marks
// (cafe/resume) — do not end this way. `[aeiou]el` keeps Daniel/Samuel/Joel but
// excludes hotel/novel/model/level (consonant before "el").
const BIBLICAL_SUFFIX_RE = /(?:iah|jah|iel|uel|ael|oel|[aeiou]el|ah|oth|ith|iath)$/i;

// Is a citation candidate BOOK-SHAPED? Used to gate the mark-stripped detection
// pass so a legit accented word + a ratio ("café 4:5" → stripped "cafe 4:5") is
// NOT treated as a hidden citation, while a fabricated biblical-book-shaped name
// hidden by a mark ("Hezekiaḣ 4:5" → "Hezekiah 4:5") still is. A known book /
// abbreviation / numbered book always qualifies; otherwise the base must look
// like a biblical proper noun and not be a common non-book word.
function isBookShaped(parsed) {
  const { base, canonicalKey } = parsed;
  if (BOOK_LOOKUP.has(canonicalKey) || DEUTERO_CHAPTER_COUNTS[canonicalKey] != null) return true;
  if (BOOK_LOOKUP.has(base) || DEUTERO_CHAPTER_COUNTS[base] != null) return true;
  if (BOOK_ABBREV[base] != null) return true;
  const lastWord = base.split(/\s+/).pop() || '';
  if (NON_BOOK_WORDS.has(lastWord)) return false;
  return lastWord.length >= 4 && BIBLICAL_SUFFIX_RE.test(lastWord);
}

// --- Compact (no-space) book / prefix binding, used by normalizeCitationText ---
// A single-word KNOWN book / abbreviation / numbered-book stem, for the compact
// book↔chapter and compact-prefix rewrites. Derived from the book tables.
const SINGLE_BOOK_TOKENS = new Set();
for (const b of BOOKS) { const k = b.toLowerCase(); if (!k.includes(' ')) SINGLE_BOOK_TOKENS.add(k); }
for (const k of Object.keys(DEUTERO_CHAPTER_COUNTS)) { if (!k.includes(' ')) SINGLE_BOOK_TOKENS.add(k); }
for (const base of NUMBERED_FULL_BASES) SINGLE_BOOK_TOKENS.add(base);
for (const a of Object.keys(BOOK_ABBREV)) SINGLE_BOOK_TOKENS.add(a);
const KNOWN_BOOK_ALT = [...SINGLE_BOOK_TOKENS].sort((a, b) => b.length - a.length).join('|');
// A BOOK-SHAPED token: a known book/abbrev OR a biblical-proper-noun-shaped word
// (same suffix set as isBookShaped). Gates the compact rewrites so ordinary words
// touching digits ("cafe4:5") are never bound, only book-shaped ones.
const BIBLICAL_WORD_SRC = '[a-z]{2,}(?:iah|jah|iel|uel|ael|oel|[aeiou]el|ah|oth|ith|iath)';
const BOOK_SHAPED_SRC = `(?:${KNOWN_BOOK_ALT}|${BIBLICAL_WORD_SRC})`;
// GAP 1 — a book-shaped/known token GLUED to chapter:verse (no space) → insert a
// space so the matcher binds it ("John3:37"→"John 3:37", "Hezekiah4:5"→spaced).
const COMPACT_BOOK_CHAPTER_RE = new RegExp(`\\b(${BOOK_SHAPED_SRC})(?=${CV_LOOKAHEAD})`, 'giu');
// GAP 2 — a numeric (1-3) or Roman (I-III) prefix fused (no-space / hyphen / dot)
// to a book-shaped token before chapter:verse → spaced numbered form, so a
// FABRICATED compact numbered ref ("2Hezekiah 4:5", "2-Hezekiah 4:5") is bound
// and flagged (invalid_book) instead of dropped. A digit prefix binds with no
// separator (no real book starts with a digit); a Roman prefix with NO separator
// binds ONLY when the fused word is not itself a real book, so "Isaiah" is never
// split into "I saiah".
const COMPACT_PREFIX_BOOKSHAPED_RE = new RegExp(
  `\\b(${COMPACT_PREFIX_ALT})(${COMPACT_SEP})(${BOOK_SHAPED_SRC})(?=\\s+${CV_LOOKAHEAD})`,
  'giu',
);
function spaceCompactPrefix(full, prefix, sep, book) {
  const isDigit = /^\d/.test(prefix); // starts with a digit (incl. "4th") — no real book does
  if (isDigit || sep) return `${prefix} ${book}`; // digit-led prefix, or explicit separator
  // Roman / worded prefix, no separator: don't split a word that is itself a
  // real book (so "Isaiah" is never split into "I saiah").
  const whole = (prefix + book).toLowerCase();
  if (SINGLE_BOOK_TOKENS.has(whole) || BOOK_LOOKUP.has(whole)) return full;
  return `${prefix} ${book}`;
}

// Mark-INSENSITIVE detection shadow: NFKC-compatibility-fold, NFD-decompose,
// drop every combining mark, then run the standard normalization. This
// reconstructs the ASCII base of a book token whose boundary a combining mark
// hid — regardless of the mark's position (letter↔space, letter↔digit) or
// whether NFC had composed it into a precomposed non-ASCII letter (e.g.
// "Hezekiaḣ" → "Hezekiah"). The leading NFKC pass additionally folds
// COMPATIBILITY characters used only for detection (never for displayed text):
// Roman-numeral code points ("Ⅱ John" → "II John" → 2 John, range-checked),
// and mathematical / fullwidth / superscript digits ("John 𝟗𝟗:𝟏" → "John
// 99:1", out_of_range) that the ASCII `\d` in the matcher would otherwise miss.
// Paired with the book-shaped gate so it does not resurrect the café/résumé
// false positive.
function markStrippedText(text) {
  // POSITION-AWARE mark handling on the NFD-decomposed text:
  //   • a mark at a book↔chapter boundary (letter↔digit, either direction) hides
  //     the separator → replace with a SPACE ("Hezekiaḣ4:5" → "Hezekiah 4:5");
  //   • every OTHER mark (word-internal letter↔letter, or letter↔space) → DELETE,
  //     so the ASCII token rejoins ("Joh́n 99:1" → "John 99:1"; "café 4:5" →
  //     "cafe 4:5"). Deleting internal marks lets a known book hidden by an
  //     internal mark (John 99:1 → out_of_range) still be extracted and caught.
  // Position-aware handling of BOTH combining marks AND invisible/zero-width
  // code points on the NFKC+NFD text: at a book↔chapter boundary (letter↔digit)
  // a hidden char is a separator → SPACE; anywhere else — inside a letter run
  // ("Joh​n"/"Joh́n" → "John") or a digit run ("3:9​9" → "3:99") — it is
  // gratuitous → DELETE so the full token rejoins and is range-checked. A seam
  // that fuses a non-book ("II​John" → "IIJohn") is harmlessly dropped by the
  // book-shaped gate rather than becoming a false positive.
  const decomposed = String(text).normalize('NFKC').normalize('NFD')
    .replace(SHADOW_AT_BOOK_CHAPTER, ' ')
    .replace(SHADOW_AT_CHAPTER_BOOK, ' ')
    .replace(SHADOW_HIDDEN_ANY, '');
  return normalizeCitationText(decomposed);
}

const REGEX_META_RE = /[.*+?^${}()|[\]\\]/g;
const escapeRegex = (s) => s.replace(REGEX_META_RE, '\\$&');

function collectRefs(source, gate) {
  const refs = [];
  const seen = new Set();
  for (const m of source.matchAll(CITATION_RE)) {
    const parsed = parseCitation(m);
    if (parsed.prose) continue; // Roman-looking prose word in a number slot → not a citation
    if (!gate(parsed)) continue;
    const canonical = buildCanonical(parsed);
    if (!seen.has(canonical)) { seen.add(canonical); refs.push(canonical); }
  }
  return refs;
}

export function extractScriptureRefs(text) {
  if (!text) return [];
  // CITATION-SHAPED seam decoder FIRST: within citation-candidate spans (a seam
  // between two word chars), turn every all-seam run — real, code-point escapes
  // (\uXXXX / \u{…} / \xHH, incl. surrogate pairs and mixed literal/escaped halves),
  // AND short named escapes (\n \t \r …) — into the REAL seam codepoint(s), so an
  // escaped seam at ANY position (digit↔suffix, suffix↔book, book↔chapter, chapter↔
  // verse, digit↔superscript) is handled uniformly by the ordinary real-seam paths
  // below. Non-word-flanked escapes (prose paths, non-citation code) stay untouched.
  const deseamed = decodeCitationSeams(text);
  // Scrub superscript look-alikes FIRST (fold ordinal-prefix superscripts +
  // hidden seams before a numbered stem; delete stray footnote superscripts) so
  // NFKC (pass 2) and the shadow's hidden→space (pass 3) can't corrupt them.
  const scrubbed = scrubSuperscripts(deseamed);
  // Pass 1: normal normalization (NFC + prefix folds + invisible/zero-width +
  // boundary-aware marks). Any non-stopword "Word N:N" is a candidate.
  const pass1 = collectRefs(normalizeCitationText(scrubbed), looksLikeReference);
  // Pass 2: NFKC-fold THEN the SAME global normalization — catches a COMPATIBILITY
  // prefix (unicode roman/digit, invisible seam) that pass 1's targeted folds
  // might miss. NFKC keeps precomposed accents non-ASCII.
  const pass2 = collectRefs(normalizeCitationText(String(scrubbed).normalize('NFKC')), looksLikeReference);
  // Pass 3: mark-STRIPPED, gated to BOOK-SHAPED tokens — catches a book name a
  // combining mark hid anywhere WITHOUT re-flagging an accented common word.
  const pass3 = collectRefs(markStrippedText(scrubbed), isBookShaped);

  // (B) SPAN-AWARE CROSS-PASS BARE-BOOK SUPPRESSION. A folded pass (2 or 3) may
  // recognize a look-alike PREFIX that pass 1 did not — turning a spurious bare
  // "John 1:1" into the specific "k John 1:1" for the SAME source location. Drop
  // a bare-book ref iff a folded pass produced a NUMBERED version of it AND
  // produced NO genuine bare version. Folding only ADDS prefix recognition (it
  // never removes a real bare), so a legitimately un-prefixed citation elsewhere
  // in the text is preserved (the folded pass would still emit the bare form).
  // This closes any future look-alike prefix that only a later pass captures.
  const foldedRefs = new Set([...pass2, ...pass3]);
  const suppressedBare = (ref) => {
    if (/^\d/.test(ref)) return false; // already a numbered ref
    if (foldedRefs.has(ref)) return false; // a genuine bare exists in a folded pass → keep
    const numberedRe = new RegExp(`^\\d+ ${escapeRegex(ref)}$`);
    return [...foldedRefs].some((r) => numberedRe.test(r)); // numbered twin present → spurious bare
  };

  const out = [];
  const seen = new Set();
  for (const ref of [...pass1, ...pass2, ...pass3]) {
    if (seen.has(ref)) continue;
    if (suppressedBare(ref)) continue;
    seen.add(ref);
    out.push(ref);
  }
  return out;
}

/**
 * Collect references that are SPLIT across the string elements of an array, as
 * client schema-coercion would join them for display. A model can emit
 * `{"cross_references":["Hezekiah","4:5"]}` — no single element is an
 * extractable reference, so the per-string deep sweep finds nothing, yet the
 * client joins the array into "Hezekiah\n4:5", a visible citation. This scans
 * the JOIN of each array's string elements (with the space and newline
 * separators coercion uses) so the recombined citation is caught. Used by the
 * AI response screen; kept separate from `extractScriptureRefsDeep` so the
 * persist-gate sweep (which validates already-typed fields) is unchanged.
 */
export function extractScriptureRefsJoined(value, options = {}, _depth = 0, _seen = new Set()) {
  if (value == null || _depth > 12 || typeof value !== 'object') return [];
  if (_seen.has(value)) return [];
  _seen.add(value);

  const out = [];
  if (Array.isArray(value)) {
    const strings = value.filter((v) => typeof v === 'string');
    if (strings.length > 1) {
      out.push(...extractScriptureRefs(strings.join(' ')));
      out.push(...extractScriptureRefs(strings.join('\n')));
    }
    for (const item of value) out.push(...extractScriptureRefsJoined(item, options, _depth + 1, _seen));
  } else {
    for (const [key, item] of Object.entries(value)) {
      // See extractScriptureRefsDeep: the reserved SERVER-blob key is skipped on
      // the persist path (default) but SCREENED on the live model-output path.
      if (!options.screenReservedKeys && NON_CONTENT_KEYS.has(key)) continue;
      out.push(...extractScriptureRefsJoined(item, options, _depth + 1, _seen));
    }
  }
  return out;
}

function normalizeCanon(canon) {
  return CANONS.includes(canon) ? canon : 'protestant';
}

/**
 * Validate an array of reference strings against the selected canon.
 * Backward compatible with the original signature: `options` may be omitted
 * and defaults to the Protestant 66-book canon (the previous behavior).
 */
export function validateScriptureRefs(refs, options = {}) {
  const canon = normalizeCanon(options.canon);
  const list = Array.isArray(refs) ? refs : [];
  return list.filter(Boolean).map((ref) => {
    const str = String(ref);
    const bookPart = str.replace(/\s+\d+\s*:.+$/, '').trim();
    const bookKey = bookPart.toLowerCase();
    const isCore = BOOK_LOOKUP.has(bookKey);
    const deuteroChapters = DEUTERO_CHAPTER_COUNTS[bookKey];
    const isDeutero = deuteroChapters != null;
    // A book "counts" for this validation run only if the selected canon
    // actually contains it. Deuterocanon under the Protestant canon is a
    // real book in another canon — reported as such, never as fabricated.
    const validBook = isCore || (isDeutero && canon !== 'protestant');

    // Full-length numeric chapter/verse/range (no digit cap), so an overlong
    // "1000:1" is read as chapter 1000 and range-checked (→ out_of_range),
    // not truncated to "100" or dropped.
    const cv = str.match(/(\d+):(\d+)(?:\s*[-–]\s*(\d+))?/);
    const chapter = cv ? Number(cv[1]) : null;
    const verse = cv ? Number(cv[2]) : null;
    const verseEnd = cv && cv[3] != null ? Number(cv[3]) : null;
    // STRICT token anchoring: a numeric chapter/verse/range token immediately
    // followed by a letter or combining mark (no separator) is MALFORMED — the
    // `\d+` matches above silently TRUNCATE to the valid prefix ("3:16I"→"16",
    // "3:1-5abc"→range "5"), so detect the trailing garbage and flag the whole
    // reference instead of validating the truncated part. A real separator (a
    // space before a following word, "John 3:16 is") ends the token cleanly and
    // is NOT flagged. Numbered-book display prefixes are always space-separated
    // ("1 John"), so the only digit↔letter adjacency is a malformed number.
    const malformedToken = /\d[\p{L}\p{M}]/u.test(str);
    // A range dash whose END is present but NON-numeric (e.g. a non-canonical or
    // overlong Roman token "3:1-IIV" / "3:1-IIIIIIIIIIIIIIII") is malformed — the
    // optional numeric range group above silently ignores it, so detect and flag
    // it here rather than validating the truncated "3:1" as a clean reference.
    const malformedRange = /:\s*\d+\s*[-–]\s*[^\d\s]/.test(str);

    let status;
    if (!isCore && !isDeutero) {
      status = 'invalid_book';
    } else if (!validBook) {
      status = 'unsupported_canon';
    } else if (chapter == null || verse == null) {
      status = 'unparseable';
    } else if (malformedRange || malformedToken) {
      status = 'out_of_range';
    } else {
      const coreChapters = isCore ? CHAPTER_COUNTS[bookKey] ?? Infinity : 0;
      const extraChapters = CANON_EXTRA_CHAPTERS[bookKey]?.[canon] ?? 0;
      const maxChapter = Math.max(isCore ? coreChapters : deuteroChapters, extraChapters);
      const chapterOk = chapter >= 1 && chapter <= maxChapter;
      if (!chapterOk) {
        status = 'out_of_range';
      } else {
        // Exact verse count for this chapter when we have a table for it.
        const exact = versesInChapter(bookKey, chapter);
        const beyondCoreTable = !isCore || chapter > coreChapters;
        if (exact == null && beyondCoreTable) {
          // Canon-supported book/chapter with no versification table
          // (deuterocanon or Greek Daniel). We can still reject a reversed
          // range, but we must not claim verse-level verification.
          status = verseEnd != null && verseEnd < verse ? 'out_of_range' : 'chapter_checked';
        } else {
          const maxVerse = exact ?? MAX_VERSE;
          const startOk = verse >= 1 && verse <= maxVerse;
          const endOk = verseEnd == null || (verseEnd >= verse && verseEnd <= maxVerse);
          status = startOk && endOk ? 'valid' : 'out_of_range';
        }
      }
    }

    return { ref, validBook, chapter, verse, verseEnd, status, canon };
  });
}

// Keys that never hold sermon prose but DO hold prior validation output or
// bookkeeping whose `ref` strings would be re-extracted and double-counted by
// the deep walk. `scripture_validation` is the array of {ref,status,...}
// objects this module itself produced; walking it would re-validate already-
// recorded references (and, on an update, mix stale results into the new
// computation). Skip these keys everywhere in the tree.
const NON_CONTENT_KEYS = new Set(['scripture_validation']);

/**
 * Recursively collect scripture references from every string anywhere in an
 * arbitrary AI-generated content object.
 *
 * The per-type generators persist scripture in wildly different shapes —
 * sermon `points[].supporting_scriptures[]`, Bible-study
 * `study_sections[].scripture` + `key_verses[]`, quiz
 * `questions[].scripture_reference`, reading-plan `daily_readings[].passages[]`,
 * and the Christian-Ethics analysis which nests everything under
 * `data.result.biblical_foundation.key_scriptures[].reference`. Hard-coding a
 * field list per type is fragile (a UI shape change silently drops a field out
 * of validation), so the durable save gate walks the whole object and extracts
 * references from every string. Array-of-reference fields (already bare
 * "John 3:16" strings) and prose fields are handled uniformly because the
 * reference regex matches a bare reference as readily as one embedded in a
 * sentence.
 */
export function extractScriptureRefsDeep(value, options = {}, _depth = 0, _seen = new Set()) {
  if (value == null || _depth > 12) return [];
  if (typeof value === 'string') return extractScriptureRefs(value);
  if (typeof value !== 'object') return [];
  // Guard against cyclic references (defensive; entity data is plain JSON).
  if (_seen.has(value)) return [];
  _seen.add(value);

  const out = [];
  if (Array.isArray(value)) {
    for (const item of value) out.push(...extractScriptureRefsDeep(item, options, _depth + 1, _seen));
  } else {
    for (const [key, item] of Object.entries(value)) {
      // `scripture_validation` is a SERVER-generated blob on a persisted record;
      // the persist gate skips it (default) to avoid re-validating/double-counting
      // its own prior output. But on the LIVE screen of untrusted MODEL output
      // there is no trusted server block — everything the model emitted is
      // user-visible — so screenReservedKeys:true screens the subtree like any
      // other content, closing a reserved-key blind spot.
      if (!options.screenReservedKeys && NON_CONTENT_KEYS.has(key)) continue;
      // Scan the KEY string itself, not just the value: a model can put a
      // fabricated reference in an object KEY ({"Hezekiah 4:5":"safe"}) which is
      // still user-visible output but which value-only walking would miss.
      out.push(...extractScriptureRefs(key));
      out.push(...extractScriptureRefsDeep(item, options, _depth + 1, _seen));
    }
  }
  return out;
}

/**
 * Canon-aware validation summary for ANY persisted AI-generated content
 * object, regardless of its type-specific shape. Deep-sweeps every string for
 * references and returns the same `{ refs, allValid, summary, counts }` shape
 * `validateAiSermon` produces, so the entity save gate can persist an honest
 * `scripture_validation` for Bible studies, quizzes, reading plans, ethics
 * analyses, study notes, etc. — not just sermons.
 *
 * `allValid` is strict in exactly the same way: only fully verse-verified
 * references count, so a 'chapter_checked' deuterocanon reference keeps the
 * record in a review-required state rather than passing as verified.
 */
export function validateAiContent(content, options = {}) {
  const refs = extractScriptureRefsDeep(content);
  const checked = validateScriptureRefs(refs, options);
  const allValid = checked.every((r) => r.status === 'valid');
  const problems = checked.filter((r) => r.status !== 'valid').length;
  const counts = checked.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const summary = problems === 0
    ? `${checked.length} reference(s) reviewed — all valid`
    : `${checked.length} reference(s) reviewed — ${problems} need attention`;
  return { refs: checked, allValid, summary, counts };
}

/**
 * High-level helper for an AI-generated sermon-shaped object. Sweeps the
 * anchor passage and every point's supporting scriptures, returns a
 * structured summary the UI can render and the entity layer can persist
 * as `scripture_validation`.
 *
 * `allValid` is strict: only fully verse-verified references count. A
 * 'chapter_checked' deuterocanon reference is real Scripture but still needs
 * source review, so it keeps the sermon in a review-required state rather
 * than silently passing as verified.
 */
export function validateAiSermon(sermon, options = {}) {
  // Deep-scan the WHOLE sermon object, not a hand-picked field list. Sermons
  // persist references across many prose fields — big_idea, theological_notes,
  // and each point's exegesis/application/illustration/text/supporting_scriptures
  // — and BOTH the entity publish gate and the share-link exposure gate validate
  // sermons through this function. A hand-picked list (previously only
  // anchor_passage, points[].supporting_scriptures, points[].text, conclusion)
  // let a fabricated reference in big_idea / theological_notes / a point's
  // exegesis pass as all-valid and be published + share-served. The shape-
  // agnostic deep sweep closes that blind spot and stays correct as the sermon
  // shape evolves.
  const checked = validateScriptureRefs(extractScriptureRefsDeep(sermon), options);
  const allValid = checked.every((r) => r.status === 'valid');
  const problems = checked.filter((r) => r.status !== 'valid').length;
  const counts = checked.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const summary = problems === 0
    ? `${checked.length} reference(s) reviewed — all valid`
    : `${checked.length} reference(s) reviewed — ${problems} need attention`;
  return { refs: checked, allValid, summary, counts };
}
