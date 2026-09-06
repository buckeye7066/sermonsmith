import React, { createContext, useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { api, setUnauthorizedHandler } from '@/api/apiClient';
import { logError } from '@/lib/logError';
import { primeCachedUser } from '@/components/admin/UserActivityLogger';

const AuthContext = createContext();

const AUTH_SESSION_HINT_KEY = 'sermonsmith.authenticated-session';

// This stores only a boolean hint, never an account identifier or credential.
// It lets a returning signed-in browser keep the neutral loading shell while
// the httpOnly session cookie is verified, without making first-time anonymous
// visitors wait before a public marketing page renders.
export function hasAuthSessionHint() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(AUTH_SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function setAuthSessionHint(isAuthenticated) {
  if (typeof window === 'undefined') return;
  try {
    if (isAuthenticated) {
      window.localStorage.setItem(AUTH_SESSION_HINT_KEY, '1');
    } else {
      window.localStorage.removeItem(AUTH_SESSION_HINT_KEY);
    }
  } catch {
    // Storage can be unavailable in locked-down or private browser contexts.
  }
}

function usesHashRouter() {
  return typeof window !== 'undefined' && Boolean(window.electron?.isElectron);
}

export function getCurrentAppReturnPath() {
  if (typeof window === 'undefined') return '/';
  const hashRoute = window.location.hash || '';
  if (hashRoute.startsWith('#/')) {
    return hashRoute.slice(1) || '/';
  }
  return `${window.location.pathname}${window.location.search}${window.location.hash}` || '/';
}

export function getLoginPath(returnTo) {
  const base = usesHashRouter() ? '#/Login' : '/Login';
  if (!returnTo) return base;
  return `${base}?return=${encodeURIComponent(returnTo)}`;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const authVersion = useRef(0);
  const isAuthenticatedRef = useRef(false);
  const sessionExpiredHandledRef = useRef(false);

  const applyUser = useCallback((nextUser) => {
    const verifiedUser = nextUser?.id ? nextUser : null;
    const authenticated = Boolean(verifiedUser);
    isAuthenticatedRef.current = authenticated;
    if (authenticated) sessionExpiredHandledRef.current = false;
    setUser(verifiedUser);
    setIsAuthenticated(authenticated);
    setAuthSessionHint(authenticated);
    primeCachedUser(verifiedUser);
  }, []);

  const checkAuth = useCallback(async () => {
    const version = ++authVersion.current;
    setIsLoadingAuth(true);
    try {
      const currentUser = await api.auth.me({ optional: true });
      // A late startup/recheck response must not restore a session after
      // logout, a newer login, or the app-wide expiry handler invalidated it.
      if (version !== authVersion.current) return;
      applyUser(currentUser);
      setAuthError(null);
    } catch (error) {
      if (version !== authVersion.current) return;
      applyUser(null);
      if (error.status === 401) {
        setAuthError(null);
      } else {
        logError('Auth check failed', error);
        const errType = error.data?.type;
        setAuthError(errType ? { type: errType } : null);
      }
    } finally {
      if (version === authVersion.current) setIsLoadingAuth(false);
    }
  }, [applyUser]);

  useEffect(() => {
    checkAuth();
    return () => { authVersion.current += 1; };
  }, [checkAuth]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!isAuthenticatedRef.current || sessionExpiredHandledRef.current) return;
      sessionExpiredHandledRef.current = true;
      authVersion.current += 1;
      applyUser(null);
      setIsLoadingAuth(false);
      setAuthError(null);

      const returnTo = getCurrentAppReturnPath();
      const onLoginPage = returnTo.replace(/^[#/]+/, '').toLowerCase().startsWith('login');
      if (!onLoginPage) {
        toast.error('Your session has expired. Please sign in again.');
        window.location.href = getLoginPath(returnTo);
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [applyUser]);

  const logout = useCallback(async (shouldRedirect = true) => {
    authVersion.current += 1;
    applyUser(null);
    setIsLoadingAuth(false);
    setAuthError(null);
    try {
      await api.auth.logout();
    } catch (error) {
      logError('Logout request failed (session cleared locally anyway)', error);
    }
    authVersion.current += 1;
    applyUser(null);
    setIsLoadingAuth(false);
    if (shouldRedirect) window.location.href = getLoginPath();
  }, [applyUser]);

  const navigateToLogin = useCallback(() => {
    window.location.href = getLoginPath(getCurrentAppReturnPath());
  }, []);

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings: false,
    authError,
    appPublicSettings: null,
    logout,
    navigateToLogin,
    checkAppState: checkAuth,
  }), [user, isAuthenticated, isLoadingAuth, authError, logout, navigateToLogin, checkAuth]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
