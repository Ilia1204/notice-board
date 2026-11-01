import { Bike, Smartphone, Sofa } from 'lucide-react';
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
        <div>
          <h2 className="hero__title">
            Вещам&nbsp;— <em>вторая жизнь</em>, соседям&nbsp;— выгода
          </h2>
          <p className="hero__text">
            Доска объявлений Ульяновска. Отдайте ненужное и&nbsp;найдите нужное
            рядом с&nbsp;домом.
          </p>
        </div>
        {/* Декоративный коллаж вместо фото, пока объявлений нет */}
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
          {categories.map((category) => (
            <li
              key={category.id}
              className="chip"
              title={category.description ?? undefined}
            >
              {category.name}
            </li>
          ))}
        </ul>
        <p className="empty">
          Скоро здесь появятся объявления — загляните чуть позже.
        </p>
      </section>
    </main>
  );
}
