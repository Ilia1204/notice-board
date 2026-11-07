import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../api/auth-context';
import { chatsApi, formatSentAt } from '../api/chats';
import type { ChatSummary } from '../api/chats';
import { FormError } from '../components/FormError';

// Список диалогов (Т10): свежие сверху
export function ChatsPage() {
  const { user, token } = useAuth();
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    chatsApi
      .list(token!)
      .then(setChats)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  return (
    <main className="content">
      <h2 className="section-title">Сообщения</h2>
      <FormError message={error} />
      {chats && chats.length > 0 && (
        <ul className="chat-list" aria-label="Диалоги">
          {chats.map((chat) => (
            <li key={chat.id}>
              <Link to={`/chats/${chat.id}`} className="chat-list__item">
                <span className="chat-list__head">
                  <strong>{chat.companion.name}</strong>
                  {chat.lastMessage && (
                    <time dateTime={chat.lastMessage.createdAt}>
                      {formatSentAt(chat.lastMessage.createdAt)}
                    </time>
                  )}
                </span>
                <span className="chat-list__ad">{chat.ad.title}</span>
                <span className="chat-list__last">
                  {chat.lastMessage?.senderId === user?.id && 'Вы: '}
                  {chat.lastMessage?.text}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {chats?.length === 0 && (
        <p className="empty">
          Диалогов пока нет. Напишите продавцу со страницы объявления.
        </p>
      )}
    </main>
  );
}
