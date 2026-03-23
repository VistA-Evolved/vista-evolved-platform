'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { login as apiLogin, logout as apiLogout, getSession, type LoginResult } from './api';

interface AuthContextValue {
  user: LoginResult['user'] | null;
  loading: boolean;
  login: (accessCode: string, verifyCode: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LoginResult['user'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then(u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (accessCode: string, verifyCode: string): Promise<LoginResult> => {
    const result = await apiLogin(accessCode, verifyCode);
    if (result.ok && result.user) {
      setUser(result.user);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
