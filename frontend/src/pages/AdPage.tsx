import { ArrowLeft, ImageOff, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../api/auth-context';
import { adsApi, formatPrice, imageUrl } from '../api/ads';
import type { Ad } from '../api/ads';
import { useFavorites } from '../api/favorites-context';
import { FavoriteButton } from '../components/FavoriteButton';
import { FormError } from '../components/FormError';
import { ReportAd } from '../components/ReportAd';
import { WriteSellerButton } from '../components/WriteSellerButton';

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

// Карточка объявления (Т4): фото, цена, описание и продавец
export function AdPage() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const { error: favoritesError } = useFavorites();
  const navigate = useNavigate();
  const [ad, setAd] = useState<Ad | null>(null);
  const [photo, setPhoto] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    adsApi
      .get(Number(id))
      .then((loaded) => {
        setAd(loaded);
        setPhoto(0);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  async function act(question: string, action: () => Promise<unknown>) {
    if (!window.confirm(question)) return;
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  const remove = (target: Ad) =>
    act(`Удалить объявление «${target.title}»?`, async () => {
      await adsApi.remove(target.id, token!);
      await navigate('/my-ads');
    });

  // Скрытое объявление больше не открывается, поэтому уходим на главную
  const hide = (target: Ad) =>
    act(`Скрыть объявление «${target.title}»?`, async () => {
      await adsApi.moderate(target.id, 'REJECTED', token!);
      await navigate('/');
    });

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
          <div className="ad-page__actions">
            <WriteSellerButton ad={ad} onError={setActionError} />
            <FavoriteButton ad={ad} withText />
            {user?.id === ad.author.id && (
              <>
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
              </>
            )}
            {user?.role === 'MODERATOR' && (
              <button
                type="button"
                className="action action--danger"
                onClick={() => void hide(ad)}
              >
                Скрыть
              </button>
            )}
          </div>
          <FormError message={actionError ?? favoritesError} />
          <ReportAd key={ad.id} ad={ad} />
        </div>
      </article>
    </main>
  );
}
