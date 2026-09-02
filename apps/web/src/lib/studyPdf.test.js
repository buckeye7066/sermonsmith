import { describe, expect, it } from 'vitest';
import { buildStudyFilename, renderStudyPdf } from './studyPdf';

function pdfText(doc) {
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  let output = '';
  for (const byte of bytes) output += String.fromCharCode(byte);
  return output;
}

const STUDY = {
  title: 'Grace & Discipleship',
  topic: 'Growing in grace',
  overview: 'A practical study of faithful formation.',
  key_verses: ['Ephesians 2:8-10'],
  study_sections: [{
    title: 'Grace forms us',
    scripture: 'Titus 2:11-12',
    insights: 'Grace trains, not merely pardons.',
    questions: ['Where is grace reshaping your habits?'],
    application: 'Choose one concrete practice for this week.',
  }],
  conclusion: 'Receive grace and walk in it.',
};

describe('study guide PDF export', () => {
  it('creates a real PDF containing the study content', async () => {
    const doc = await renderStudyPdf(STUDY);
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
    const raw = pdfText(doc);
    for (const fragment of ['Discipleship', 'Ephesians', 'Titus', 'habits', 'Receive']) {
      expect(raw).toContain(fragment);
    }
  });

  it('rejects an empty export and creates a safe filename', async () => {
    await expect(renderStudyPdf(null)).rejects.toThrow(/no study guide/i);
    expect(buildStudyFilename(STUDY)).toBe('Grace-Discipleship.pdf');
    expect(buildStudyFilename({})).toBe('bible-study.pdf');
  });
});
