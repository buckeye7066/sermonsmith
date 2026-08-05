// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

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
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(hasAuthSessionHint()).toBe(false);
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
