import { ClipboardList } from 'lucide-react';

export function Header() {
  return (
    <header className="header">
      <ClipboardList size={24} aria-hidden />
      <h1>Доска объявлений</h1>
    </header>
  );
}
