import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/api/apiClient';
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
