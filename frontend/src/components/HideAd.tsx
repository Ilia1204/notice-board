import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../api/auth-context';
import { adsApi } from '../api/ads';
import type { Ad } from '../api/ads';
import { RejectForm } from './RejectForm';

// Модератор скрывает опубликованное объявление и объясняет автору почему
export function HideAd({ ad }: { ad: Ad }) {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (user?.role !== 'MODERATOR') return null;

  // Скрытое объявление больше не открывается, поэтому уходим на главную
  async function hide(reason: string) {
    await adsApi.moderate(ad.id, 'REJECTED', token!, reason);
    await navigate('/');
  }

  if (!open) {
    return (
      <button
        type="button"
        className="action action--danger"
        onClick={() => setOpen(true)}
      >
        Скрыть
      </button>
    );
  }
  return (
    <RejectForm
      title="Почему скрываете объявление?"
      submitLabel="Скрыть"
      onSubmit={hide}
      onCancel={() => setOpen(false)}
    />
  );
}
