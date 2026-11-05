import { useEffect } from 'react';
import { Link } from 'react-router';
import { useFavorites } from '../api/favorites-context';
import { AdCard } from '../components/AdCard';
import { FavoriteButton } from '../components/FavoriteButton';
import { FormError } from '../components/FormError';

// Объявления, которые пользователь отложил (Т8)
export function FavoritesPage() {
  const { ads, error, reload } = useFavorites();

  // Пока страница была закрыта, объявления могли снять с публикации
  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <main className="content">
      <h2 className="section-title">Избранное</h2>
      <FormError message={error} />
      {ads && ads.length > 0 && (
        <ul className="ad-grid" aria-label="Избранное">
          {ads.map((ad) => (
            <li key={ad.id} className="favorable">
              <AdCard ad={ad} />
              <FavoriteButton ad={ad} />
            </li>
          ))}
        </ul>
      )}
      {ads?.length === 0 && (
        <p className="empty">
          Здесь пока пусто. <Link to="/">Посмотреть объявления</Link>
        </p>
      )}
    </main>
  );
}
