import { createContext, useContext } from 'react';
import type { Ad } from './ads';

export interface FavoritesContextValue {
  ads: Ad[] | null;
  error: string | null;
  isFavorite: (adId: number) => boolean;
  toggle: (ad: Ad) => Promise<void>;
  reload: () => Promise<void>;
}

export const FavoritesContext = createContext<FavoritesContextValue | null>(
  null,
);

export function useFavorites(): FavoritesContextValue {
  const value = useContext(FavoritesContext);
  if (!value)
    throw new Error('useFavorites используется вне FavoritesProvider');
  return value;
}
