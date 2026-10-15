import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CategoryData } from '../api/categories';
import { FormError } from './FormError';

interface CategoryFormProps {
  initial?: CategoryData;
  submitLabel: string;
  onSubmit: (data: CategoryData) => Promise<void>;
  onCancel?: () => void;
}

export function CategoryForm({
  initial = { name: '', description: '' },
  submitLabel,
  onSubmit,
  onCancel,
}: CategoryFormProps) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await onSubmit({ name, description });
      if (!onCancel) {
        setName('');
        setDescription('');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="category-form" onSubmit={handleSubmit}>
      <input
        aria-label="Название"
        placeholder="Название"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        minLength={2}
        maxLength={50}
      />
      <input
        aria-label="Описание"
        placeholder="Описание (необязательно)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={200}
      />
      <button type="submit" disabled={pending}>
        {submitLabel}
      </button>
      {onCancel && (
        <button type="button" className="button-link" onClick={onCancel}>
          Отмена
        </button>
      )}
      <FormError message={error} />
    </form>
  );
}
