import { Bike, Search, Smartphone, Sofa } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { adsApi } from '../api/ads';
import type { Ad, AdFilters } from '../api/ads';
import { categoriesApi } from '../api/categories';
import type { Category } from '../api/categories';
import { useAuth } from '../api/auth-context';
import { useFavorites } from '../api/favorites-context';
import { AdCard } from '../components/AdCard';
import { FavoriteButton } from '../components/FavoriteButton';
import { FormError } from '../components/FormError';

export function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [filters, setFilters] = useState<AdFilters>({});
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { error: favoritesError } = useFavorites();
  const catalogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    categoriesApi
      .list()
      .then(setCategories)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    let current = true;
    adsApi
      .list(filters)
      .then((list) => current && setAds(list))
      .catch((e: Error) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [filters]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get('q'));
    setFilters((prev) => ({ ...prev, q }));
    catalogRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }

  // Очистка поля крестиком сразу возвращает все объявления
  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.value === '' && filters.q) {
      setFilters((prev) => ({ ...prev, q: '' }));
    }
  }

  const chooseCategory = (categoryId?: number) =>
    setFilters((prev) => ({ ...prev, categoryId }));

  return (
    <main className="content">
      <section className="hero">
        <div>
          <h2 className="hero__title">
            Что у&nbsp;вас пылится,
            <br />
            <em>другим пригодится!</em>
          </h2>
          <p className="hero__text">
            Размещайте объявления бесплатно и&nbsp;договаривайтесь
            с&nbsp;продавцом прямо в&nbsp;чате.
          </p>
          <form className="search" role="search" onSubmit={handleSearch}>
            <input
              name="q"
              type="search"
              aria-label="Поиск по названию"
              placeholder="Что ищете?"
              maxLength={100}
              onChange={handleSearchChange}
            />
            <button type="submit">
              <Search size={18} aria-hidden />
              Найти
            </button>
          </form>
        </div>
        {/* Декоративный коллаж */}
        <div className="collage" aria-hidden>
          <div className="collage__card collage__card--green">
            <Bike size={64} strokeWidth={1.5} />
          </div>
          <div className="collage__card collage__card--peach">
            <Sofa size={56} strokeWidth={1.5} />
          </div>
          <div className="collage__card collage__card--sand">
            <Smartphone size={44} strokeWidth={1.5} />
          </div>
        </div>
      </section>

      <section ref={catalogRef} className="catalog">
        <h2 className="section-title">Рубрики</h2>
        {error && <p className="form__error">{error}</p>}
        <FormError message={favoritesError} />
        <ul className="chips">
          <li>
            <button
              type="button"
              className="chip"
              aria-pressed={!filters.categoryId}
              onClick={() => chooseCategory(undefined)}
            >
              Все
            </button>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                className="chip"
                title={category.description ?? undefined}
                aria-pressed={filters.categoryId === category.id}
                onClick={() => chooseCategory(category.id)}
              >
                {category.name}
              </button>
            </li>
          ))}
        </ul>

        {ads && ads.length > 0 && (
          <ul className="ad-grid" aria-label="Объявления">
            {ads.map((ad) => (
              <li key={ad.id} className="favorable">
                <AdCard ad={ad} own={ad.author.id === user?.id} />
                <FavoriteButton ad={ad} />
              </li>
            ))}
          </ul>
        )}
        {ads?.length === 0 && (
          <p className="empty">
            {filters.categoryId || filters.q?.trim()
              ? 'Ничего не нашлось. Попробуйте другую рубрику или запрос.'
              : 'Скоро здесь появятся объявления — загляните чуть позже.'}
          </p>
        )}
      </section>
    </main>
  );
}
