// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';

const me = vi.fn();
const logoutRequest = vi.fn();
const primeCachedUser = vi.fn();
const logError = vi.fn();
const setUnauthorizedHandler = vi.fn();

vi.mock('@/api/apiClient', () => ({
  api: {
    auth: {
      me: (...args) => me(...args),
      logout: (...args) => logoutRequest(...args),
    },
  },
  // AuthContext registers an app-wide 401 handler via this export on mount.
  setUnauthorizedHandler: (...args) => setUnauthorizedHandler(...args),
}));

vi.mock('@/components/admin/UserActivityLogger', () => ({
  primeCachedUser: (...args) => primeCachedUser(...args),
}));

vi.mock('@/lib/logError', () => ({
  logError: (...args) => logError(...args),
}));

import { AuthProvider, getCurrentAppReturnPath, getLoginPath, hasAuthSessionHint, useAuth } from './AuthContext.jsx';

function AuthProbe() {
  const auth = useAuth();

  return (
    <div>
      <div data-testid="loading">{String(auth.isLoadingAuth)}</div>
      <div data-testid="authenticated">{String(auth.isAuthenticated)}</div>
      <div data-testid="user">{auth.user?.id || 'none'}</div>
      <button type="button" onClick={() => auth.logout(false)}>Logout</button>
      <button type="button" onClick={() => auth.checkAppState()}>Recheck</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    Reflect.deleteProperty(window, 'electron');
    logoutRequest.mockResolvedValue(null);
    window.localStorage.clear();
  });

  it('loads the current user into authenticated state', async () => {
    me.mockResolvedValueOnce({ id: 'u1', email: 'pastor@example.com' });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user')).toHaveTextContent('u1');
    expect(primeCachedUser).toHaveBeenCalledWith({ id: 'u1', email: 'pastor@example.com' });
    expect(hasAuthSessionHint()).toBe(true);
  });

  it('treats a 401 auth check as logged out, not as a fatal auth error', async () => {
    me.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }));
    window.localStorage.setItem('sermonsmith.authenticated-session', '1');

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(primeCachedUser).toHaveBeenCalledWith(null);
    expect(logError).not.toHaveBeenCalled();
    expect(hasAuthSessionHint()).toBe(false);
  });

  it('clears a returning-session hint when auth verification fails', async () => {
    me.mockRejectedValueOnce(Object.assign(new Error('Service unavailable'), { status: 503 }));
    window.localStorage.setItem('sermonsmith.authenticated-session', '1');

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(hasAuthSessionHint()).toBe(false);
    expect(logError).toHaveBeenCalledWith('Auth check failed', expect.any(Error));
  });

  it('logout clears auth state', async () => {
    me.mockResolvedValueOnce({ id: 'u1', email: 'pastor@example.com' });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('true'));
    fireEvent.click(screen.getByRole('button', { name: /logout/i }));

    await waitFor(() => expect(logoutRequest).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(hasAuthSessionHint()).toBe(false);
  });

  it('treats an anonymous 200 probe as signed out, never as a verified user', async () => {
    me.mockResolvedValueOnce(null);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(me).toHaveBeenCalledWith({ optional: true });
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(logError).not.toHaveBeenCalled();
  });

  it('ignores a late successful startup response after logout', async () => {
    let resolve;
    me.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(logoutRequest).toHaveBeenCalledTimes(1));
    await act(async () => { resolve({ id: 'stale-user' }); });
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(hasAuthSessionHint()).toBe(false);
  });

  it('clears stale identity and logger cache when a later verification fails', async () => {
    me.mockResolvedValueOnce({ id: 'u1' });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('u1'));
    me.mockRejectedValueOnce(Object.assign(new Error('Service unavailable'), { status: 503 }));
    fireEvent.click(screen.getByRole('button', { name: 'Recheck' }));
    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(primeCachedUser).toHaveBeenLastCalledWith(null);
    expect(hasAuthSessionHint()).toBe(false);
  });

  it('invalidates a pending verification when a protected request expires', async () => {
    window.history.pushState({}, '', '/Login');
    me.mockResolvedValueOnce({ id: 'u1' });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('u1'));
    let resolve;
    me.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    fireEvent.click(screen.getByRole('button', { name: 'Recheck' }));
    const handler = setUnauthorizedHandler.mock.calls.find(([fn]) => typeof fn === 'function')[0];
    act(() => { handler(); handler(); });
    await act(async () => { resolve({ id: 'stale-user' }); });
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('verifies through the protected legacy endpoint during a rolling API deployment', async () => {
    me.mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }));
    me.mockResolvedValueOnce({ id: 'legacy-user' });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('legacy-user');
    expect(me).toHaveBeenNthCalledWith(1, { optional: true });
    expect(me).toHaveBeenNthCalledWith(2);
    expect(logError).not.toHaveBeenCalled();
  });

  it('keeps an anonymous legacy API response signed out', async () => {
    me.mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }));
    me.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(me).toHaveBeenCalledTimes(2);
    expect(logError).not.toHaveBeenCalled();
  });

  it.each([403, 500, 503])('does not use the legacy probe to bypass status %s', async (status) => {
    me.mockRejectedValueOnce(Object.assign(new Error('Verification failed'), { status }));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(me).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalled();
  });

  it('does not start a legacy verification after logout invalidates the optional probe', async () => {
    let reject;
    me.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(logoutRequest).toHaveBeenCalledTimes(1));
    await act(async () => { reject(Object.assign(new Error('Not found'), { status: 404 })); });
    expect(me).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('builds BrowserRouter login targets with a return path', () => {
    window.history.pushState({}, '', '/SermonBuilder?draft=1');

    expect(getCurrentAppReturnPath()).toBe('/SermonBuilder?draft=1');
    expect(getLoginPath(getCurrentAppReturnPath())).toBe('/Login?return=%2FSermonBuilder%3Fdraft%3D1');
  });

  it('builds HashRouter login targets for Electron', () => {
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { isElectron: true },
    });
    window.location.hash = '#/SermonBuilder?draft=1';

    expect(getCurrentAppReturnPath()).toBe('/SermonBuilder?draft=1');
    expect(getLoginPath(getCurrentAppReturnPath())).toBe('#/Login?return=%2FSermonBuilder%3Fdraft%3D1');
    expect(getLoginPath()).toBe('#/Login');
  });
});
