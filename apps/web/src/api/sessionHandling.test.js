// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function setup(status, body = { message: 'Authentication required' }) {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', 'https://api.example');
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })));
  vi.stubGlobal('fetch', fetchMock);
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  const client = await import('./apiClient');
  const unauthorized = vi.fn();
  client.setUnauthorizedHandler(unauthorized);
  return { ...client, fetchMock, errorLog, unauthorized };
}

describe('shared session handling', () => {
  it('uses the no-store, cookie-authenticated optional startup probe', async () => {
    const { api, fetchMock, unauthorized, errorLog } = await setup(200, null);
    expect(await api.auth.me({ optional: true })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('https://api.example/api/auth/session', expect.objectContaining({
      credentials: 'include', cache: 'no-store',
    }));
    expect(unauthorized).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
  });
  it.each([
    ['/api/auth/me', 'PATCH'], ['/api/auth/me', 'DELETE'],
    ['/api/auth/export', 'GET'], ['/api/auth/revoke-sessions', 'POST'],
    ['/api/auth/users/example/ban', 'PATCH'], ['/api/entities/Sermon', 'POST'],
  ])('handles expiry globally for %s %s', async (path, method) => {
    const { apiFetch, unauthorized, fetchMock } = await setup(401);
    await expect(apiFetch(path, { method })).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalledExactlyOnceWith(path);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['/api/auth/me', 'GET'], ['/api/auth/session', 'GET'],
    ['/api/auth/login', 'POST'], ['/api/auth/register', 'POST'], ['/api/auth/logout', 'POST'],
  ])('leaves expected handshake failures to their caller: %s %s', async (path, method) => {
    const { apiFetch, unauthorized, errorLog } = await setup(401);
    await expect(apiFetch(path, { method })).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
  });
  it('does not hide genuine server failures or claim they are session expiry', async () => {
    const { apiFetch, unauthorized, errorLog } = await setup(503, { message: 'Service unavailable' });
    await expect(apiFetch('/api/auth/session', { retry: false })).rejects.toMatchObject({ status: 503 });
    expect(unauthorized).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalled();
  });
});
