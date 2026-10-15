import type { Role } from '@prisma/client';

// Содержимое JWT-токена
export interface JwtPayload {
  sub: number;
  email: string;
  role: Role;
}

// Пользователь без хеша пароля — то, что уходит клиенту
export interface PublicUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}
