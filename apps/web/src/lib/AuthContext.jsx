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

  const checkAuth = useCallback(async () => {
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthSessionHint(true);
      setAuthError(null);
      // Share the just-fetched user with the activity logger so it doesn't
      // issue its own duplicate /api/auth/me call.
      primeCachedUser(currentUser);
    } catch (error) {
      // 401 means no valid cookie — user is simply not logged in
      if (error.status === 401) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthSessionHint(false);
        primeCachedUser(null);
      } else {
        // If the current session cannot be verified, clear the returning-user
        // hint as well. Otherwise every public reload would repeat a neutral
        // loader even though this render has fallen back to signed-out state.
        setAuthSessionHint(false);
        logError('Auth check failed', error);
        const errType = error.data?.type;
        setAuthError(errType ? { type: errType } : null);
      }
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // De-dupe ref for the burst of parallel 401s a single expiry produces, so we
  // don't stack toasts or fire multiple redirects. Declared up here so the
  // auth-mirror effect below can re-arm it on every (re)authentication.
  const sessionExpiredHandledRef = useRef(false);

  // Mirror isAuthenticated into a ref so the (non-React) unauthorized handler
  // can read the *current* value without being re-registered on every change.
  const isAuthenticatedRef = useRef(false);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
    // Re-arm the session-expiry guard whenever we become authenticated again
    // (fresh login or post-login re-sync). Without this, once a session expired
    // the guard stayed latched true for the page's lifetime, so a *later*
    // expiry after re-login would be silently swallowed.
    if (isAuthenticated) sessionExpiredHandledRef.current = false;
  }, [isAuthenticated]);

  // Register the app-wide 401 handler. When a feature request 401s mid-session
  // (cookie expired, tokenVersion bumped), clear auth state, tell the user
  // honestly, and bounce to login preserving where they were.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      // A 401 while we already believe we're logged out is just a protected
      // call made from a public page — the page's own "Sign In Required" UI
      // covers that. Only a 401 while we thought we were authenticated is a
      // genuine session expiry worth interrupting the user for.
      if (!isAuthenticatedRef.current) return;
      if (sessionExpiredHandledRef.current) return;
      sessionExpiredHandledRef.current = true;

      setUser(null);
      setIsAuthenticated(false);
      setAuthSessionHint(false);
      primeCachedUser(null);

      const returnTo = getCurrentAppReturnPath();
      const onLoginPage = returnTo.replace(/^[#/]+/, '').toLowerCase().startsWith('login');
      if (!onLoginPage) {
        toast.error('Your session has expired. Please sign in again.');
        window.location.href = getLoginPath(returnTo);
      }
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const logout = useCallback(async (shouldRedirect = true) => {
    try { 
      await api.auth.logout();
    } catch (error) { 
      logError('Logout failed', error);
      toast.error('Failed to log out. Please try again.');
    }
    setUser(null);
    setIsAuthenticated(false);
    setAuthSessionHint(false);
    setAuthError(null);
    primeCachedUser(null);
    if (shouldRedirect) {
      window.location.href = getLoginPath();
    }
  }, []);

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
