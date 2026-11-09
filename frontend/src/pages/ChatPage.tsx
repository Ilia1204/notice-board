import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../api/auth-context';
import { addMessage, chatsApi, formatSentAt, sendMessage } from '../api/chats';
import type { ChatSummary, Message } from '../api/chats';
import { useNewMessages, useSocket } from '../api/socket-context';
import { useUnread } from '../api/unread-context';
import { FormError } from '../components/FormError';

// Диалог (Т10, Т11, Т12): история переписки, отправка и приём без перезагрузки;
// всё, что видно на экране, считается прочитанным
export function ChatPage() {
  const { id } = useParams();
  // Номер диалога берём из адреса: подписка готова ещё до загрузки истории
  const chatId = Number(id);
  const { user, token } = useAuth();
  const socket = useSocket();
  const { refresh: refreshUnread } = useUnread();
  const [chat, setChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const bottom = useRef<HTMLLIElement>(null);

  const markRead = useCallback(
    () =>
      chatsApi
        .read(chatId, token!)
        .then(refreshUnread)
        .catch(() => undefined),
    [chatId, token, refreshUnread],
  );

  useEffect(() => {
    Promise.all([
      chatsApi.get(chatId, token!),
      chatsApi.messages(chatId, token!),
    ])
      .then(([loaded, history]) => {
        setChat(loaded);
        setMessages(history);
        void markRead();
      })
      .catch((e: Error) => setError(e.message));
  }, [chatId, token, markRead]);

  useNewMessages(
    useCallback(
      (message: Message) => {
        if (message.chatId !== chatId) return;
        setMessages((current) => addMessage(current, message));
        if (message.senderId !== user?.id) void markRead();
      },
      [chatId, user?.id, markRead],
    ),
  );

  // Последнее сообщение всегда на виду
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' });
  }, [messages]);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!chat || !text.trim() || pending) return;
    setError(null);
    setPending(true);
    try {
      const message = await sendMessage(chat.id, text, token!, socket);
      setMessages((current) => addMessage(current, message));
      setText('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  // Enter отправляет, Shift+Enter переносит строку
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <main className="content">
      <Link to="/chats" className="back-link">
        <ArrowLeft size={18} aria-hidden /> Все диалоги
      </Link>
      {chat && (
        <section className="chat">
          <header className="chat__head">
            <h2>{chat.companion.name}</h2>
            <Link to={`/ads/${chat.ad.id}`}>{chat.ad.title}</Link>
          </header>
          <ul className="chat__messages" aria-label="Сообщения">
            {messages.length === 0 && (
              <li className="chat__hint">Напишите первое сообщение</li>
            )}
            {messages.map((message) => (
              <li
                key={message.id}
                className={
                  message.senderId === user?.id
                    ? 'bubble bubble--mine'
                    : 'bubble'
                }
              >
                <p>{message.text}</p>
                <time dateTime={message.createdAt}>
                  {formatSentAt(message.createdAt)}
                </time>
              </li>
            ))}
            <li ref={bottom} aria-hidden className="chat__end" />
          </ul>
          <form className="chat__form" onSubmit={handleSubmit}>
            <textarea
              aria-label="Сообщение"
              placeholder="Сообщение"
              rows={2}
              maxLength={2000}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button type="submit" disabled={pending || !text.trim()}>
              Отправить
            </button>
          </form>
        </section>
      )}
      <FormError message={error} />
    </main>
  );
}
