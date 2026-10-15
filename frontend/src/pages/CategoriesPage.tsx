import { Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../api/auth-context';
import { categoriesApi } from '../api/categories';
import type { Category, CategoryData } from '../api/categories';
import { CategoryForm } from '../components/CategoryForm';
import { FormError } from '../components/FormError';

// Управление категориями (Т7) — доступно только модератору
export function CategoriesPage() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      categoriesApi
        .list()
        .then(setCategories)
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  async function create(data: CategoryData) {
    await categoriesApi.create(data, token!);
    await reload();
  }

  async function update(id: number, data: CategoryData) {
    await categoriesApi.update(id, data, token!);
    setEditingId(null);
    await reload();
  }

  async function remove(category: Category) {
    if (!window.confirm(`Удалить категорию «${category.name}»?`)) return;
    setError(null);
    try {
      await categoriesApi.remove(category.id, token!);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="content">
      <section className="panel">
        <h2>Категории</h2>
        <CategoryForm submitLabel="Добавить" onSubmit={create} />
        <FormError message={error} />
        <ul className="category-list">
          {categories.map((category) =>
            editingId === category.id ? (
              <li key={category.id}>
                <CategoryForm
                  initial={{
                    name: category.name,
                    description: category.description ?? '',
                  }}
                  submitLabel="Сохранить"
                  onSubmit={(data) => update(category.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li key={category.id}>
                <div>
                  <strong>{category.name}</strong>
                  {category.description && <p>{category.description}</p>}
                </div>
                <div className="category-list__actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Изменить ${category.name}`}
                    onClick={() => setEditingId(category.id)}
                  >
                    <Pencil size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Удалить ${category.name}`}
                    onClick={() => void remove(category)}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
        {categories.length === 0 && !error && <p>Категорий пока нет.</p>}
      </section>
    </main>
  );
}
