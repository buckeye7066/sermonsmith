import { describe, it, expect } from 'vitest';
import {
  extractScriptureRefs,
  validateScriptureRefs,
  validateAiSermon,
} from '@/lib/scriptureRefs';

describe('extractScriptureRefs', () => {
  it('pulls references out of prose', () => {
    const refs = extractScriptureRefs('As John 3:16 says, and again in Romans 8:28-30 we read.');
    expect(refs).toContain('John 3:16');
    expect(refs.some((r) => r.startsWith('Romans 8:28'))).toBe(true);
  });

  it('handles empty / nullish input', () => {
    expect(extractScriptureRefs('')).toEqual([]);
    expect(extractScriptureRefs(null)).toEqual([]);
  });
});

describe('validateScriptureRefs', () => {
  it('accepts a valid reference', () => {
    const [r] = validateScriptureRefs(['John 3:16']);
    expect(r.status).toBe('valid');
    expect(r.validBook).toBe(true);
    expect(r.chapter).toBe(3);
    expect(r.verse).toBe(16);
  });

  it('flags a made-up book', () => {
    const [r] = validateScriptureRefs(['Hezekiah 4:5']);
    expect(r.status).toBe('invalid_book');
    expect(r.validBook).toBe(false);
  });

  it('flags an impossible chapter (John has 21)', () => {
    const [r] = validateScriptureRefs(['John 99:99']);
    expect(r.validBook).toBe(true);
    expect(r.status).toBe('out_of_range');
  });

  it('flags an absurd verse (> Psalm 119:176)', () => {
    const [r] = validateScriptureRefs(['Genesis 1:9000']);
    expect(r.status).toBe('out_of_range');
  });

  it('accepts single-chapter books like Jude', () => {
    const [r] = validateScriptureRefs(['Jude 1:5']);
    expect(r.status).toBe('valid');
  });

  it('accepts book aliases (Psalm == Psalms)', () => {
    const [r] = validateScriptureRefs(['Psalm 119:105']);
    expect(r.status).toBe('valid');
  });
});

describe('validateAiSermon', () => {
  it('summarises a clean sermon as all-valid', () => {
    const out = validateAiSermon({
      anchor_passage: 'John 3:16',
      points: [{ supporting_scriptures: ['Romans 8:28'], text: '' }],
      conclusion: 'Ephesians 2:8',
    });
    expect(out.allValid).toBe(true);
    expect(out.summary).toMatch(/all valid/);
  });

  it('catches a hallucinated reference and reports it needs attention', () => {
    const out = validateAiSermon({
      anchor_passage: 'John 99:1',
      points: [],
      conclusion: '',
    });
    expect(out.allValid).toBe(false);
    expect(out.summary).toMatch(/need attention/);
  });
});
