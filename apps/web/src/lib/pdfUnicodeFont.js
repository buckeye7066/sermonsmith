import dejaVuSansDataUrl from '../assets/fonts/DejaVuSans.ttf?inline';

export const PDF_FONT_FAMILY = 'DejaVu Sans';
const PDF_FONT_FILENAME = 'DejaVuSans.ttf';

// Derived from the bundled face's cmap. Keeping the accepted boundary here
// prevents jsPDF from silently emitting empty boxes for scripts the embedded
// font does not contain (notably CJK) while preserving Greek and Hebrew.
const SUPPORTED_DEJAVU_SANS_RANGES = Object.freeze([
  [0x20, 0x7e], [0xa0, 0x24f], [0x300, 0x34f], [0x351, 0x353],
  [0x357, 0x358], [0x35a, 0x35a], [0x35c, 0x362], [0x370, 0x377],
  [0x37a, 0x37f], [0x384, 0x38a], [0x38c, 0x38c], [0x38e, 0x3a1],
  [0x3a3, 0x3ff], [0x5b0, 0x5c3], [0x5c6, 0x5c7], [0x5d0, 0x5ea],
  [0x5f0, 0x5f4], [0x1e00, 0x1efb], [0x1f00, 0x1f15], [0x1f18, 0x1f1d],
  [0x1f20, 0x1f45], [0x1f48, 0x1f4d], [0x1f50, 0x1f57], [0x1f59, 0x1f59],
  [0x1f5b, 0x1f5b], [0x1f5d, 0x1f5d], [0x1f5f, 0x1f7d], [0x1f80, 0x1fb4],
  [0x1fb6, 0x1fc4], [0x1fc6, 0x1fd3], [0x1fd6, 0x1fdb], [0x1fdd, 0x1fef],
  [0x1ff2, 0x1ff4], [0x1ff6, 0x1ffe], [0x2000, 0x2064], [0x206a, 0x206f],
  [0x20a0, 0x20b5], [0x20b8, 0x20ba], [0x20bd, 0x20bd], [0x2100, 0x2109],
  [0x210b, 0x2149], [0x214b, 0x214b], [0x214e, 0x214e], [0x2190, 0x21ff],
  [0x25a0, 0x25ff], [0xfb1d, 0xfb36], [0xfb38, 0xfb3c], [0xfb3e, 0xfb3e],
  [0xfb40, 0xfb41], [0xfb43, 0xfb44], [0xfb46, 0xfb4f],
]);

// jsPDF renders text runs in visual order. These options ask its bundled
// Unicode bidi engine to convert ordinary logical-order input first, which
// keeps Hebrew runs readable without changing left-to-right prose.
export const PDF_UNICODE_TEXT_OPTIONS = Object.freeze({
  isInputVisual: false,
  isOutputVisual: true,
  isOutputRtl: false,
});

function embeddedFontBase64() {
  const separator = dejaVuSansDataUrl.indexOf(',');
  if (separator < 0) throw new Error('The embedded PDF font could not be loaded.');
  return dejaVuSansDataUrl.slice(separator + 1);
}

/**
 * Install the bundled DejaVu Sans TTF into one jsPDF document. DejaVu Sans is
 * licensed for redistribution (see the adjacent license file) and covers the
 * Greek and Hebrew text commonly used in sermon and Bible-study material.
 * The face is registered once and selected only for text that needs Unicode
 * coverage. Ordinary Latin text keeps jsPDF's compact built-in font.
 */
export function installUnicodePdfFont(doc) {
  if (!doc || typeof doc.addFileToVFS !== 'function' || typeof doc.addFont !== 'function') {
    throw new Error('PDF font installation requires a jsPDF document.');
  }

  if (!doc.existsFileInVFS?.(PDF_FONT_FILENAME)) {
    doc.addFileToVFS(PDF_FONT_FILENAME, embeddedFontBase64());
  }
  const registered = new Set(doc.getFontList?.()[PDF_FONT_FAMILY] || []);
  if (!registered.has('normal')) doc.addFont(PDF_FONT_FILENAME, PDF_FONT_FAMILY, 'normal');
  return PDF_FONT_FAMILY;
}

export function requiresUnicodePdfFont(value) {
  return [...String(value ?? '')].some((character) => character.codePointAt(0) > 0xff);
}

function isSupportedPdfCodePoint(codePoint) {
  if (codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d) return true;
  return SUPPORTED_DEJAVU_SANS_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
}

export function unsupportedPdfCodePoints(value) {
  return [...new Set(
    [...String(value ?? '')]
      .map((character) => character.codePointAt(0))
      .filter((codePoint) => !isSupportedPdfCodePoint(codePoint)),
  )];
}

export function assertPdfTextSupported(value) {
  const unsupported = unsupportedPdfCodePoints(value);
  if (unsupported.length === 0) return;
  const labels = unsupported.slice(0, 8)
    .map((codePoint) => `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`)
    .join(', ');
  throw new Error(
    `PDF export supports Latin, Greek, Hebrew, and the punctuation and symbols in the bundled font. Unsupported characters: ${labels}.`,
  );
}

/** Select DejaVu Sans for source-language runs and a compact built-in face otherwise. */
export function selectPdfFont(doc, value, style = 'normal') {
  assertPdfTextSupported(value);
  if (requiresUnicodePdfFont(value)) {
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    return PDF_FONT_FAMILY;
  }
  doc.setFont('helvetica', style);
  return 'helvetica';
}
