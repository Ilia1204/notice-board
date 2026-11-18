import { ArrowLeft, Check, CheckCheck } from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../api/auth-context';
import {
  addMessage,
  chatsApi,
  formatDay,
  formatTime,
  sendMessage,
} from '../api/chats';
import type { ChatSummary, Message } from '../api/chats';
import type { ReadReceipt } from '../api/socket-context';
import {
  useNewMessages,
  useReadReceipts,
  useSocket,
  useTyping,
} from '../api/socket-context';
import { useUnread } from '../api/unread-context';
import { FormError } from '../components/FormError';

// Сообщение в ленте; под своими — ✓ отправлено или ✓✓ прочитано
function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  const status = message.readAt ? 'Прочитано' : 'Отправлено';
  return (
    <li className={mine ? 'bubble bubble--mine' : 'bubble'}>
      <p>{message.text}</p>
      <div className="bubble__meta">
        <time dateTime={message.createdAt}>
          {formatTime(message.createdAt)}
        </time>
        {mine && (
          <span
            className={
              message.readAt
                ? 'bubble__status bubble__status--read'
                : 'bubble__status'
            }
            title={status}
            aria-label={status}
          >
            {message.readAt ? (
              <CheckCheck size={14} aria-hidden />
            ) : (
              <Check size={14} aria-hidden />
            )}
          </span>
        )}
      </div>
    </li>
  );
}

// Подпись дня ставим перед первым сообщением каждого дня
const startsDay = (messages: Message[], index: number) =>
  index === 0 ||
  new Date(messages[index - 1].createdAt).toDateString() !==
    new Date(messages[index].createdAt).toDateString();

// «Печатает…» шлём не чаще раза в 2 с и гасим через 3 с тишины
const TYPING_THROTTLE = 2000;
const TYPING_TIMEOUT = 3000;

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
  const [typing, setTyping] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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
        if (message.senderId !== user?.id) {
          setTyping(false);
          void markRead();
        }
      },
      [chatId, user?.id, markRead],
    ),
  );

  // ✓✓ на своих сообщениях, как только собеседник их прочитал
  useReadReceipts(
    useCallback(
      ({ chatId: readChatId, readAt }: ReadReceipt) => {
        if (readChatId !== chatId) return;
        setMessages((current) =>
          current.map((message) =>
            message.senderId === user?.id && !message.readAt
              ? { ...message, readAt }
              : message,
          ),
        );
      },
      [chatId, user?.id],
    ),
  );

  useTyping(
    useCallback(
      ({ chatId: typingChatId }: { chatId: number }) => {
        if (typingChatId !== chatId) return;
        setTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(
          () => setTyping(false),
          TYPING_TIMEOUT,
        );
      },
      [chatId],
    ),
  );

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  function handleTextChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setText(event.target.value);
    const now = Date.now();
    if (socket && now - lastTypingSent.current > TYPING_THROTTLE) {
      lastTypingSent.current = now;
      socket.emit('typing', { chatId });
    }
  }

  // Последнее сообщение всегда на виду; прокручиваем только ленту
  // сообщений, сама страница остаётся на месте
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
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
          <ul ref={list} className="chat__messages" aria-label="Сообщения">
            {messages.length === 0 && (
              <li className="chat__hint">Напишите первое сообщение</li>
            )}
            {messages.map((message, index) => (
              <Fragment key={message.id}>
                {startsDay(messages, index) && (
                  <li className="chat__day">{formatDay(message.createdAt)}</li>
                )}
                <Bubble
                  message={message}
                  mine={message.senderId === user?.id}
                />
              </Fragment>
            ))}
          </ul>
          {/* Строка под лентой занимает место всегда — чат не дёргается */}
          <div className="chat__typing" aria-live="polite">
            {typing && (
              <p>
                {chat.companion.name} печатает
                <span className="typing-dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
              </p>
            )}
          </div>
          <form className="chat__form" onSubmit={handleSubmit}>
            <textarea
              aria-label="Сообщение"
              placeholder="Сообщение"
              rows={2}
              maxLength={2000}
              value={text}
              onChange={handleTextChange}
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
