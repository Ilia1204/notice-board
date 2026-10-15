import { Tag } from 'lucide-react';
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
      <section className="panel">
        <h2>Категории объявлений</h2>
        {error && <p className="form__error">{error}</p>}
        <ul className="tags">
          {categories.map((category) => (
            <li key={category.id} title={category.description ?? undefined}>
              <Tag size={14} aria-hidden /> {category.name}
            </li>
          ))}
        </ul>
        <p>Объявления появятся здесь после реализации задачи Т3.</p>
      </section>
    </main>
  );
}
