import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { useAuth } from '../api/auth-context';
import { API_URL } from '../api/client';
import { SocketContext } from '../api/socket-context';

// Открывает WebSocket после входа и закрывает при выходе
export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    const connection = io(API_URL, { auth: { token } });
    setSocket(connection);
    return () => {
      connection.disconnect();
      setSocket(null);
    };
  }, [token]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}
