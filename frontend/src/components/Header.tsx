import {
  ClipboardList,
  FolderCog,
  LogIn,
  LogOut,
  SquarePlus,
  UserPlus,
} from 'lucide-react';
import { Link } from 'react-router';
import { useAuth } from '../api/auth-context';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <Link to="/" className="header__brand">
        <ClipboardList size={24} aria-hidden />
        <h1>Доска объявлений</h1>
      </Link>
      <nav className="header__nav">
        {user ? (
          <>
            <Link to="/ads/new">
              <SquarePlus size={16} aria-hidden /> Подать объявление
            </Link>
            {user.role === 'MODERATOR' && (
              <Link to="/categories">
                <FolderCog size={16} aria-hidden /> Категории
              </Link>
            )}
            <span className="header__user">{user.name}</span>
            {user.role === 'MODERATOR' && (
              <span className="badge">модератор</span>
            )}
            <button type="button" className="button-link" onClick={logout}>
              <LogOut size={16} aria-hidden /> Выйти
            </button>
          </>
        ) : (
          <>
            <Link to="/login">
              <LogIn size={16} aria-hidden /> Войти
            </Link>
            <Link to="/register">
              <UserPlus size={16} aria-hidden /> Регистрация
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
