import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api/auth';
import type { AuthResponse, LoginData, RegisterData, User } from '../api/auth';
import { AuthContext } from '../api/auth-context';

const TOKEN_KEY = 'notice-board.token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // хранилище недоступно — вход действует до перезагрузки страницы
  }
}

// Хранит токен и текущего пользователя, восстанавливает вход после перезагрузки
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readToken);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!token || user) return;
    authApi
      .me(token)
      .then(setUser)
      .catch(() => {
        saveToken(null);
        setToken(null);
      });
  }, [token, user]);

  const applyAuth = useCallback((response: AuthResponse) => {
    saveToken(response.accessToken);
    setToken(response.accessToken);
    setUser(response.user);
  }, []);

  const login = useCallback(
    async (data: LoginData) => applyAuth(await authApi.login(data)),
    [applyAuth],
  );

  const register = useCallback(
    async (data: RegisterData) => applyAuth(await authApi.register(data)),
    [applyAuth],
  );

  const logout = useCallback(() => {
    saveToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, login, register, logout }),
    [user, token, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
