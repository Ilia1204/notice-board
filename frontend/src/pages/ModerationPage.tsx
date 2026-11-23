import { useEffect, useState } from 'react';
import { useAuth } from '../api/auth-context';
import { adsApi, formatPrice, imageUrl } from '../api/ads';
import type { Ad } from '../api/ads';
import { FormError } from '../components/FormError';
import { RejectForm } from '../components/RejectForm';

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

// Исправленное объявление попадает в очередь заново — считаем от последней правки
const sentAt = (ad: Ad) => Date.parse(ad.updatedAt ?? ad.createdAt);

type Order = 'old' | 'new';
const orders: { value: Order; label: string }[] = [
  { value: 'old', label: 'Сначала старые' },
  { value: 'new', label: 'Сначала новые' },
];

// Очередь модератора (Т6): объявления, которые ещё никто не проверил.
// По умолчанию первыми идут те, что ждут дольше всех
export function ModerationPage() {
  const { token } = useAuth();
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [order, setOrder] = useState<Order>('old');
  const [error, setError] = useState<string | null>(null);
  // Объявление, для которого модератор пишет причину отказа
  const [rejecting, setRejecting] = useState<number | null>(null);

  useEffect(() => {
    adsApi
      .pending(token!)
      .then(setAds)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  const removeFromQueue = (ad: Ad) =>
    setAds((list) => list?.filter((item) => item.id !== ad.id) ?? null);

  async function publish(ad: Ad) {
    setError(null);
    try {
      await adsApi.moderate(ad.id, 'PUBLISHED', token!);
      removeFromQueue(ad);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Ошибку показывает сама форма причины
  async function reject(ad: Ad, reason: string) {
    await adsApi.moderate(ad.id, 'REJECTED', token!, reason);
    setRejecting(null);
    removeFromQueue(ad);
  }

  const sorted = ads
    ? [...ads].sort((a, b) =>
        order === 'old' ? sentAt(a) - sentAt(b) : sentAt(b) - sentAt(a),
      )
    : null;

  return (
    <main className="content">
      <h2 className="section-title">Модерация</h2>
      <FormError message={error} />
      {sorted && sorted.length > 1 && (
        <ul className="chips moderation__order" aria-label="Порядок очереди">
          {orders.map(({ value, label }) => (
            <li key={value}>
              <button
                type="button"
                className="chip"
                aria-pressed={order === value}
                onClick={() => setOrder(value)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {sorted && sorted.length > 0 && (
        <ul className="moderation" aria-label="Объявления на проверке">
          {sorted.map((ad) => (
            <li key={ad.id} className="moderation__item">
              <h3>{ad.title}</h3>
              <p className="ad-card__price">{formatPrice(ad.price)}</p>
              <p className="ad-card__meta">
                {ad.category.name} · {ad.author.name} · отправлено{' '}
                {dateFormat.format(sentAt(ad))}
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
              {rejecting === ad.id ? (
                <RejectForm
                  title={`Отклонить «${ad.title}»`}
                  submitLabel="Отклонить"
                  onSubmit={(reason) => reject(ad, reason)}
                  onCancel={() => setRejecting(null)}
                />
              ) : (
                <div className="ad-page__actions">
                  <button
                    type="button"
                    className="action"
                    onClick={() => void publish(ad)}
                  >
                    Опубликовать
                  </button>
                  <button
                    type="button"
                    className="action action--danger"
                    onClick={() => setRejecting(ad.id)}
                  >
                    Отклонить
                  </button>
                </div>
              )}
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
