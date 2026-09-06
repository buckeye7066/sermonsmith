import { describe, it, expect } from 'vitest';
import { renderSermonPdf, buildSermonFilename } from './sermonPdf';

/**
 * The export path used to POST to a stubbed backend endpoint and wrap its JSON
 * reply in a Blob, so the download was an unopenable file while the UI showed a
 * success toast. A test that only checked "export resolved without throwing"
 * would have passed throughout. These assertions therefore look inside the
 * produced document for the sermon's actual content.
 */

const SERMON = {
  title: 'The Weight of Mercy',
  anchor_passage: 'Micah 6:8',
  big_idea: 'Mercy is not weakness; it is strength under covenant.',
  points: [
    {
      title: 'Mercy Requires Sight',
      exegesis: 'The Hebrew hesed binds covenant loyalty to compassion.',
      illustration: 'A judge who pays the fine he just imposed.',
      application: 'Name one person you have avoided this month, and call them.',
      supporting_scriptures: ['Hosea 6:6', { reference: 'Luke 10:37' }],
    },
    {
      title: 'Mercy Requires Cost',
      exegesis: 'Sacrifice language frames mercy as expenditure, not sentiment.',
      supporting_scriptures: [],
    },
  ],
  conclusion: 'Walk humbly, and mercy will not feel like loss.',
};

/**
 * jsPDF emits uncompressed literal strings into the page content stream, so the
 * document bytes can be read back as latin1 and searched directly. This is what
 * makes it possible to assert on what the reader will actually see.
 */
function pdfText(doc) {
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

describe('renderSermonPdf', () => {
  it('produces a real PDF document, not a wrapped JSON payload', async () => {
    const doc = await renderSermonPdf(SERMON);
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    const header = String.fromCharCode(...bytes.slice(0, 5));

    expect(header).toBe('%PDF-');
    // A stubbed JSON reply is a few hundred bytes; a rendered sermon is not.
    expect(bytes.byteLength).toBeGreaterThan(2000);
    expect(doc.internal.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('writes the sermon title, big idea, points and conclusion into the document', async () => {
    const doc = await renderSermonPdf(SERMON);
    const raw = pdfText(doc);

    // Text is emitted per line, so assert on distinctive fragments that survive
    // jsPDF's line wrapping rather than whole sentences.
    for (const fragment of ['Weight', 'Mercy', 'Micah', 'Hosea', 'humbly']) {
      expect(raw).toContain(fragment);
    }
  });

  it('renders object-shaped and string-shaped scripture references alike', async () => {
    const doc = await renderSermonPdf(SERMON);
    const raw = pdfText(doc);
    expect(raw).toContain('Hosea 6:6');
    expect(raw).toContain('Luke 10:37');
  });

  it('survives a sparse sermon without throwing', async () => {
    const doc = await renderSermonPdf({ title: 'Untitled', points: [] });
    expect(doc.internal.getNumberOfPages()).toBe(1);
  });

  it('preserves Greek and Hebrew source-language notes', async () => {
    const doc = await renderSermonPdf({
      title: 'χάρις וֶאֱמֶת',
      theological_notes: 'λόγος · בְּרֵאשִׁית',
      points: [],
    });
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    const raw = new TextDecoder('latin1').decode(bytes);
    expect(raw).toContain('/ToUnicode');
    expect(bytes.byteLength).toBeGreaterThan(10_000);
  });

  it('refuses to export nothing', async () => {
    await expect(renderSermonPdf(null)).rejects.toThrow(/no sermon/i);
  });

  it('builds a filesystem-safe filename from the title', () => {
    expect(buildSermonFilename({ title: 'The Weight of Mercy' })).toBe('The-Weight-of-Mercy.pdf');
    expect(buildSermonFilename({ title: 'Grace / Peace: 2026?' })).toBe('Grace-Peace-2026.pdf');
    expect(buildSermonFilename({})).toBe('sermon.pdf');
  });
});
