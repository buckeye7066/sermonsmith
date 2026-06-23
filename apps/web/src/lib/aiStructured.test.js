import { describe, it, expect } from 'vitest';
import {
  asArray,
  asString,
  mergeUniqueStrings,
  normalizeSermon,
  normalizeSeriesOutline,
} from '@/lib/aiStructured';

describe('coercion helpers', () => {
  it('asArray only passes through arrays', () => {
    expect(asArray([1, 2])).toEqual([1, 2]);
    expect(asArray(null)).toEqual([]);
    expect(asArray('nope')).toEqual([]);
  });

  it('asString coerces with a fallback', () => {
    expect(asString('hi')).toBe('hi');
    expect(asString(null, 'fallback')).toBe('fallback');
    expect(asString(42)).toBe('42');
  });
});

describe('mergeUniqueStrings', () => {
  it('dedupes case-insensitively and trims', () => {
    expect(mergeUniqueStrings(['John 3:16', ' john 3:16 ', 'Romans 8:28'])).toEqual([
      'John 3:16',
      'Romans 8:28',
    ]);
  });

  it('drops empties and non-strings, merges multiple lists', () => {
    expect(mergeUniqueStrings(['a', '', null], ['b', 'a'])).toEqual(['a', 'b']);
  });
});

describe('normalizeSermon', () => {
  it('never crashes on a malformed payload and fills defaults', () => {
    const out = normalizeSermon({ points: 'not-an-array' }, { title: 'Fallback Title' });
    expect(Array.isArray(out.points)).toBe(true);
    expect(out.points).toHaveLength(0);
    expect(out.title).toBe('Fallback Title');
    expect(typeof out.conclusion).toBe('string');
  });

  it('normalizes points and dedupes their scriptures', () => {
    const out = normalizeSermon({
      title: 'Grace',
      points: [{ title: 'P1', supporting_scriptures: ['Eph 2:8', 'eph 2:8'] }],
    });
    expect(out.title).toBe('Grace');
    expect(out.points[0].supporting_scriptures).toEqual(['Eph 2:8']);
  });
});

describe('normalizeSeriesOutline', () => {
  it('clamps to the requested length and numbers weeks', () => {
    const out = normalizeSeriesOutline(
      { sermons: [{ title: 'W1' }, { title: 'W2' }, { title: 'W3' }] },
      2,
    );
    expect(out.sermons).toHaveLength(2);
    expect(out.sermons[0].week).toBe(1);
    expect(out.series_title).toBe('Untitled Series');
  });
});
