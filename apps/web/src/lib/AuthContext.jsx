import React, { createContext, useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { api, setUnauthorizedHandler } from '@/api/apiClient';
import { logError } from '@/lib/logError';
import { primeCachedUser } from '@/components/admin/UserActivityLogger';

const AuthContext = createContext();

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
      setAuthError(null);
      // Share the just-fetched user with the activity logger so it doesn't
      // issue its own duplicate /api/auth/me call.
      primeCachedUser(currentUser);
    } catch (error) {
      // 401 means no valid cookie — user is simply not logged in
      if (error.status === 401) {
        setUser(null);
        setIsAuthenticated(false);
        primeCachedUser(null);
      } else {
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

  // Mirror isAuthenticated into a ref so the (non-React) unauthorized handler
  // can read the *current* value without being re-registered on every change.
  const isAuthenticatedRef = useRef(false);
  useEffect(() => { isAuthenticatedRef.current = isAuthenticated; }, [isAuthenticated]);

  // Register the app-wide 401 handler. When a feature request 401s mid-session
  // (cookie expired, tokenVersion bumped), clear auth state, tell the user
  // honestly, and bounce to login preserving where they were. A guard ref
  // de-dupes the burst of parallel 401s a single expiry produces so we don't
  // stack toasts or fire multiple redirects.
  const sessionExpiredHandledRef = useRef(false);
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
    try { await api.auth.logout(); } catch { /* best-effort: cookie may already be expired */ }
    setUser(null);
    setIsAuthenticated(false);
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
