import { apiRequest } from './client';

export interface Category {
  id: number;
  name: string;
  description: string | null;
}

export interface CategoryData {
  name: string;
  description: string;
}

export const categoriesApi = {
  list: () => apiRequest<Category[]>('/categories'),
  create: (data: CategoryData, token: string) =>
    apiRequest<Category>('/categories', { method: 'POST', body: data, token }),
  update: (id: number, data: CategoryData, token: string) =>
    apiRequest<Category>(`/categories/${id}`, {
      method: 'PATCH',
      body: data,
      token,
    }),
  remove: (id: number, token: string) =>
    apiRequest<void>(`/categories/${id}`, { method: 'DELETE', token }),
};
