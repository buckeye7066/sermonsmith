import { describe, expect, it } from 'vitest';
import {
  buildVerseWordingResult,
  compareQuotedWording,
  normalizeVerseText,
} from '../services/verseWording.js';

describe('verse wording verification', () => {
  it('normalizes punctuation and case without inventing words', () => {
    expect(normalizeVerseText('  “For God so loved the world,”  ')).toBe(
      'for god so loved the world',
    );
  });

  it('flags a valid reference shape when quoted wording is wrong', () => {
    const provider =
      'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.';
    const result = buildVerseWordingResult({
      reference: 'John 3:16',
      translationId: 'kjv',
      quotedText: 'God is love and nothing else matters.',
      providerText: provider,
    });

    expect(result.reference).toBe('John 3:16');
    expect(result.status).toBe('mismatch');
    expect(result.message).toMatch(/does not match the registered provider text/i);
  });

  it('accepts provider-sourced wording for the same valid reference', () => {
    const provider =
      'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.';
    const comparison = compareQuotedWording(
      'For God so loved the world, that he gave his only begotten Son',
      provider,
    );
    expect(comparison.status).toBe('match');
  });
});
