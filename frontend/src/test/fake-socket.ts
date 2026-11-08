import { vi } from 'vitest';

type Handler = (payload: unknown) => void;
const handlers = new Map<string, Set<Handler>>();

// Подменяет соединение Socket.IO: тест сам решает, есть ли связь и что пришло с сервера
export const fakeSocket = {
  connected: false,
  on: vi.fn((event: string, handler: Handler) => {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(handler);
  }),
  off: vi.fn((event: string, handler: Handler) => {
    handlers.get(event)?.delete(handler);
  }),
  emitWithAck: vi.fn(),
  timeout: vi.fn(() => fakeSocket),
  disconnect: vi.fn(),
};

export const io = vi.fn(() => fakeSocket);

// Событие от сервера получают все подписчики
export function serverEmit(event: string, payload: unknown): void {
  handlers.get(event)?.forEach((handler) => handler(payload));
}

export function resetFakeSocket(): void {
  handlers.clear();
  fakeSocket.connected = false;
  vi.clearAllMocks();
}
