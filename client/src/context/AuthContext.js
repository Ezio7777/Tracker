'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, refreshSession, setAccessToken, setAuthLostHandler } from '@/lib/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAuthLostHandler(() => setUser(null));
    refreshSession().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const authenticate = useCallback(async (path, body) => {
    const j = await api(path, { method: 'POST', body });
    setAccessToken(j.data.accessToken);
    setUser(j.data.user);
    return j.data.user;
  }, []);

  const login = (email, password) => authenticate('/auth/login', { email, password });
  const register = (name, email, password) => authenticate('/auth/register', { name, email, password });
  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    setAccessToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}
