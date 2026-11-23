import { useState, type FormEvent } from 'react';
import { FormError } from './FormError';

// Частые причины: модератору не нужно каждый раз набирать их заново
const rejectReasons = [
  'Нет фото товара',
  'Мало подробностей в описании',
  'Не та рубрика',
  'Запрещённый товар или услуга',
];

const MAX_REASON = 300;

interface Props {
  title: string;
  submitLabel: string;
  onSubmit: (reason: string) => Promise<void>;
  onCancel: () => void;
}

// Причина отклонения: её увидит автор в «Моих объявлениях»
export function RejectForm({ title, submitLabel, onSubmit, onCancel }: Props) {
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      setError('Укажите причину отклонения');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
    } catch (e) {
      setError((e as Error).message);
      setSending(false);
    }
  }

  return (
    <form
      className="report__form"
      aria-label={title}
      onSubmit={(e) => void submit(e)}
    >
      <h3>{title}</h3>
      <p className="reject__presets">
        {rejectReasons.map((preset) => (
          <button
            key={preset}
            type="button"
            className="chip"
            aria-pressed={reason === preset}
            onClick={() => setReason(preset)}
          >
            {preset}
          </button>
        ))}
      </p>
      <label>
        Причина для автора
        <textarea
          rows={2}
          maxLength={MAX_REASON}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <FormError message={error} />
      <div className="ad-page__actions">
        <button
          type="submit"
          className="action action--danger"
          disabled={sending}
        >
          {submitLabel}
        </button>
        <button type="button" className="action" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}
