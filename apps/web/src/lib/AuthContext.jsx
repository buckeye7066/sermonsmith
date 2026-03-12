import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/api/apiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const checkAuth = useCallback(async () => {
    const token = api.auth.getToken();
    if (!token) {
      setIsLoadingAuth(false);
      return;
    }

    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      console.error('Auth check failed:', error);
      if (error.status === 401) {
        api.auth.setToken(null);
      }
      const errType = error.data?.type;
      setAuthError(errType ? { type: errType } : null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback((shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    api.auth.setToken(null);
    if (shouldRedirect) {
      window.location.href = '/Login';
    }
  }, []);

  const navigateToLogin = useCallback(() => {
    window.location.href = `/Login?return=${encodeURIComponent(window.location.href)}`;
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
