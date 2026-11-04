import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../api/auth-context';
import { adsApi } from '../api/ads';
import type { Ad } from '../api/ads';
import { AdForm } from '../components/AdForm';
import { FormError } from '../components/FormError';

// Редактирование своего объявления (Т5)
export function EditAdPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [ad, setAd] = useState<Ad | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adsApi
      .getMine(Number(id), token!)
      .then(setAd)
      .catch((e: Error) => setError(e.message));
  }, [id, token]);

  async function save(form: FormData) {
    await adsApi.update(Number(id), form, token!);
    await navigate('/my-ads');
  }

  return (
    <main className="content">
      <Link to="/my-ads" className="back-link">
        <ArrowLeft size={18} aria-hidden /> К моим объявлениям
      </Link>
      <FormError message={error} />
      {ad && (
        <AdForm
          ad={ad}
          heading="Изменить объявление"
          hint="После сохранения объявление снова пройдёт проверку модератором."
          submitLabel="Сохранить"
          pendingLabel="Сохранение…"
          onSubmit={save}
        />
      )}
    </main>
  );
}
