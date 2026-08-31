import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from './downloadBlob';

afterEach(() => {
  vi.useRealTimers();
});

describe('downloadBlob', () => {
  it('keeps the object URL alive long enough for WebKit to consume the click', () => {
    vi.useFakeTimers();
    const anchor = { click: vi.fn(), remove: vi.fn() };
    const documentObject = {
      body: { appendChild: vi.fn() },
      createElement: vi.fn(() => anchor),
    };
    const urlApi = {
      createObjectURL: vi.fn(() => 'blob:sermonsmith-export'),
      revokeObjectURL: vi.fn(),
    };

    const objectUrl = downloadBlob(new Blob(['study']), 'study.pdf', {
      documentObject,
      urlApi,
    });

    expect(objectUrl).toBe('blob:sermonsmith-export');
    expect(anchor).toMatchObject({ href: objectUrl, download: 'study.pdf' });
    expect(documentObject.body.appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(urlApi.revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  it('still schedules cleanup when the synthetic click throws', () => {
    vi.useFakeTimers();
    const anchor = { click: vi.fn(() => { throw new Error('blocked'); }), remove: vi.fn() };
    const urlApi = {
      createObjectURL: vi.fn(() => 'blob:blocked-export'),
      revokeObjectURL: vi.fn(),
    };

    expect(() => downloadBlob(new Blob(['study']), 'study.pdf', {
      documentObject: { body: { appendChild: vi.fn() }, createElement: () => anchor },
      urlApi,
    })).toThrow('blocked');

    expect(anchor.remove).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:blocked-export');
  });
});
