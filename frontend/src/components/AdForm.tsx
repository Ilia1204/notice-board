import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { imageUrl, MAX_IMAGE_SIZE, MAX_IMAGES } from '../api/ads';
import type { Ad } from '../api/ads';
import { categoriesApi } from '../api/categories';
import type { Category } from '../api/categories';
import { FormError } from './FormError';

// Проверка фото до отправки; сервер повторяет её и отвечает теми же словами
function imagesError(files: File[], savedCount: number): string | null {
  if (files.length + savedCount > MAX_IMAGES) {
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

interface PhotoPickerProps {
  saved: Ad['images'];
  previews: string[];
  onAdd: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveSaved: (id: number) => void;
  onRemove: (index: number) => void;
}

// Выбор фото: уже сохранённые и новые показываются вместе
function PhotoPicker({
  saved,
  previews,
  onAdd,
  onRemoveSaved,
  onRemove,
}: PhotoPickerProps) {
  const total = saved.length + previews.length;

  return (
    <>
      {/* Своя кнопка вместо стандартной: у браузера она на английском */}
      <label className="file-field">
        Фото (до {MAX_IMAGES} шт., JPG/PNG/WEBP, до 5 МБ)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={onAdd}
        />
        <span className="file-field__row">
          <span className="file-field__button">
            {total > 0 ? 'Добавить ещё' : 'Выбрать фото'}
          </span>
          <span>
            {total > 0
              ? `Выбрано: ${total} из ${MAX_IMAGES}`
              : 'Файлы не выбраны'}
          </span>
        </span>
      </label>
      {total > 0 && (
        <ul className="previews">
          {saved.map((image, i) => (
            <li key={image.id}>
              <img
                src={imageUrl(image.filename)}
                alt={`Сохранённое фото ${i + 1}`}
              />
              <button
                type="button"
                className="previews__remove"
                aria-label={`Убрать сохранённое фото ${i + 1}`}
                onClick={() => onRemoveSaved(image.id)}
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
          {previews.map((url, i) => (
            <li key={url}>
              <img src={url} alt={`Фото ${i + 1}`} />
              <button
                type="button"
                className="previews__remove"
                aria-label={`Убрать фото ${i + 1}`}
                onClick={() => onRemove(i)}
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface AdFormProps {
  // Объявление, которое редактируем; без него форма пустая
  ad?: Ad;
  heading: string;
  hint: string;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (form: FormData) => Promise<void>;
}

// Форма объявления: общая для публикации (Т2) и редактирования (Т5)
export function AdForm({
  ad,
  heading,
  hint,
  submitLabel,
  pendingLabel,
  onSubmit,
}: AdFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [saved, setSaved] = useState(ad?.images ?? []);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
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

  function showImages(files: File[]) {
    setError(imagesError(files, saved.length));
    setImages(files);
    setPreviews(files.map((file) => URL.createObjectURL(file)));
  }

  // Новые фото добавляются к уже выбранным
  function handleImages(event: ChangeEvent<HTMLInputElement>) {
    showImages([...images, ...Array.from(event.target.files ?? [])]);
    // Сбрасываем поле, чтобы то же фото можно было выбрать снова
    event.target.value = '';
  }

  function removeImage(index: number) {
    showImages(images.filter((_, i) => i !== index));
  }

  function removeSaved(id: number) {
    const left = saved.filter((image) => image.id !== id);
    setSaved(left);
    setError(imagesError(images, left.length));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const imageProblem = imagesError(images, saved.length);
    if (imageProblem) {
      setError(imageProblem);
      return;
    }
    const form = new FormData(event.currentTarget);
    // Пустая цена — «договорная»
    if (String(form.get('price')).trim() === '') form.delete('price');
    images.forEach((image) => form.append('images', image));
    ad?.images
      .filter((image) => !saved.includes(image))
      .forEach((image) => form.append('removeImageIds', String(image.id)));
    setError(null);
    setPending(true);
    try {
      await onSubmit(form);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form form--wide" onSubmit={handleSubmit}>
      <h2>{heading}</h2>
      <p className="form__hint">{hint}</p>
      <label>
        Заголовок
        <input
          name="title"
          required
          minLength={3}
          maxLength={100}
          defaultValue={ad?.title}
        />
      </label>
      <label>
        Категория
        {/* key: значение по умолчанию применится, когда появятся рубрики */}
        <select
          key={categories.length}
          name="categoryId"
          required
          defaultValue={ad?.category.id ?? ''}
        >
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
          defaultValue={ad?.description}
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
          defaultValue={ad?.price ?? ''}
        />
      </label>
      <PhotoPicker
        saved={saved}
        previews={previews}
        onAdd={handleImages}
        onRemoveSaved={removeSaved}
        onRemove={removeImage}
      />
      <FormError message={error} />
      <button type="submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
