import type { User } from './auth';
import { apiRequest } from './client';

export interface UserProfile extends User {
  createdAt: string;
}

export type ProfileData = Pick<User, 'name' | 'email'>;

export const usersApi = {
  me: (token: string) => apiRequest<UserProfile>('/users/me', { token }),
  update: (data: ProfileData, token: string) =>
    apiRequest<UserProfile>('/users/me', {
      method: 'PATCH',
      body: data,
      token,
    }),
};
