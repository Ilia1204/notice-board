import { createContext, useContext } from 'react';

export interface UnreadContextValue {
  count: number;
  refresh: () => Promise<void>;
}

// Без провайдера (у гостя) счётчик просто пустой
export const UnreadContext = createContext<UnreadContextValue>({
  count: 0,
  refresh: () => Promise.resolve(),
});

export const useUnread = (): UnreadContextValue => useContext(UnreadContext);
