import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Ad } from '../api/ads';
import { useAuth } from '../api/auth-context';
import { favoritesApi } from '../api/favorites';
import { FavoritesContext } from '../api/favorites-context';

interface Loaded {
  token: string;
  ads: Ad[];
}

// Хранит избранное вошедшего пользователя: сердечки на всех страницах
// показывают одно и то же. Список запоминается вместе с токеном, чтобы
// после выхода он не достался следующему пользователю
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const ads = token && loaded?.token === token ? loaded.ads : null;
  const error = token ? failure : null;

  const reload = useCallback(async () => {
    if (!token) return;
    setFailure(null);
    try {
      setLoaded({ token, ads: await favoritesApi.list(token) });
    } catch (e) {
      setFailure((e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const isFavorite = useCallback(
    (adId: number) => Boolean(ads?.some((ad) => ad.id === adId)),
    [ads],
  );

  const toggle = useCallback(
    async (ad: Ad) => {
      if (!token) return;
      const added = !isFavorite(ad.id);
      setFailure(null);
      try {
        if (added) await favoritesApi.add(ad.id, token);
        else await favoritesApi.remove(ad.id, token);
        setLoaded((prev) => {
          const rest = (prev?.ads ?? []).filter((item) => item.id !== ad.id);
          return { token, ads: added ? [ad, ...rest] : rest };
        });
      } catch (e) {
        setFailure((e as Error).message);
      }
    },
    [token, isFavorite],
  );

  const value = useMemo(
    () => ({ ads, error, isFavorite, toggle, reload }),
    [ads, error, isFavorite, toggle, reload],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}
