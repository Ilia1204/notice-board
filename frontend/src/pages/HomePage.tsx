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
      <section className="lead">
        <p className="kicker">Объявления от соседей</p>
        <h2 className="lead__title">
          Продают, ищут и&nbsp;предлагают&nbsp;— <mark>рядом с&nbsp;вами</mark>
        </h2>
        <p className="lead__text">
          Подать объявление&nbsp;— бесплатно. Модератор проверит его, и&nbsp;оно
          появится в&nbsp;нужной рубрике для всех соседей.
        </p>
      </section>

      <section>
        <h2 className="rubric-title">Рубрики</h2>
        {error && <p className="form__error">{error}</p>}
        <ol className="rubrics">
          {categories.map((category, index) => (
            <li key={category.id}>
              <span className="rubrics__number">
                {String(index + 1).padStart(2, '0')}
              </span>
              <strong>{category.name}</strong>
              {category.description && <p>{category.description}</p>}
            </li>
          ))}
        </ol>
        <p className="note">
          Скоро здесь появятся объявления — следите за выпусками.
        </p>
      </section>
    </main>
  );
}
