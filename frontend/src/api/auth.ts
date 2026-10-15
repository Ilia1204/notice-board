import { apiRequest } from './client';

export type Role = 'USER' | 'MODERATOR';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export type LoginData = Omit<RegisterData, 'name'>;

export const authApi = {
  register: (data: RegisterData) =>
    apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: data }),
  login: (data: LoginData) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: data }),
  me: (token: string) => apiRequest<User>('/auth/me', { token }),
};
