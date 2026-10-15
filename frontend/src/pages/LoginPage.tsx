import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../api/auth-context';
import { FormError } from '../components/FormError';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setPending(true);
    try {
      await login({
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
        <h2>Вход</h2>
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
            autoComplete="current-password"
          />
        </label>
        <FormError message={error} />
        <button type="submit" disabled={pending}>
          {pending ? 'Вход…' : 'Войти'}
        </button>
        <p>
          Нет аккаунта? <Link to="/register">Зарегистрируйтесь</Link>
        </p>
      </form>
    </main>
  );
}
