import AdmZip from 'adm-zip';
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';

import {
  buildStudyPdfFilename,
  buildStudyPptx,
  buildStudyPptxFilename,
  renderStudyPdf,
  studyToSlides,
} from './studyExport';

const STUDY = {
  title: 'Grace in John',
  topic: 'Incarnation',
  overview: 'John presents Jesus as the eternal Word made flesh.',
  key_verses: ['John 1:1', 'John 1:14'],
  study_sections: [{
    title: 'The Word Dwells With Us',
    scripture: 'John 1:14',
    insights: 'The dwelling language echoes the tabernacle.',
    questions: ['What does it mean for God to dwell with humanity?'],
    application: 'Practice presence with someone who is isolated.',
  }],
  conclusion: 'Grace and truth are embodied in Jesus.',
};

describe('study export', () => {
  it('turns every study field into pulpit-readable slides', () => {
    const content = JSON.stringify(studyToSlides(STUDY));
    for (const fragment of ['Grace in John', 'John 1:14', 'tabernacle', 'What does it mean', 'Practice presence', 'embodied']) {
      expect(content).toContain(fragment);
    }
  });

  it('builds a valid PPTX package containing the study content', async () => {
    const blob = buildStudyPptx(STUDY, { createdAt: '2026-08-25T12:00:00.000Z' });
    const zip = new AdmZip(Buffer.from(await blob.arrayBuffer()));
    const slideXml = zip.getEntries()
      .filter(({ entryName }) => /^ppt\/slides\/slide\d+\.xml$/u.test(entryName))
      .map((entry) => entry.getData().toString('utf8'))
      .join('\n');
    expect(zip.getEntry('ppt/presentation.xml')).toBeTruthy();
    expect(slideXml).toContain('The Word Dwells With Us');
    expect(slideXml).toContain('What does it mean');
  });

  it('renders a real PDF with the section content', async () => {
    const doc = await renderStudyPdf(STUDY);
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    const raw = String.fromCharCode(...bytes.slice(0, 5));
    expect(raw).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(2000);
  });

  it('uses safe filenames and rejects absent content', async () => {
    expect(buildStudyPdfFilename({ title: 'Grace / Truth?' })).toBe('Grace-Truth.pdf');
    expect(buildStudyPptxFilename({ title: 'Grace / Truth?' })).toBe('Grace-Truth.pptx');
    expect(() => buildStudyPptx(null)).toThrow(/no study/i);
    await expect(renderStudyPdf(null)).rejects.toThrow(/no study/i);
  });
});
