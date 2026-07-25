'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from './api';
import { CurrentUser } from './types';

interface AuthState {
  token: string | null;
  user: CurrentUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);
// Not part of the public context value on purpose — only useApi() needs
// this, and exposing it on AuthState would invite pages to read a stale
// token directly instead of going through useApi(). See the comment above
// useApi() for why this ref (and the ready-promise) exist at all.
const AuthInternalsContext = createContext<{ tokenRef: React.MutableRefObject<string | null>; ready: Promise<void> } | undefined>(
  undefined,
);

const STORAGE_KEY = 'cip.auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Every page fetches its own data in a top-level `useEffect(() => {...},
  // [])` on mount. React runs child effects before parent effects, so on a
  // hard page load/refresh a page's own fetch effect can run *before* this
  // provider's hydration effect below has read the token from localStorage
  // — the request goes out with token=null, gets a 401, and useApi's
  // catch-401 logs the user out. Wrong: the session was fine, the request
  // just fired too early. `tokenRef` (always current, unlike the `token`
  // state closed over by an effect that already ran) + `ready` (resolves
  // once hydration finishes) let useApi() wait for hydration and then read
  // the real token — fixing every page from this one place, rather than
  // adding a loading-guard to ~20 individual fetch effects.
  const tokenRef = useRef<string | null>(null);
  const readyResolveRef = useRef<(() => void) | undefined>(undefined);
  const readyRef = useRef<Promise<void> | undefined>(undefined);
  if (!readyRef.current) {
    readyRef.current = new Promise((resolve) => {
      readyResolveRef.current = resolve;
    });
  }

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        tokenRef.current = parsed.token;
        setToken(parsed.token);
        setUser(parsed.user);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
    readyResolveRef.current?.();
  }, []);

  async function login(username: string, password: string) {
    const result = await apiFetch<{ accessToken: string; user: CurrentUser }>('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    tokenRef.current = result.accessToken;
    setToken(result.accessToken);
    setUser(result.user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: result.accessToken, user: result.user }));
    router.push('/dashboard');
  }

  function logout() {
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      <AuthInternalsContext.Provider value={{ tokenRef, ready: readyRef.current }}>
        {children}
      </AuthInternalsContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Convenience wrapper so pages don't have to thread `token` through every
// apiFetch call by hand. Waits for auth hydration (see AuthProvider above)
// before reading the token, so a page's mount-time fetch effect can never
// race ahead of localStorage being read.
export function useApi() {
  const { logout } = useAuth();
  const internals = useContext(AuthInternalsContext);
  if (!internals) throw new Error('useApi must be used within AuthProvider');
  const { tokenRef, ready } = internals;

  return async function call<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    await ready;
    try {
      return await apiFetch<T>(path, { ...options, token: tokenRef.current });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
      }
      throw err;
    }
  };
}
