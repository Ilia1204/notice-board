import { createContext, useContext, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import type { Ad } from './ads';
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

// Собеседник открыл диалог: всё, что ему отправлено, прочитано
export interface ReadReceipt {
  chatId: number;
  readAt: string;
}

export function useReadReceipts(onRead: (receipt: ReadReceipt) => void): void {
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    socket.on('messages:read', onRead);
    return () => {
      socket.off('messages:read', onRead);
    };
  }, [socket, onRead]);
}

// Собеседник набирает сообщение в одном из диалогов
export function useTyping(onTyping: (event: { chatId: number }) => void): void {
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    socket.on('typing', onTyping);
    return () => {
      socket.off('typing', onTyping);
    };
  }, [socket, onTyping]);
}

// Модератор принял решение по объявлению пользователя
export type AdModerated = Pick<Ad, 'id' | 'title' | 'status' | 'rejectReason'>;

export function useAdModerated(
  onModerated: (event: AdModerated) => void,
): void {
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    socket.on('ad:moderated', onModerated);
    return () => {
      socket.off('ad:moderated', onModerated);
    };
  }, [socket, onModerated]);
}
