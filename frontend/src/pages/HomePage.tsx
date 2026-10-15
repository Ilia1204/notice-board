import { Pin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { categoriesApi } from '../api/categories';
import type { Category } from '../api/categories';

export function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    categoriesApi
      .list()
      .then(setCategories)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="content">
      <section className="hero">
        <p className="hero__kicker">Объявления от соседей</p>
        <h2 className="hero__title">
          Продают, ищут и&nbsp;предлагают&nbsp;— <span>рядом с&nbsp;вами</span>
        </h2>
      </section>

      <section>
        <h2 className="section-title">Категории объявлений</h2>
        {error && <p className="form__error">{error}</p>}
        <ul className="stickers">
          {categories.map((category) => (
            <li key={category.id} className="sticker">
              <Pin size={16} className="sticker__pin" aria-hidden />
              <strong>{category.name}</strong>
              {category.description && <span>{category.description}</span>}
            </li>
          ))}
        </ul>
        <p className="note">
          Скоро здесь появятся объявления — следите за доской.
        </p>
      </section>
    </main>
  );
}
