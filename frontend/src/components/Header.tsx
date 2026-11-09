import { Link } from 'react-router';
import { useAuth } from '../api/auth-context';
import { useUnread } from '../api/unread-context';

export function Header() {
  const { user, logout } = useAuth();
  const { count } = useUnread();

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
                <>
                  <Link to="/moderation">Модерация</Link>
                  <Link to="/categories">Категории</Link>
                </>
              )}
              <Link
                to="/chats"
                aria-label={
                  count > 0 ? `Сообщения, непрочитанных: ${count}` : undefined
                }
              >
                Сообщения
                {count > 0 && (
                  <span className="counter" aria-hidden>
                    {count}
                  </span>
                )}
              </Link>
              <Link to="/favorites">Избранное</Link>
              <Link to="/my-ads">Мои объявления</Link>
              <span className="header__user">
                <Link to="/profile">{user.name}</Link>
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
