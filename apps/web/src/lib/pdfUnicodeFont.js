import dejaVuSansDataUrl from '../assets/fonts/DejaVuSans.ttf?inline';

export const PDF_FONT_FAMILY = 'DejaVu Sans';
const PDF_FONT_FILENAME = 'DejaVuSans.ttf';

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

/** Select DejaVu Sans for source-language runs and a compact built-in face otherwise. */
export function selectPdfFont(doc, value, style = 'normal') {
  if (requiresUnicodePdfFont(value)) {
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    return PDF_FONT_FAMILY;
  }
  doc.setFont('helvetica', style);
  return 'helvetica';
}
