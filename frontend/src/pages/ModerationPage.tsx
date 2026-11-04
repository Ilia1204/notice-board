import { useEffect, useState } from 'react';
import { useAuth } from '../api/auth-context';
import { adsApi, formatPrice, imageUrl } from '../api/ads';
import type { Ad, ModerationDecision } from '../api/ads';
import { FormError } from '../components/FormError';

// Очередь модератора (Т6): объявления, которые ещё никто не проверил
export function ModerationPage() {
  const { token } = useAuth();
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adsApi
      .pending(token!)
      .then(setAds)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  async function decide(ad: Ad, status: ModerationDecision) {
    setError(null);
    try {
      await adsApi.moderate(ad.id, status, token!);
      setAds((list) => list?.filter((item) => item.id !== ad.id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="content">
      <h2 className="section-title">Модерация</h2>
      <FormError message={error} />
      {ads && ads.length > 0 && (
        <ul className="moderation" aria-label="Объявления на проверке">
          {ads.map((ad) => (
            <li key={ad.id} className="moderation__item">
              <h3>{ad.title}</h3>
              <p className="ad-card__price">{formatPrice(ad.price)}</p>
              <p className="ad-card__meta">
                {ad.category.name} · {ad.author.name}
              </p>
              <p className="ad-page__description">{ad.description}</p>
              {ad.images.length > 0 && (
                <ul className="previews">
                  {ad.images.map((image, i) => (
                    <li key={image.id}>
                      <img
                        src={imageUrl(image.filename)}
                        alt={`${ad.title}, фото ${i + 1}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <div className="ad-page__actions">
                <button
                  type="button"
                  className="action"
                  onClick={() => void decide(ad, 'PUBLISHED')}
                >
                  Опубликовать
                </button>
                <button
                  type="button"
                  className="action action--danger"
                  onClick={() => void decide(ad, 'REJECTED')}
                >
                  Отклонить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {ads?.length === 0 && (
        <p className="empty">Всё проверено, новых объявлений нет.</p>
      )}
    </main>
  );
}
