import { Link } from 'react-router';
import { useAuth } from '../api/auth-context';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <div className="container header__inner">
        <Link to="/" className="header__logo">
          <h1>Сбагрим!</h1>
        </Link>
        <nav className="header__nav">
          {user ? (
            <>
              {user.role === 'MODERATOR' && (
                <Link to="/categories">Категории</Link>
              )}
              <span className="header__user">
                {user.name}
                {user.role === 'MODERATOR' && (
                  <span className="badge">модератор</span>
                )}
              </span>
              <button type="button" className="button-link" onClick={logout}>
                Выйти
              </button>
              <Link to="/ads/new" className="pill">
                Подать объявление
              </Link>
            </>
          ) : (
            <>
              <Link to="/login">Войти</Link>
              <Link to="/register" className="pill">
                Регистрация
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
