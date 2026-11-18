import { ImageOff } from 'lucide-react';
import { Link } from 'react-router';
import { formatPrice, imageUrl } from '../api/ads';
import type { Ad } from '../api/ads';

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
});

// Карточка в списке: первое фото, цена, название, рубрика и дата.
// own — пометка «Ваше» на своих объявлениях в общей ленте
export function AdCard({
  ad,
  to,
  own = false,
}: {
  ad: Ad;
  to?: string;
  own?: boolean;
}) {
  const cover = ad.images[0];

  return (
    <Link to={to ?? `/ads/${ad.id}`} className="ad-card">
      {cover ? (
        <img
          className="ad-card__photo"
          src={imageUrl(cover.filename)}
          alt={ad.title}
          loading="lazy"
        />
      ) : (
        <div className="ad-card__photo ad-card__photo--empty" aria-hidden>
          <ImageOff size={36} strokeWidth={1.5} />
        </div>
      )}
      <div className="ad-card__body">
        {own && <span className="ad-card__badge">Ваше</span>}
        <p className="ad-card__price">{formatPrice(ad.price)}</p>
        <h3 className="ad-card__title">{ad.title}</h3>
        <p className="ad-card__meta">
          {ad.category.name} · {dateFormat.format(new Date(ad.createdAt))}
        </p>
      </div>
    </Link>
  );
}
