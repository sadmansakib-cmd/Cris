import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthUserDto } from '@hault/shared';
import { apiFetch, setAccessToken } from './api';

interface AuthValue {
  user: AuthUserDto | null;
  loading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthCtx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const me = await apiFetch<AuthUserDto>('/api/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Try to obtain a fresh access token from the refresh cookie
      try {
        const res = await apiFetch<{ accessToken: string; user: AuthUserDto }>('/api/auth/refresh', {
          method: 'POST',
          skipRefresh: true,
        });
        setAccessToken(res.accessToken);
        setUser(res.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login: AuthValue['login'] = async (email, password, totpCode) => {
    const res = await apiFetch<{ accessToken: string; user: AuthUserDto }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, totpCode }),
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
  };

  const register: AuthValue['register'] = async (email, password, displayName) => {
    const res = await apiFetch<{ accessToken: string; user: AuthUserDto }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
