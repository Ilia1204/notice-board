import { Link, useNavigate } from 'react-router';
import { useAuth } from '../api/auth-context';
import type { Ad } from '../api/ads';
import { chatsApi } from '../api/chats';

interface Props {
  ad: Ad;
  onError: (message: string) => void;
}

// Открывает диалог с автором; повторное нажатие ведёт в уже начатый диалог
export function WriteSellerButton({ ad, onError }: Props) {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Link to="/login" className="action">
        Написать продавцу
      </Link>
    );
  }
  if (user.id === ad.author.id) return null;

  async function write() {
    try {
      const chat = await chatsApi.open(ad.id, token!);
      await navigate(`/chats/${chat.id}`);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <button type="button" className="action" onClick={() => void write()}>
      Написать продавцу
    </button>
  );
}
