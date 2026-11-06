import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../api/auth-context';
import { usersApi } from '../api/users';
import type { UserProfile } from '../api/users';
import { FormError } from '../components/FormError';
import { MyAdsList } from '../components/MyAdsList';

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

// Свои данные и объявления (Т9)
export function ProfilePage() {
  const { token, updateUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    usersApi
      .me(token!)
      .then(setProfile)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setSaved(false);
    setPending(true);
    try {
      const updated = await usersApi.update(
        {
          name: String(form.get('name')),
          email: String(form.get('email')),
        },
        token!,
      );
      setProfile(updated);
      // Новое имя должно сразу появиться в шапке
      updateUser(updated);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="content">
      {profile ? (
        <form className="form" onSubmit={handleSubmit}>
          <h2>Профиль</h2>
          <p className="form__hint">
            На сайте с {dateFormat.format(new Date(profile.createdAt))}
          </p>
          <label>
            Имя
            <input
              name="name"
              required
              minLength={2}
              maxLength={50}
              autoComplete="name"
              defaultValue={profile.name}
            />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={profile.email}
            />
          </label>
          <FormError message={error} />
          {saved && (
            <p className="form__success" role="status">
              Изменения сохранены
            </p>
          )}
          <button type="submit" disabled={pending}>
            {pending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </form>
      ) : (
        <FormError message={error} />
      )}
      <section className="profile-ads">
        <h2 className="section-title">Мои объявления</h2>
        <MyAdsList />
      </section>
    </main>
  );
}
