import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../api/auth-context';
import { complaintReasons, complaintsApi } from '../api/complaints';
import type { Complaint, ComplaintDecision } from '../api/complaints';
import { FormError } from '../components/FormError';

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

// Одна цель — одно объявление или один пользователь
const sameTarget = (a: Complaint, b: Complaint) =>
  a.ad ? a.ad.id === b.ad?.id : a.user?.id === b.user?.id;

function Target({ complaint }: { complaint: Complaint }) {
  const { ad, user } = complaint;
  if (ad) {
    return (
      <h3>
        Объявление{' '}
        {ad.status === 'PUBLISHED' ? (
          <Link to={`/ads/${ad.id}`}>«{ad.title}»</Link>
        ) : (
          `«${ad.title}»`
        )}{' '}
        <span className="complaint__author">продавца {ad.author.name}</span>
      </h3>
    );
  }
  return <h3>Пользователь {user?.name}</h3>;
}

// Жалобы для модератора (Т13): принять — значит скрыть, отклонить — оставить как есть
export function ComplaintsPage() {
  const { token } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    complaintsApi
      .list(token!)
      .then(setComplaints)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  // Принятая жалоба закрывает и остальные жалобы на то же самое
  async function decide(complaint: Complaint, status: ComplaintDecision) {
    setError(null);
    try {
      await complaintsApi.resolve(complaint.id, status, token!);
      setComplaints(
        (list) =>
          list?.filter((item) =>
            status === 'ACCEPTED'
              ? !sameTarget(item, complaint)
              : item.id !== complaint.id,
          ) ?? null,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="content">
      <h2 className="section-title">Жалобы</h2>
      <FormError message={error} />
      {complaints && complaints.length > 0 && (
        <ul className="moderation" aria-label="Жалобы на рассмотрении">
          {complaints.map((complaint) => (
            <li key={complaint.id} className="moderation__item">
              <Target complaint={complaint} />
              <p>
                <strong>{complaintReasons[complaint.reason]}</strong>
              </p>
              {complaint.comment && (
                <p className="ad-page__description">{complaint.comment}</p>
              )}
              <p className="ad-card__meta">
                Пожаловался {complaint.reporter.name},{' '}
                {dateFormat.format(new Date(complaint.createdAt))}
              </p>
              <div className="ad-page__actions">
                <button
                  type="button"
                  className="action action--danger"
                  onClick={() => void decide(complaint, 'ACCEPTED')}
                >
                  {complaint.ad
                    ? 'Скрыть объявление'
                    : 'Скрыть все объявления пользователя'}
                </button>
                <button
                  type="button"
                  className="action"
                  onClick={() => void decide(complaint, 'DISMISSED')}
                >
                  Отклонить жалобу
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {complaints?.length === 0 && <p className="empty">Новых жалоб нет.</p>}
    </main>
  );
}
