import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../api/auth-context';
import { chatsApi } from '../api/chats';
import type { Message } from '../api/chats';
import { useNewMessages } from '../api/socket-context';
import { UnreadContext } from '../api/unread-context';

interface Loaded {
  token: string;
  count: number;
}

// Число непрочитанных для шапки (Т12): растёт с каждым сообщением собеседника,
// уменьшается, когда диалог открыт. Как и избранное, привязано к токену
export function UnreadProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // Ответы могут прийти не по порядку — берём только последний запрос
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    const request = ++latest.current;
    try {
      const { count } = await chatsApi.unread(token);
      if (request === latest.current) setLoaded({ token, count });
    } catch {
      // Счётчик не главное на странице: при ошибке оставляем прежнее число
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useNewMessages(
    useCallback(
      (message: Message) => {
        if (message.senderId !== user?.id) void refresh();
      },
      [user?.id, refresh],
    ),
  );

  const count = token && loaded?.token === token ? loaded.count : 0;
  const value = useMemo(() => ({ count, refresh }), [count, refresh]);

  return (
    <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>
  );
}
