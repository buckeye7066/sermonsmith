import { describe, expect, it, vi } from 'vitest';
import { buildStudyFilename, persistStudyPdf, renderStudyPdf } from './studyPdf';

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

  it('uses the Electron save bridge and honors a canceled save dialog', async () => {
    const doc = { output: vi.fn(() => 'data:application/pdf;base64,JVBERi0=') };
    const savePdf = vi.fn().mockResolvedValue({ success: true, fileName: 'saved-study.pdf' });
    await expect(persistStudyPdf(doc, 'study.pdf', {
      electron: { isElectron: true, savePdf }, native: false,
    })).resolves.toBe('saved-study.pdf');
    expect(savePdf).toHaveBeenCalledWith({ filename: 'study.pdf', data: 'JVBERi0=' });

    savePdf.mockResolvedValueOnce({ canceled: true });
    await expect(persistStudyPdf(doc, 'study.pdf', {
      electron: { isElectron: true, savePdf }, native: false,
    })).resolves.toBeNull();
  });

  it('writes a durable Capacitor document and offers its cache copy to the native share sheet', async () => {
    const doc = { output: vi.fn(() => 'data:application/pdf;base64,JVBERi0=') };
    const Filesystem = {
      checkPermissions: vi.fn().mockResolvedValue({ publicStorage: 'granted' }),
      requestPermissions: vi.fn(),
      writeFile: vi.fn()
        .mockResolvedValueOnce({ uri: 'file:///documents/study.pdf' })
        .mockResolvedValueOnce({ uri: 'file:///cache/study.pdf' }),
    };
    const Share = {
      canShare: vi.fn().mockResolvedValue({ value: true }),
      share: vi.fn().mockResolvedValue({ activityType: '' }),
    };

    await expect(persistStudyPdf(doc, 'study.pdf', {
      electron: null,
      native: true,
      loadFilesystem: async () => ({ Filesystem, Directory: { Documents: 'DOCUMENTS', Cache: 'CACHE' } }),
      loadShare: async () => ({ Share }),
    })).resolves.toBe('study.pdf');

    expect(Filesystem.writeFile).toHaveBeenNthCalledWith(1, {
      path: 'study.pdf', data: 'JVBERi0=', directory: 'DOCUMENTS',
    });
    expect(Filesystem.writeFile).toHaveBeenNthCalledWith(2, {
      path: 'study.pdf', data: 'JVBERi0=', directory: 'CACHE',
    });
    expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({ files: ['file:///cache/study.pdf'] }));
  });
});
