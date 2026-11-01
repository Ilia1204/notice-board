import { Link } from 'react-router';
import { useAuth } from '../api/auth-context';

const today = new Date().toLocaleDateString('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

// Шапка в виде газетного заголовка: выходные данные, название, рубрики
export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="masthead">
      <div className="masthead__meta">
        <span>Ульяновск</span>
        <span>{today}</span>
        <span>Бесплатно</span>
      </div>
      <Link to="/" className="masthead__title">
        <h1>Доска объявлений</h1>
      </Link>
      <nav className="masthead__nav">
        {user ? (
          <>
            <Link to="/ads/new">Подать объявление</Link>
            {user.role === 'MODERATOR' && (
              <Link to="/categories">Категории</Link>
            )}
            <span className="masthead__user">
              {user.name}
              {user.role === 'MODERATOR' && (
                <span className="badge">модератор</span>
              )}
            </span>
            <button type="button" className="button-link" onClick={logout}>
              Выйти
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Войти</Link>
            <Link to="/register">Регистрация</Link>
          </>
        )}
      </nav>
    </header>
  );
}
