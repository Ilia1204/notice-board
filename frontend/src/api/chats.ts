import type { Socket } from 'socket.io-client';
import { ApiError, apiRequest } from './client';

export interface Message {
  id: number;
  chatId: number;
  senderId: number;
  text: string;
  createdAt: string;
  readAt: string | null;
}

// Собеседник — другая сторона диалога: продавец для покупателя и наоборот
export interface ChatSummary {
  id: number;
  ad: { id: number; title: string };
  companion: { id: number; name: string };
  lastMessage: Message | null;
  updatedAt: string;
  // Непрочитанные сообщения собеседника (Т12)
  unread: number;
}

export const chatsApi = {
  list: (token: string) => apiRequest<ChatSummary[]>('/chats', { token }),
  open: (adId: number, token: string) =>
    apiRequest<ChatSummary>('/chats', {
      method: 'POST',
      body: { adId },
      token,
    }),
  get: (id: number, token: string) =>
    apiRequest<ChatSummary>(`/chats/${id}`, { token }),
  messages: (id: number, token: string) =>
    apiRequest<Message[]>(`/chats/${id}/messages`, { token }),
  unread: (token: string) =>
    apiRequest<{ count: number }>('/chats/unread', { token }),
  read: (id: number, token: string) =>
    apiRequest<void>(`/chats/${id}/read`, { method: 'POST', token }),
  send: (id: number, text: string, token: string) =>
    apiRequest<Message>(`/chats/${id}/messages`, {
      method: 'POST',
      body: { text },
      token,
    }),
};

type SendAck = { message: Message } | { error: string };

// Сообщение уходит по WebSocket, а если соединения нет — обычным запросом
export async function sendMessage(
  chatId: number,
  text: string,
  token: string,
  socket: Socket | null,
): Promise<Message> {
  if (!socket?.connected) return chatsApi.send(chatId, text, token);
  let ack: SendAck;
  try {
    ack = (await socket
      .timeout(5000)
      .emitWithAck('message:send', { chatId, text })) as SendAck;
  } catch {
    return chatsApi.send(chatId, text, token);
  }
  if ('error' in ack) throw new ApiError(400, ack.error);
  return ack.message;
}

// Своё сообщение приходит и в ответе, и по WebSocket — второй раз не добавляем
export const addMessage = (list: Message[], message: Message): Message[] =>
  list.some((m) => m.id === message.id) ? list : [...list, message];

const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});
const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
});

// Сегодняшние сообщения — по времени, более ранние — по дате
export function formatSentAt(value: string, now = new Date()): string {
  const date = new Date(value);
  return date.toDateString() === now.toDateString()
    ? timeFormat.format(date)
    : dayFormat.format(date);
}
