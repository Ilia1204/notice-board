import { apiRequest } from './client';

export interface Message {
  id: number;
  chatId: number;
  senderId: number;
  text: string;
  createdAt: string;
}

// Собеседник — другая сторона диалога: продавец для покупателя и наоборот
export interface ChatSummary {
  id: number;
  ad: { id: number; title: string };
  companion: { id: number; name: string };
  lastMessage: Message | null;
  updatedAt: string;
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
  send: (id: number, text: string, token: string) =>
    apiRequest<Message>(`/chats/${id}/messages`, {
      method: 'POST',
      body: { text },
      token,
    }),
};

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
