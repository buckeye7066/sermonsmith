import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob, saveExportFile } from './downloadBlob';

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

  it('uses the browser download path outside a native runtime', async () => {
    const browserDownload = vi.fn();
    const blob = new Blob(['study']);
    await expect(saveExportFile(blob, 'study.pdf', { native: false, browserDownload }))
      .resolves.toEqual({ filename: 'study.pdf', method: 'browser-download' });
    expect(browserDownload).toHaveBeenCalledWith(blob, 'study.pdf');
  });

  it('writes and shares a native file instead of clicking a browser anchor', async () => {
    const filesystem = {
      writeFile: vi.fn().mockResolvedValue({}),
      getUri: vi.fn().mockResolvedValue({ uri: 'content://exports/sermon.pptx' }),
    };
    const share = { share: vi.fn().mockResolvedValue({}) };
    const browserDownload = vi.fn();
    const blob = new Blob(['deck'], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });

    const result = await saveExportFile(blob, 'sermon.pptx', {
      native: true,
      filesystem,
      share,
      directory: 'CACHE',
      browserDownload,
    });

    expect(result).toEqual({
      filename: 'sermon.pptx',
      method: 'native-file-share',
      uri: 'content://exports/sermon.pptx',
    });
    expect(filesystem.writeFile).toHaveBeenCalledWith(expect.objectContaining({
      path: 'exports/sermon.pptx',
      directory: 'CACHE',
      recursive: true,
      data: 'ZGVjaw==',
    }));
    expect(share.share).toHaveBeenCalledWith(expect.objectContaining({
      files: ['content://exports/sermon.pptx'],
    }));
    expect(browserDownload).not.toHaveBeenCalled();
  });
});
