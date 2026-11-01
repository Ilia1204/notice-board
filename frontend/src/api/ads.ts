import { API_URL, apiRequest } from './client';

export type AdStatus = 'PENDING' | 'PUBLISHED' | 'REJECTED';

export interface Ad {
  id: number;
  title: string;
  description: string;
  price: number | null;
  status: AdStatus;
  category: { id: number; name: string };
  author: { id: number; name: string };
  images: { id: number; filename: string }[];
  createdAt: string;
}

export const MAX_IMAGES = 10;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export const imageUrl = (filename: string) => `${API_URL}/uploads/${filename}`;

export const adsApi = {
  // Поля и фото уходят одной формой multipart/form-data
  create: (form: FormData, token: string) =>
    apiRequest<Ad>('/ads', { method: 'POST', body: form, token }),
};
