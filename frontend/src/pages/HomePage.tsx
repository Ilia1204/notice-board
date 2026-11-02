import { Bike, Search, Smartphone, Sofa } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { adsApi } from '../api/ads';
import type { Ad, AdFilters } from '../api/ads';
import { categoriesApi } from '../api/categories';
import type { Category } from '../api/categories';
import { AdCard } from '../components/AdCard';

export function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [filters, setFilters] = useState<AdFilters>({});
  const [error, setError] = useState<string | null>(null);

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
  }

  const chooseCategory = (categoryId?: number) =>
    setFilters((prev) => ({ ...prev, categoryId }));

  return (
    <main className="content">
      <section className="hero">
        <div>
          <h2 className="hero__title">
            Вещам&nbsp;— <em>вторая жизнь</em>, соседям&nbsp;— выгода
          </h2>
          <p className="hero__text">
            Доска объявлений по всей стране. Отдайте ненужное и&nbsp;найдите
            нужное рядом с&nbsp;домом.
          </p>
          <form className="search" role="search" onSubmit={handleSearch}>
            <input
              name="q"
              type="search"
              aria-label="Поиск по названию"
              placeholder="Что ищете?"
              maxLength={100}
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

      <section>
        <h2 className="section-title">Рубрики</h2>
        {error && <p className="form__error">{error}</p>}
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
              <li key={ad.id}>
                <AdCard ad={ad} />
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
