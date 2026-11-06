import { Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../api/auth-context';
import { adsApi } from '../api/ads';
import type { Ad, AdStatus } from '../api/ads';
import { AdCard } from './AdCard';
import { FormError } from './FormError';

const statusLabels: Record<AdStatus, string> = {
  PENDING: 'На проверке',
  PUBLISHED: 'Опубликовано',
  REJECTED: 'Отклонено',
};

// Все объявления автора (Т5), в том числе ещё не видные на сайте
export function MyAdsList() {
  const { token } = useAuth();
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      adsApi
        .mine(token!)
        .then(setAds)
        .catch((e: Error) => setError(e.message)),
    [token],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  async function remove(ad: Ad) {
    if (!window.confirm(`Удалить объявление «${ad.title}»?`)) return;
    setError(null);
    try {
      await adsApi.remove(ad.id, token!);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <FormError message={error} />
      {ads && ads.length > 0 && (
        <ul className="ad-grid" aria-label="Мои объявления">
          {ads.map((ad) => (
            <li key={ad.id} className="my-ad">
              {/* Карточка открыта всем только у опубликованных */}
              <AdCard
                ad={ad}
                to={
                  ad.status === 'PUBLISHED'
                    ? `/ads/${ad.id}`
                    : `/ads/${ad.id}/edit`
                }
              />
              <div className="my-ad__bar">
                <span className={`status status--${ad.status.toLowerCase()}`}>
                  {statusLabels[ad.status]}
                </span>
                <div className="category-list__actions">
                  <Link
                    to={`/ads/${ad.id}/edit`}
                    className="icon-button"
                    aria-label={`Изменить ${ad.title}`}
                  >
                    <Pencil size={16} aria-hidden />
                  </Link>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Удалить ${ad.title}`}
                    onClick={() => void remove(ad)}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {ads?.length === 0 && (
        <p className="empty">
          Вы ещё ничего не подавали.{' '}
          <Link to="/ads/new">Подать первое объявление</Link>
        </p>
      )}
    </>
  );
}
