import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../api/auth-context';
import { adsApi } from '../api/ads';
import type { Ad } from '../api/ads';
import { categoriesApi } from '../api/categories';
import type { Category } from '../api/categories';
import { FormError } from '../components/FormError';

// Публикация объявления (Т2) — только для вошедших пользователей
export function NewAdPage() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [created, setCreated] = useState<Ad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    categoriesApi
      .list()
      .then(setCategories)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const price = String(form.get('price')).trim();
    setError(null);
    setPending(true);
    try {
      const ad = await adsApi.create(
        {
          title: String(form.get('title')),
          description: String(form.get('description')),
          price: price === '' ? undefined : Number(price),
          categoryId: Number(form.get('categoryId')),
        },
        token!,
      );
      setCreated(ad);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (created) {
    return (
      <main className="content">
        <section className="form">
          <h2>Готово!</h2>
          <p>
            Объявление «{created.title}» опубликовано в категории «
            {created.category.name}».
          </p>
          <button type="submit" onClick={() => setCreated(null)}>
            Подать ещё одно
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="content">
      <form className="form form--wide" onSubmit={handleSubmit}>
        <h2>Новое объявление</h2>
        <label>
          Заголовок
          <input name="title" required minLength={3} maxLength={100} />
        </label>
        <label>
          Категория
          <select name="categoryId" required defaultValue="">
            <option value="" disabled>
              Выберите категорию
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Описание
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={2000}
            rows={6}
          />
        </label>
        <label>
          Цена, ₽
          <input
            name="price"
            type="number"
            min={0}
            step={1}
            placeholder="Пусто — договорная"
          />
        </label>
        <FormError message={error} />
        <button type="submit" disabled={pending}>
          {pending ? 'Публикация…' : 'Опубликовать'}
        </button>
      </form>
    </main>
  );
}
