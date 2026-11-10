import { Flag } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../api/auth-context';
import type { Ad } from '../api/ads';
import { complaintReasons, complaintsApi } from '../api/complaints';
import type { ComplaintReason, ComplaintTarget } from '../api/complaints';
import { FormError } from './FormError';

type Subject = 'ad' | 'seller';

const titles: Record<Subject, string> = {
  ad: 'Жалоба на объявление',
  seller: 'Жалоба на продавца',
};

// Жалоба на объявление или его автора (Т13); своё объявление и гостям не показываем
export function ReportAd({ ad }: { ad: Ad }) {
  const { user, token } = useAuth();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [reason, setReason] = useState<ComplaintReason>('SPAM');
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.id === ad.author.id) return null;

  function open(next: Subject) {
    setSubject(next);
    setReason('SPAM');
    setComment('');
    setSent(false);
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const target: ComplaintTarget =
      subject === 'ad' ? { adId: ad.id } : { userId: ad.author.id };
    setSending(true);
    setError(null);
    try {
      await complaintsApi.create(target, reason, comment, token!);
      setSubject(null);
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="report">
      <p className="report__links">
        <Flag size={16} aria-hidden />
        <button
          type="button"
          className="button-link"
          onClick={() => open('ad')}
        >
          Пожаловаться на объявление
        </button>
        <span aria-hidden>·</span>
        <button
          type="button"
          className="button-link"
          onClick={() => open('seller')}
        >
          на продавца
        </button>
      </p>
      {sent && (
        <p className="form__success" role="status">
          Жалоба отправлена. Модератор её рассмотрит.
        </p>
      )}
      {subject && (
        <form
          className="report__form"
          aria-label={titles[subject]}
          onSubmit={(e) => void submit(e)}
        >
          <h3>{titles[subject]}</h3>
          <fieldset>
            <legend>Причина</legend>
            {Object.entries(complaintReasons).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value as ComplaintReason)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <label>
            Комментарий{reason === 'OTHER' ? '' : ' (необязательно)'}
            <textarea
              rows={3}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <FormError message={error} />
          <div className="ad-page__actions">
            <button type="submit" disabled={sending}>
              Отправить жалобу
            </button>
            <button
              type="button"
              className="action"
              onClick={() => setSubject(null)}
            >
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
