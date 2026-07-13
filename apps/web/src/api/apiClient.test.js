// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadClient() {
  vi.resetModules();
  return import('./apiClient.js');
}

function setElectronApiUrl(url) {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      isElectron: true,
      getApiUrl: vi.fn().mockResolvedValue(url),
    },
  });
}

describe('apiClient base URL resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    Reflect.deleteProperty(window, 'electron');
  });

  it('prefers an Electron-configured API URL and includes cookies', async () => {
    vi.stubEnv('VITE_API_URL', 'https://bundled.example');
    setElectronApiUrl('https://desktop.example///');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'u1' }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadClient();
    await api.auth.me();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://desktop.example/api/auth/me',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('falls back to VITE_API_URL when Electron has no configured URL', async () => {
    vi.stubEnv('VITE_API_URL', 'https://bundled.example/api/');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'u1' }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadClient();
    await api.auth.me();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://bundled.example/api/api/auth/me',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('falls back to the current origin when no API URL is configured', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'u1' }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadClient();
    await api.auth.me();

    expect(fetchMock).toHaveBeenCalledWith(
      `${window.location.origin}/api/auth/me`,
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('exposes account, community, and admin hardening helpers', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadClient();
    await api.auth.exportData();
    await api.auth.revokeSessions();
    await api.auth.deleteAccount();
    await api.community.report('shared 1', { category: 'spam', reason: 'duplicate' });
    await api.admin.aiAuditSummary(14);
    await api.admin.moderationQueue();
    await api.admin.moderateCommunityContent('SharedContent', 'shared 1', { status: 'removed' });

    const calls = fetchMock.mock.calls.map(([url, options]) => ({
      url,
      method: options.method || 'GET',
      body: options.body,
    }));

    expect(calls).toEqual([
      { url: 'https://api.example/api/auth/export', method: 'GET', body: undefined },
      { url: 'https://api.example/api/auth/revoke-sessions', method: 'POST', body: undefined },
      { url: 'https://api.example/api/auth/me', method: 'DELETE', body: undefined },
      {
        url: 'https://api.example/api/community/shared-content/shared%201/report',
        method: 'POST',
        body: JSON.stringify({ category: 'spam', reason: 'duplicate' }),
      },
      { url: 'https://api.example/api/ai/audit/summary?days=14', method: 'GET', body: undefined },
      { url: 'https://api.example/api/community/moderation/queue', method: 'GET', body: undefined },
      {
        url: 'https://api.example/api/community/moderation/SharedContent/shared%201',
        method: 'PATCH',
        body: JSON.stringify({ status: 'removed' }),
      },
    ]);
  });
});


describe('StreamLLM result-trailer contract', () => {
  const RS = String.fromCharCode(0x1e);

  function streamResponse(text) {
    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('opts in with stream_result, strips the trailer, and resolves the clean text', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const payload = '{"title":"Grace"}';
    const fetchMock = vi.fn().mockResolvedValue(streamResponse(payload + '\n' + RS + '{"ok":true,"truncated":false}'));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadClient();
    const deltas = [];
    const text = await api.integrations.Core.StreamLLM({ prompt: 'p' }, (full) => deltas.push(full));

    expect(text).toBe(payload);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.stream_result).toBe(true);
    // The trailer must never leak into the live preview.
    for (const d of deltas) expect(d.includes(RS)).toBe(false);
  });

  it('throws (status 502) when the server reports the final JSON did not parse', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const fetchMock = vi.fn().mockResolvedValue(streamResponse('{"cut": [' + '\n' + RS + '{"ok":false,"truncated":true}'));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadClient();
    await expect(api.integrations.Core.StreamLLM({ prompt: 'p' })).rejects.toMatchObject({
      status: 502,
      truncated: true,
    });
  });

  it('legacy servers without a trailer pass the raw text through unchanged', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const fetchMock = vi.fn().mockResolvedValue(streamResponse('{"legacy":true}'));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadClient();
    const text = await api.integrations.Core.StreamLLM({ prompt: 'p' });
    expect(text).toBe('{"legacy":true}');
  });
});
