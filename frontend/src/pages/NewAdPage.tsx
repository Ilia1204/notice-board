import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useAuth } from '../api/auth-context';
import { adsApi, imageUrl, MAX_IMAGE_SIZE, MAX_IMAGES } from '../api/ads';
import type { Ad } from '../api/ads';
import { categoriesApi } from '../api/categories';
import type { Category } from '../api/categories';
import { FormError } from '../components/FormError';

// Проверка фото до отправки; сервер повторяет её и отвечает теми же словами
function imagesError(files: File[]): string | null {
  if (files.length > MAX_IMAGES) {
    return `Можно прикрепить не больше ${MAX_IMAGES} фото`;
  }
  if (
    files.some(
      (f) => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type),
    )
  ) {
    return 'Фото должны быть в формате JPG, PNG или WEBP';
  }
  if (files.some((f) => f.size > MAX_IMAGE_SIZE)) {
    return 'Каждое фото должно быть не больше 5 МБ';
  }
  return null;
}

// Публикация объявления (Т2) — только для вошедших пользователей
export function NewAdPage() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [created, setCreated] = useState<Ad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    categoriesApi
      .list()
      .then(setCategories)
      .catch((e: Error) => setError(e.message));
  }, []);

  // Освобождаем память от старых превью
  useEffect(
    () => () => previews.forEach((url) => URL.revokeObjectURL(url)),
    [previews],
  );

  function handleImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setError(imagesError(files));
    setImages(files);
    setPreviews(files.map((file) => URL.createObjectURL(file)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const imageProblem = imagesError(images);
    if (imageProblem) {
      setError(imageProblem);
      return;
    }
    const form = new FormData(event.currentTarget);
    // Пустая цена — «договорная»
    if (String(form.get('price')).trim() === '') form.delete('price');
    images.forEach((image) => form.append('images', image));
    setError(null);
    setPending(true);
    try {
      setCreated(await adsApi.create(form, token!));
      setImages([]);
      setPreviews([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (created) {
    const cover = created.images[0];
    return (
      <main className="content">
        <section className="form">
          <h2>Готово!</h2>
          {cover && (
            <img
              className="ad-cover"
              src={imageUrl(cover.filename)}
              alt={created.title}
            />
          )}
          <p>
            Объявление «{created.title}» в категории «{created.category.name}»
            отправлено на модерацию. После проверки его увидят все.
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
        <label>
          Фото (до {MAX_IMAGES} шт., JPG/PNG/WEBP, до 5 МБ)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleImages}
          />
        </label>
        {previews.length > 0 && (
          <ul className="previews">
            {previews.map((url, i) => (
              <li key={url}>
                <img src={url} alt={`Фото ${i + 1}`} />
              </li>
            ))}
          </ul>
        )}
        <FormError message={error} />
        <button type="submit" disabled={pending}>
          {pending ? 'Публикация…' : 'Опубликовать'}
        </button>
      </form>
    </main>
  );
}
