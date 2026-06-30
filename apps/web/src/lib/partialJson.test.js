import { describe, it, expect } from 'vitest';
import { parsePartialJson } from './partialJson';

describe('parsePartialJson', () => {
  it('parses complete JSON', () => {
    expect(parsePartialJson('{"title":"Grace","points":[1,2]}')).toEqual({ title: 'Grace', points: [1, 2] });
  });

  it('strips a ```json fence', () => {
    expect(parsePartialJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parsePartialJson('```json\n{"a":1}')).toEqual({ a: 1 }); // fence not yet closed
  });

  it('recovers a value mid-string (renders the title as it is typed)', () => {
    const out = parsePartialJson('{"title":"Grace and Forgive');
    expect(out).toEqual({ title: 'Grace and Forgive' });
  });

  it('closes an unfinished nested object/array', () => {
    const out = parsePartialJson('{"title":"T","points":[{"title":"Point 1","exegesis":"In Christ');
    expect(out.title).toBe('T');
    expect(Array.isArray(out.points)).toBe(true);
    expect(out.points[0].title).toBe('Point 1');
    expect(out.points[0].exegesis).toBe('In Christ');
  });

  it('drops a trailing comma / dangling key with no value', () => {
    expect(parsePartialJson('{"a":1,')).toEqual({ a: 1 });
    expect(parsePartialJson('{"a":1,"b":').a).toBe(1); // b has no value yet → dropped
  });

  it('returns null for non-JSON / empty input', () => {
    expect(parsePartialJson('')).toBeNull();
    expect(parsePartialJson('Larry is thinking')).toBeNull();
    expect(parsePartialJson(undefined)).toBeNull();
  });

  it('handles escaped quotes inside strings', () => {
    expect(parsePartialJson('{"quote":"He said \\"grace\\""}')).toEqual({ quote: 'He said "grace"' });
  });
});
