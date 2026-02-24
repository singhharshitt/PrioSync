/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import authService from '../services/authService.js';
import { AUTH_UNAUTHORIZED_EVENT, setAuthToken } from '../api/httpClient.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      if (!authService.getStoredToken()) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const data = await authService.getMe();
        if (isMounted) {
          setUser(data?.user || null);
        }
      } catch {
        authService.logout();
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setAuthToken(null);
      setUser(null);
      setLoading(false);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await authService.login(credentials);
    setUser(data?.user || null);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authService.register(payload);
    setUser(data?.user || null);
    return data;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const updateUser = useCallback((nextUser) => {
    setUser(nextUser || null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      updateUser,
    }),
    [user, loading, login, register, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
