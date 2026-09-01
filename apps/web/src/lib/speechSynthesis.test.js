import { describe, expect, it, vi } from 'vitest';
import { readAvailableVoices, resolveSpeechSynthesis } from './speechSynthesis';

function usableSynthesis(overrides = {}) {
  return {
    getVoices: vi.fn(() => []),
    cancel: vi.fn(),
    speak: vi.fn(),
    ...overrides,
  };
}

describe('resolveSpeechSynthesis', () => {
  it('returns null without touching a voice getter when the API is absent', () => {
    const getVoices = vi.fn();
    expect(resolveSpeechSynthesis({ unrelated: { getVoices } })).toBeNull();
    expect(getVoices).not.toHaveBeenCalled();
  });

  it('returns a complete speech synthesis implementation', () => {
    const synthesis = usableSynthesis();
    expect(resolveSpeechSynthesis({ speechSynthesis: synthesis })).toBe(synthesis);
  });

  it('fails closed when access to speechSynthesis throws', () => {
    const scope = {};
    Object.defineProperty(scope, 'speechSynthesis', {
      get() {
        throw new Error('blocked by browser policy');
      },
    });

    expect(resolveSpeechSynthesis(scope)).toBeNull();
  });

  it.each(['getVoices', 'cancel', 'speak'])(
    'rejects an implementation missing %s',
    (method) => {
      const synthesis = usableSynthesis({ [method]: undefined });
      expect(resolveSpeechSynthesis({ speechSynthesis: synthesis })).toBeNull();
    }
  );
});

describe('readAvailableVoices', () => {
  it('returns the browser voice array', () => {
    const voices = [{ name: 'Test Voice', lang: 'en-US' }];
    expect(readAvailableVoices(usableSynthesis({ getVoices: () => voices }))).toBe(voices);
  });

  it('returns an empty list when voice discovery throws', () => {
    const synthesis = usableSynthesis({
      getVoices() {
        throw new Error('voice service not ready');
      },
    });
    expect(readAvailableVoices(synthesis)).toEqual([]);
  });

  it('rejects non-array browser responses', () => {
    expect(readAvailableVoices(usableSynthesis({ getVoices: () => null }))).toEqual([]);
  });
});
