import { createContext, useContext, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import type { Message } from './chats';

// Соединение с сервером для чата; у гостя его нет
export const SocketContext = createContext<Socket | null>(null);

export const useSocket = (): Socket | null => useContext(SocketContext);

// Подписка на новые сообщения во всех диалогах пользователя
export function useNewMessages(onMessage: (message: Message) => void): void {
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    socket.on('message:new', onMessage);
    return () => {
      socket.off('message:new', onMessage);
    };
  }, [socket, onMessage]);
}
