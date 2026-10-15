import { createContext, useContext } from 'react';
import type { LoginData, RegisterData, User } from './auth';

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth используется вне AuthProvider');
  return value;
}
