import { ArrowLeft, ImageOff, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../api/auth-context';
import { adsApi, formatPrice, imageUrl } from '../api/ads';
import type { Ad } from '../api/ads';
import { FormError } from '../components/FormError';

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

// Карточка объявления (Т4): фото, цена, описание и продавец
export function AdPage() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [ad, setAd] = useState<Ad | null>(null);
  const [photo, setPhoto] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    adsApi
      .get(Number(id))
      .then((loaded) => {
        setAd(loaded);
        setPhoto(0);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  async function remove(target: Ad) {
    if (!window.confirm(`Удалить объявление «${target.title}»?`)) return;
    setRemoveError(null);
    try {
      await adsApi.remove(target.id, token!);
      await navigate('/my-ads');
    } catch (e) {
      setRemoveError((e as Error).message);
    }
  }

  if (error || !ad) {
    return (
      <main className="content">
        <Link to="/" className="back-link">
          <ArrowLeft size={18} aria-hidden /> Все объявления
        </Link>
        <FormError message={error} />
      </main>
    );
  }

  const current = ad.images[photo];

  return (
    <main className="content">
      <Link to="/" className="back-link">
        <ArrowLeft size={18} aria-hidden /> Все объявления
      </Link>
      <article className="ad-page">
        <div className="ad-page__gallery">
          {current ? (
            <img
              className="ad-page__photo"
              src={imageUrl(current.filename)}
              alt={ad.title}
            />
          ) : (
            <div className="ad-page__photo ad-card__photo--empty" aria-hidden>
              <ImageOff size={56} strokeWidth={1.5} />
            </div>
          )}
          {ad.images.length > 1 && (
            <ul className="thumbs">
              {ad.images.map((image, i) => (
                <li key={image.id}>
                  <button
                    type="button"
                    aria-label={`Показать фото ${i + 1}`}
                    aria-pressed={i === photo}
                    onClick={() => setPhoto(i)}
                  >
                    <img src={imageUrl(image.filename)} alt="" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ad-page__info">
          <p className="ad-page__category">{ad.category.name}</p>
          <h2 className="ad-page__title">{ad.title}</h2>
          <p className="ad-page__price">{formatPrice(ad.price)}</p>
          <p className="ad-page__seller">
            <UserRound size={20} aria-hidden />
            <span>
              Продавец: <strong>{ad.author.name}</strong>
            </span>
          </p>
          <h3>Описание</h3>
          <p className="ad-page__description">{ad.description}</p>
          <p className="ad-page__date">
            Опубликовано {dateFormat.format(new Date(ad.createdAt))}
          </p>
          {user?.id === ad.author.id && (
            <div className="ad-page__actions">
              <Link to={`/ads/${ad.id}/edit`} className="action">
                Изменить
              </Link>
              <button
                type="button"
                className="action action--danger"
                onClick={() => void remove(ad)}
              >
                Удалить
              </button>
            </div>
          )}
          <FormError message={removeError} />
        </div>
      </article>
    </main>
  );
}
