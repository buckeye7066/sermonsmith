import AdmZip from 'adm-zip';
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';

import {
  buildSermonPptx,
  buildSermonPptxFilename,
  PPTX_BODY_LINE_BUDGET,
  sermonToSlides,
  slideBodyLineCount,
} from './sermonPptx';

const SERMON = {
  title: 'Grace & Truth <Together>',
  anchor_passage: 'John 1:14',
  big_idea: 'Grace and truth arrive together in Jesus.',
  introduction: 'We do not have to choose kindness over conviction.',
  points: [{
    title: 'The Word Became Flesh',
    exegesis: 'John places the eternal Word in a real human body.',
    illustration: 'A letter becomes a visit.',
    application: 'Move toward the person you are tempted to discuss from a distance.',
    supporting_scriptures: ['John 1:1', { reference: 'Philippians 2:7' }],
  }],
  conclusion: 'Receive grace and walk in truth.',
  discussion_questions: ['Where do you separate grace from truth?'],
};

async function openDeck(sermon = SERMON) {
  const blob = buildSermonPptx(sermon, { createdAt: '2026-08-25T12:00:00.000Z' });
  return { blob, zip: new AdmZip(Buffer.from(await blob.arrayBuffer())) };
}

describe('buildSermonPptx', () => {
  it('creates a real Open XML presentation with every required relationship', async () => {
    const { blob, zip } = await openDeck();
    const names = zip.getEntries().map((entry) => entry.entryName);
    const slideCount = sermonToSlides(SERMON).length;

    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    expect(blob.size).toBeGreaterThan(4000);
    expect(names).toEqual(expect.arrayContaining([
      '[Content_Types].xml',
      '_rels/.rels',
      'ppt/presentation.xml',
      'ppt/_rels/presentation.xml.rels',
      'ppt/slideMasters/slideMaster1.xml',
      'ppt/slideLayouts/slideLayout1.xml',
      'ppt/theme/theme1.xml',
      `ppt/slides/slide${slideCount}.xml`,
      `ppt/slides/_rels/slide${slideCount}.xml.rels`,
    ]));
  });

  it('writes sermon content and escapes XML-significant title characters', async () => {
    const { zip } = await openDeck();
    const xml = zip.getEntries()
      .filter(({ entryName }) => /^ppt\/slides\/slide\d+\.xml$/u.test(entryName))
      .map((entry) => entry.getData().toString('utf8'))
      .join('\n');

    for (const fragment of ['Grace &amp; Truth &lt;Together&gt;', 'John 1:14', 'The Word Became Flesh', 'Philippians 2:7', 'Discussion Questions']) {
      expect(xml).toContain(fragment);
    }
  });

  it('puts at least one DrawingML paragraph in every text body', async () => {
    const { zip } = await openDeck({ title: 'Sparse', points: [{ title: 'Empty point' }] });
    const xml = zip.getEntries()
      .filter(({ entryName }) => /^ppt\/slides\/slide\d+\.xml$/u.test(entryName))
      .map((entry) => entry.getData().toString('utf8'))
      .join('\n');
    const textBodies = xml.match(/<p:txBody>[\s\S]*?<\/p:txBody>/gu) || [];
    expect(textBodies.length).toBeGreaterThan(0);
    expect(textBodies.every((body) => body.includes('<a:p>'))).toBe(true);
  });

  it('paginates long point content instead of overflowing one slide', () => {
    const long = 'A deliberately long pastoral sentence. '.repeat(90);
    const slides = sermonToSlides({ title: 'Long', points: [{ title: 'Point', exegesis: long }] });
    expect(slides.filter(({ title }) => title.includes('Point')).length).toBeGreaterThan(1);
    expect(slides.every((slide) => slideBodyLineCount(slide) <= PPTX_BODY_LINE_BUDGET)).toBe(true);
  });

  it('survives a sparse sermon and refuses an absent one', async () => {
    const { zip } = await openDeck({ title: 'Untitled', points: [] });
    expect(zip.getEntry('ppt/slides/slide1.xml')).toBeTruthy();
    expect(() => buildSermonPptx(null)).toThrow(/no sermon/i);
  });

  it('builds a filesystem-safe filename', () => {
    expect(buildSermonPptxFilename({ title: 'Grace / Peace: 2026?' })).toBe('Grace-Peace-2026.pptx');
    expect(buildSermonPptxFilename({})).toBe('sermon.pptx');
  });
});
