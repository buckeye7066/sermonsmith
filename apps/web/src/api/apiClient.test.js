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
    await api.auth.deleteUser('user 1');
    await api.auth.setUserBanned('user 1', true);
    await api.functions.shareLinks('resource 1');
    await api.functions.revokeShareableLink('link 1');
    await api.community.report('shared 1', { category: 'spam', reason: 'duplicate' });
    await api.community.reportPost('post 1', { category: 'abuse' });
    await api.community.reportPostReply('post 1', 'reply 1', { category: 'privacy' });
    await api.community.myForumContent();
    await api.community.myRatings();
    await api.community.deleteRating('rating 1');
    await api.community.mySharedSeries();
    await api.community.unshareSeries('series 1');
    await api.community.mySharedContent();
    await api.community.withdrawSharedContent('shared 1');
    await api.community.myPublicReadingPlans();
    await api.community.withdrawReadingPlan('plan 1');
    await api.community.myComments();
    await api.community.mySharedSermonPage();
    await api.community.myStudyGroups();
    await api.community.deletePostReply('post 1', 'reply 1');
    await api.community.deletePost('post 1');
    await api.community.removeStudyGroupMember('group 1', 'member 1');
    await api.community.deleteGroupMessage('group 1', 'message 1');
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
      { url: 'https://api.example/api/auth/users/user%201', method: 'DELETE', body: undefined },
      {
        url: 'https://api.example/api/auth/users/user%201/ban',
        method: 'PATCH',
        body: JSON.stringify({ banned: true }),
      },
      { url: 'https://api.example/api/functions/share-links?resourceId=resource%201', method: 'GET', body: undefined },
      { url: 'https://api.example/api/functions/share-links/link%201', method: 'DELETE', body: undefined },
      {
        url: 'https://api.example/api/community/shared-content/shared%201/report',
        method: 'POST',
        body: JSON.stringify({ category: 'spam', reason: 'duplicate' }),
      },
      {
        url: 'https://api.example/api/community/posts/post%201/report',
        method: 'POST',
        body: JSON.stringify({ category: 'abuse' }),
      },
      {
        url: 'https://api.example/api/community/posts/post%201/replies/reply%201/report',
        method: 'POST',
        body: JSON.stringify({ category: 'privacy' }),
      },
      { url: 'https://api.example/api/community/posts/mine?offset=0&limit=100', method: 'GET', body: undefined },
      { url: 'https://api.example/api/community/ratings/mine?offset=0&limit=100', method: 'GET', body: undefined },
      { url: 'https://api.example/api/community/ratings/rating%201', method: 'DELETE', body: undefined },
      { url: 'https://api.example/api/community/shared-series/mine?offset=0&limit=100', method: 'GET', body: undefined },
      { url: 'https://api.example/api/community/shared-series/series%201', method: 'DELETE', body: undefined },
      { url: 'https://api.example/api/community/shared-content/mine?offset=0&limit=100', method: 'GET', body: undefined },
      { url: 'https://api.example/api/community/shared-content/shared%201', method: 'DELETE', body: undefined },
      { url: 'https://api.example/api/community/reading-plans/mine?offset=0&limit=100', method: 'GET', body: undefined },
      { url: 'https://api.example/api/community/reading-plans/plan%201/publication', method: 'DELETE', body: undefined },
      { url: 'https://api.example/api/community/comments/mine?offset=0&limit=100', method: 'GET', body: undefined },
      { url: 'https://api.example/api/community/sermons/mine?offset=0&limit=100', method: 'GET', body: undefined },
      { url: 'https://api.example/api/community/study-groups/mine?offset=0&limit=100', method: 'GET', body: undefined },
      {
        url: 'https://api.example/api/community/posts/post%201/replies/reply%201',
        method: 'DELETE',
        body: undefined,
      },
      {
        url: 'https://api.example/api/community/posts/post%201',
        method: 'DELETE',
        body: undefined,
      },
      {
        url: 'https://api.example/api/community/study-groups/group%201/members/member%201',
        method: 'DELETE',
        body: undefined,
      },
      {
        url: 'https://api.example/api/community/study-groups/group%201/messages/message%201',
        method: 'DELETE',
        body: undefined,
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

  it('loads every shared-sermon inventory page for existing array callers', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ sermons: [{ id: 'new' }], next_offset: 100 }))
      .mockResolvedValueOnce(jsonResponse({ sermons: [{ id: 'old' }], next_offset: null }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadClient();
    await expect(api.community.mySharedSermons()).resolves.toEqual([{ id: 'new' }, { id: 'old' }]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example/api/community/sermons/mine?offset=0&limit=100',
      'https://api.example/api/community/sermons/mine?offset=100&limit=100',
    ]);
  });

  it('binds AI calls to a workflow URL and never forwards client system/schema instructions', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ analysis: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadClient();
    await api.integrations.Core.InvokeLLM({
      feature: 'ethics',
      prompt: 'Consider this case',
      system_prompt: 'Caller-owned role text',
      response_json_schema: { type: 'object', description: 'Caller-owned instruction' },
      max_tokens: 900,
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example/api/ai/workflows/ethics/invoke');
    expect(JSON.parse(options.body)).toEqual({
      input: 'Consider this case',
      structured: true,
      max_tokens: 900,
    });
  });
});


describe('StreamLLM result-trailer contract', () => {
  const RS = String.fromCharCode(0x1e);
  const NONCE = 'test-nonce-9f3a2c7e4b1d68a5'; // per-stream nonce (server sends it in a header)
  // Build an authentic-framed trailer (nonce + JSON) the way the server does.
  const framed = (json) => `${RS}${NONCE}${json}`;

  // The server delivers the nonce out of band in the X-Stream-Trailer-Nonce
  // header; pass `nonce: null` to simulate a response missing the header.
  function streamResponse(text, { nonce = NONCE } = {}) {
    const headers = { 'Content-Type': 'text/plain; charset=utf-8' };
    if (nonce !== null) headers['X-Stream-Trailer-Nonce'] = nonce;
    return new Response(text, {
      status: 200,
      headers,
    });
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('opts in with stream_result, strips the trailer, and resolves the clean text', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const payload = '{"title":"Grace"}';
    // A real success trailer always carries the scripture screen; the client now
    // requires ok && !truncated && scripture.ok to resolve.
    const fetchMock = vi.fn().mockResolvedValue(streamResponse(payload + '\n' + RS + NONCE + '{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":1,"fabricated":0}}'));
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
    const fetchMock = vi.fn().mockResolvedValue(streamResponse('{"cut": [' + '\n' + RS + NONCE + '{"ok":false,"truncated":true}'));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadClient();
    await expect(api.integrations.Core.StreamLLM({ prompt: 'p' })).rejects.toMatchObject({
      status: 502,
      truncated: true,
    });
  });

  it('POSITIVE validation: resolves ONLY on a fully-valid trailer; any weaker trailer throws', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const { api } = await loadClient();

    // Each of these is NOT a fully-valid success trailer → must throw (502).
    const clean = { ok: true, checked: 1, fabricated: 0 };
    const badTrailers = [
      {},                                        // no fields
      { ok: true },                              // missing truncated + scripture
      { ok: true, truncated: false },            // missing scripture
      { ok: true, truncated: true, scripture: clean },  // truncated
      { ok: true, truncated: false, scripture: { ok: false, checked: 1, fabricated: 1 } }, // scripture failed
      { ok: 'yes', truncated: false, scripture: clean }, // non-boolean ok
      { ok: true, truncated: false, scripture: { ok: true } }, // evidence stripped (no counts)
    ];
    for (const t of badTrailers) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(`draft text${RS}${NONCE}${JSON.stringify(t)}`)));
      await expect(
        api.integrations.Core.StreamLLM({ prompt: 'p' }),
        `trailer ${JSON.stringify(t)} must throw`,
      ).rejects.toMatchObject({ status: 502 });
    }

    // The one fully-valid trailer (with consistent counts) resolves with the text.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      streamResponse(`Grace — John 3:16${RS}${NONCE}${JSON.stringify({ ok: true, truncated: false, scripture: clean })}`),
    ));
    const text = await api.integrations.Core.StreamLLM({ prompt: 'p' });
    expect(text).toBe('Grace — John 3:16');
  });

  it('STRICT trailer: rejects contradictory, unknown-key, and duplicate-key success trailers', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const { api } = await loadClient();

    // Each raw trailer parses to an object with ok/truncated/scripture.ok truthy,
    // but is invalid (contradiction, unknown key, or duplicate key) → must throw.
    const rawBadTrailers = [
      // fabricated:1 contradicts scripture.ok:true
      '{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":1,"fabricated":1}}',
      // unknown top-level key
      '{"ok":true,"truncated":false,"scripture":{"ok":true},"extra":"ignored"}',
      // unknown scripture key
      '{"ok":true,"truncated":false,"scripture":{"ok":true,"bogus":1}}',
      // duplicate top-level key: last-wins would flip ok:false → ok:true
      '{"ok":false,"ok":true,"truncated":false,"scripture":{"ok":true}}',
      // duplicate scripture key
      '{"ok":true,"truncated":false,"scripture":{"ok":false,"ok":true}}',
      // non-numeric count
      '{"ok":true,"truncated":false,"scripture":{"ok":true,"fabricated":"0"}}',
    ];
    for (const raw of rawBadTrailers) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(`draft${RS}${NONCE}${raw}`)));
      await expect(
        api.integrations.Core.StreamLLM({ prompt: 'p' }),
        `trailer must be rejected: ${raw}`,
      ).rejects.toMatchObject({ status: 502 });
    }

    // A fully-valid, consistent trailer WITH counts resolves.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      streamResponse(`John 3:16${RS}${NONCE}{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":1,"fabricated":0}}`),
    ));
    expect(await api.integrations.Core.StreamLLM({ prompt: 'p' })).toBe('John 3:16');
  });

  it('rejects UNICODE-ESCAPED duplicate keys (dup-detector normalizes exactly like JSON.parse)', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const { api } = await loadClient();
    const BS = String.fromCharCode(92); // backslash, built at runtime so tooling can't normalize it
    const escOk = `${BS}u006fk`;        // raw "ok" → decodes to "ok"

    // Sanity: the raw text carries the escape and JSON.parse would last-wins to ok:true.
    const topDup = `{"ok":false,"${escOk}":true,"truncated":false,"scripture":{"ok":true,"checked":1,"fabricated":0}}`;
    expect(topDup.includes(`${BS}u006fk`)).toBe(true);
    expect(JSON.parse(topDup).ok).toBe(true); // last-wins would flip failure → success

    const scriptureDup = `{"ok":true,"truncated":false,"scripture":{"ok":false,"${escOk}":true,"checked":1,"fabricated":0}}`;
    for (const raw of [topDup, scriptureDup]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(`draft${RS}${NONCE}${raw}`)));
      await expect(
        api.integrations.Core.StreamLLM({ prompt: 'p' }),
        `escaped-duplicate must be rejected: ${raw}`,
      ).rejects.toMatchObject({ status: 502 });
    }
  });

  it('REQUIRES consistent numeric scripture counts on a success trailer (no evidence-strip downgrade)', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const { api } = await loadClient();
    const bad = [
      '{"ok":true,"truncated":false,"scripture":{"ok":true}}',                          // no counts
      '{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":1}}',              // missing fabricated
      '{"ok":true,"truncated":false,"scripture":{"ok":true,"fabricated":0}}',           // missing checked
      '{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":-1,"fabricated":0}}', // negative checked
      '{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":1.5,"fabricated":0}}', // non-integer
      '{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":1,"fabricated":2}}', // fabricated>0
      '{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":1,"fabricated":"0"}}', // non-numeric
    ];
    for (const raw of bad) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(`draft${RS}${NONCE}${raw}`)));
      await expect(
        api.integrations.Core.StreamLLM({ prompt: 'p' }),
        `must throw: ${raw}`,
      ).rejects.toMatchObject({ status: 502 });
    }
    // Full consistent trailer resolves.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      streamResponse(`John 3:16${RS}${NONCE}{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":3,"fabricated":0}}`),
    ));
    expect(await api.integrations.Core.StreamLLM({ prompt: 'p' })).toBe('John 3:16');
  });

  it('throws (scriptureUnverified) when the streamed draft contained fabricated Scripture', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const body = '{"points":["Hezekiah 4:5"]}' + '\n' + RS + NONCE + '{"ok":false,"truncated":false,"scripture":{"ok":false,"checked":1,"fabricated":1}}';
    const fetchMock = vi.fn().mockResolvedValue(streamResponse(body));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadClient();
    await expect(api.integrations.Core.StreamLLM({ prompt: 'p' })).rejects.toMatchObject({
      status: 502,
      scriptureUnverified: true,
    });
  });

  it('treats a MISSING trailer as a protocol failure (we requested stream_result:true)', async () => {
    // A trailer-less stream (mid-stream error that dropped the mandatory trailer,
    // or an out-of-date server) must NOT be kept as a completed answer.
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const fetchMock = vi.fn().mockResolvedValue(streamResponse('Anchored on Hezekiah 4:5.'));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadClient();
    await expect(api.integrations.Core.StreamLLM({ prompt: 'p' })).rejects.toMatchObject({
      status: 502,
      streamIncomplete: true,
    });
  });

  it('treats a malformed trailer as a protocol failure', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const fetchMock = vi.fn().mockResolvedValue(streamResponse(`text${RS}${NONCE}not-json`));
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await loadClient();
    await expect(api.integrations.Core.StreamLLM({ prompt: 'p' })).rejects.toMatchObject({ status: 502 });
  });

  it('rejects a MODEL-INJECTED fake trailer with no server nonce (frame spoof on interrupted stream)', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    // A perfectly-shaped success trailer, but NOT prefixed with the server nonce
    // — as if the model emitted its own RS+trailer and the real one never came.
    const fake = '{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":0,"fabricated":0}}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(`draft text${RS}${fake}`)));
    const { api } = await loadClient();
    await expect(api.integrations.Core.StreamLLM({ prompt: 'p' }))
      .rejects.toMatchObject({ status: 502, streamIncomplete: true });
  });

  it('rejects a WRONG-nonce trailer', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const good = '{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":0,"fabricated":0}}';
    // Body carries a different nonce than the header → mismatch → fail closed.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(`draft${RS}some-other-nonce${good}`)));
    const { api } = await loadClient();
    await expect(api.integrations.Core.StreamLLM({ prompt: 'p' })).rejects.toMatchObject({ status: 502 });
  });

  it('rejects when the nonce HEADER is missing entirely (no out-of-band token)', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const good = '{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":0,"fabricated":0}}';
    // Body has the framed nonce, but the response omits the header the client
    // authenticates against → cannot confirm → fail closed.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(`draft${framed(good)}`, { nonce: null })));
    const { api } = await loadClient();
    await expect(api.integrations.Core.StreamLLM({ prompt: 'p' })).rejects.toMatchObject({ status: 502 });
  });

  it('rejects an RS in the CONTENT portion (tampering) even with a valid trailer after it', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const good = '{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":0,"fabricated":0}}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(`part${RS}injected${framed(good)}`)));
    const { api } = await loadClient();
    await expect(api.integrations.Core.StreamLLM({ prompt: 'p' })).rejects.toMatchObject({ status: 502 });
  });

  it('resolves on the AUTHENTIC marked trailer (framed helper)', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example');
    const good = '{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":2,"fabricated":0}}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(`Grace — John 3:16${framed(good)}`)));
    const { api } = await loadClient();
    expect(await api.integrations.Core.StreamLLM({ prompt: 'p' })).toBe('Grace — John 3:16');
  });
});
