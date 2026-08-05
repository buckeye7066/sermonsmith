import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relativePath) => readFileSync(path.join(SRC, relativePath), 'utf8');

describe('public product claims', () => {
  it('does not publish invented testimonials or unsupported outcome claims', () => {
    const home = read('pages/Home.jsx');

    for (const unsupported of [
      'Pastor Michael Harper',
      'Sister Angela Ramirez',
      'Pastor Joel Simmons',
      'Join thousands',
      '10 hours weekly',
      'understands theology, context, and your congregation',
      'Works on all your devices',
      'created instantly',
      'Try It Live',
    ]) {
      expect(home, `unsupported Home claim: ${unsupported}`).not.toContain(unsupported);
    }

    expect(home).toContain('Built for Pastoral Review');
    expect(home).toContain('Your judgment stays final');
    expect(home).toContain('View Example Draft');
  });

  it('does not advertise unavailable exports or guaranteed translation catalogues', () => {
    const pricing = read('pages/Pricing.jsx');
    const downloads = read('pages/Downloads.jsx');
    const publicCopy = `${pricing}\n${downloads}`;

    for (const unsupported of [
      'PPTX',
      'Access to All Bible Translations',
      '50+ Languages',
      'ESV, NIV, NLT, NASB, MSG, AMP, NKJV',
      'All translations are ready to read instantly',
      'everything built-in',
    ]) {
      expect(publicCopy, `unsupported catalogue/export claim: ${unsupported}`).not.toContain(unsupported);
    }

    expect(publicCopy).toContain('configured source');
    expect(publicCopy).toContain('verify');
  });

  it('labels presentation coaching and AI Scripture suggestions honestly', () => {
    const presentation = read('components/sermon/PresentationMode.jsx');

    for (const unsupported of [
      'Larry is listening',
      'Simulate vocal analysis',
      'vocalFeedback',
      'setVocalFeedback',
      'verse.text',
      'Energy:',
    ]) {
      expect(presentation, `unsupported presentation behavior: ${unsupported}`).not.toContain(unsupported);
    }

    expect(presentation).toContain('no microphone or audio is used');
    expect(presentation).toContain('Based only on elapsed time and outline position');
    expect(presentation).toContain('Suggested reference only');
    expect(presentation).toContain('Do not quote, paraphrase, or translate verse text');
  });
});
