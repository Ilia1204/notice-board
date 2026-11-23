import { X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { useAdModerated } from '../api/socket-context';
import type { AdModerated } from '../api/socket-context';

// Всплывающее сообщение автору о решении модератора, пока он на сайте.
// Тот, кто зашёл позже, увидит статус и причину в «Моих объявлениях» и при правке
export function ModerationNotice() {
  const [notices, setNotices] = useState<AdModerated[]>([]);

  useAdModerated(
    useCallback((event: AdModerated) => {
      // Повторное решение по тому же объявлению заменяет прежнее
      setNotices((list) => [
        ...list.filter((notice) => notice.id !== event.id),
        event,
      ]);
    }, []),
  );

  const close = (id: number) =>
    setNotices((list) => list.filter((notice) => notice.id !== id));

  if (notices.length === 0) return null;

  return (
    <div className="notices">
      {notices.map((notice) => (
        <div
          key={notice.id}
          role="status"
          className={`notice notice--${notice.status.toLowerCase()}`}
        >
          <div className="notice__text">
            {notice.status === 'PUBLISHED' ? (
              <>
                <strong>Объявление «{notice.title}» опубликовано</strong>
                <Link to={`/ads/${notice.id}`} onClick={() => close(notice.id)}>
                  Открыть
                </Link>
              </>
            ) : (
              <>
                <strong>Объявление «{notice.title}» отклонено</strong>
                {notice.rejectReason && (
                  <span>Причина: {notice.rejectReason}</span>
                )}
                <Link
                  to={`/ads/${notice.id}/edit`}
                  onClick={() => close(notice.id)}
                >
                  Исправить
                </Link>
              </>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Закрыть уведомление"
            onClick={() => close(notice.id)}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
