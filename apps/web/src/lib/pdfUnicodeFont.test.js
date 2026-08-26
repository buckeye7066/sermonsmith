import { describe, expect, it } from 'vitest';

import {
  installUnicodePdfFont,
  PDF_FONT_FAMILY,
  PDF_UNICODE_TEXT_OPTIONS,
  selectPdfFont,
} from './pdfUnicodeFont';

describe('Unicode PDF font', () => {
  it('embeds a licensed font with Greek and Hebrew glyph coverage', async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    installUnicodePdfFont(doc);
    selectPdfFont(doc, 'χάρις · חֶסֶד');
    doc.text('χάρις · חֶסֶד', 20, 20, PDF_UNICODE_TEXT_OPTIONS);

    expect(doc.getFontList()[PDF_FONT_FAMILY]).toEqual(expect.arrayContaining([
      'normal',
    ]));
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    const raw = new TextDecoder('latin1').decode(bytes);
    expect(raw).toContain('/ToUnicode');
    expect(bytes.byteLength).toBeGreaterThan(10_000);
  });
});
