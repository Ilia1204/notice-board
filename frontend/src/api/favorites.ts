import type { Ad } from './ads';
import { apiRequest } from './client';

export const favoritesApi = {
  list: (token: string) => apiRequest<Ad[]>('/favorites', { token }),
  add: (adId: number, token: string) =>
    apiRequest<void>(`/favorites/${adId}`, { method: 'PUT', token }),
  remove: (adId: number, token: string) =>
    apiRequest<void>(`/favorites/${adId}`, { method: 'DELETE', token }),
};
