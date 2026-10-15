import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../api/auth-context';
import { FormError } from '../components/FormError';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setPending(true);
    try {
      await register({
        name: String(form.get('name')),
        email: String(form.get('email')),
        password: String(form.get('password')),
      });
      navigate('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="content">
      <form className="form" onSubmit={handleSubmit}>
        <h2>Регистрация</h2>
        <label>
          Имя
          <input name="name" required minLength={2} autoComplete="name" />
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>
        <FormError message={error} />
        <button type="submit" disabled={pending}>
          {pending ? 'Регистрация…' : 'Зарегистрироваться'}
        </button>
        <p>
          Уже есть аккаунт? <Link to="/login">Войдите</Link>
        </p>
      </form>
    </main>
  );
}
