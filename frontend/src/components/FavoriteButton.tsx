import { Heart } from 'lucide-react';
import type { Ad } from '../api/ads';
import { useAuth } from '../api/auth-context';
import { useFavorites } from '../api/favorites-context';

// Сердечко на карточке или кнопка с текстом на странице объявления.
// Гостю не показываем: избранное хранится в его профиле
export function FavoriteButton({
  ad,
  withText = false,
}: {
  ad: Ad;
  withText?: boolean;
}) {
  const { token } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  if (!token) return null;

  const active = isFavorite(ad.id);
  const label = active ? 'В избранном' : 'В избранное';

  return (
    <button
      type="button"
      className={withText ? 'action favorite-action' : 'favorite'}
      aria-pressed={active}
      aria-label={withText ? undefined : `${label}: ${ad.title}`}
      onClick={() => void toggle(ad)}
    >
      <Heart size={18} fill={active ? 'currentColor' : 'none'} aria-hidden />
      {withText && label}
    </button>
  );
}
