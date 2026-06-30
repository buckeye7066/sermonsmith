import { describe, it, expect } from 'vitest';
import { coerceToSchema, toDisplayText } from './aiStructured';
import { resolveDenominationProfile, denominationPromptBlock, DENOMINATION_OPTIONS } from './denominations';

describe('toDisplayText', () => {
  it('passes strings/numbers through', () => {
    expect(toDisplayText('hello')).toBe('hello');
    expect(toDisplayText(42)).toBe('42');
  });

  it('never returns a raw object (the React #31 trigger)', () => {
    const out = toDisplayText({ falun_gong: 'a', tenrikyo: 'b' });
    expect(typeof out).toBe('string');
    expect(out).toContain('Falun gong: a');
    expect(out).toContain('Tenrikyo: b');
  });

  it('flattens arrays and nulls safely', () => {
    expect(toDisplayText(['a', null, 'b'])).toBe('a\nb');
    expect(toDisplayText(null)).toBe('');
    expect(toDisplayText(undefined)).toBe('');
  });
});

describe('coerceToSchema', () => {
  it('forces a string field that arrived as an object into text', () => {
    const schema = { type: 'object', properties: { definition: { type: 'string' } } };
    const out = coerceToSchema({ definition: { short: 'x', long: 'y' } }, schema);
    expect(typeof out.definition).toBe('string');
    expect(out.definition).toContain('x');
  });

  it('wraps a scalar into an array when the schema wants an array', () => {
    const schema = { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } } };
    const out = coerceToSchema({ tags: 'solo' }, schema);
    expect(out.tags).toEqual(['solo']);
  });

  it('coerces array items that should be strings', () => {
    const schema = { type: 'array', items: { type: 'string' } };
    expect(coerceToSchema([{ a: 1 }, 'ok'], schema)).toEqual(['A: 1', 'ok']);
  });

  it('preserves extra properties not named in the schema', () => {
    const schema = { type: 'object', properties: { title: { type: 'string' } } };
    const out = coerceToSchema({ title: 'T', extra: 'keep' }, schema);
    expect(out.extra).toBe('keep');
  });

  it('passes the value through when there is no schema', () => {
    const v = { anything: true };
    expect(coerceToSchema(v, undefined)).toBe(v);
  });
});

describe('resolveDenominationProfile', () => {
  it('resolves a family name', () => {
    expect(resolveDenominationProfile('Reformed').id).toBe('reformed');
  });

  it('resolves a specific body to its family profile', () => {
    expect(resolveDenominationProfile('Southern Baptist').id).toBe('baptist');
    expect(resolveDenominationProfile('Assemblies of God').id).toBe('pentecostal');
  });

  it('prefers the most specific alias (reformed baptist → reformed)', () => {
    expect(resolveDenominationProfile('Reformed Baptist').id).toBe('reformed');
  });

  it('falls back to non-denominational for empty input', () => {
    expect(resolveDenominationProfile('').id).toBe('nondenom');
  });

  it('keeps an unknown tradition label while using the ecumenical profile', () => {
    const p = resolveDenominationProfile('Swedenborgian New Church');
    expect(p.name).toBe('Swedenborgian New Church');
    expect(p.authority).toBeTruthy();
  });

  it('still substring-matches a related family (Coptic Orthodox → Orthodox)', () => {
    expect(resolveDenominationProfile('Coptic Orthodox Tewahedo').id).toBe('orthodox');
  });
});

describe('denominationPromptBlock', () => {
  it('names the tradition and includes its distinctives', () => {
    const block = denominationPromptBlock('Lutheran');
    expect(block).toContain('Lutheran');
    expect(block).toMatch(/Law and Gospel/i);
    expect(block).toMatch(/write the sermon from INSIDE this tradition/i);
  });

  it('every curated dropdown option resolves to a usable profile', () => {
    for (const opt of DENOMINATION_OPTIONS) {
      const p = resolveDenominationProfile(opt);
      expect(p.summary).toBeTruthy();
      expect(p.preaching).toBeTruthy();
    }
  });
});
