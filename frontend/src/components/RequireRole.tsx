import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import type { Role } from '../api/auth';
import { useAuth } from '../api/auth-context';

// Открывает страницу только вошедшему пользователю, а если указана роль — только ей
export function RequireRole({
  role,
  children,
}: {
  role?: Role;
  children: ReactNode;
}) {
  const { user, token } = useAuth();

  if (!token) return <Navigate to="/login" replace />;
  if (!user) return <p className="content">Загрузка…</p>;
  if (role && user.role !== role) {
    return (
      <main className="content">
        <p>Раздел доступен только модераторам.</p>
      </main>
    );
  }
  return children;
}
