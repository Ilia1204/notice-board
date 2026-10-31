import { apiRequest } from './client';

export interface Ad {
  id: number;
  title: string;
  description: string;
  price: number | null;
  category: { id: number; name: string };
  author: { id: number; name: string };
  createdAt: string;
}

export interface AdData {
  title: string;
  description: string;
  price?: number;
  categoryId: number;
}

export const adsApi = {
  create: (data: AdData, token: string) =>
    apiRequest<Ad>('/ads', { method: 'POST', body: data, token }),
};
