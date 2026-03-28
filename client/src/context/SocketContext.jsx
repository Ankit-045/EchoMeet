import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Read token for socket authentication
    const token = localStorage.getItem('echomeet_token');

    const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;

    const newSocket = io(backendUrl, {
      transports: ['polling', 'websocket'],
      path: '/socket.io',
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      withCredentials: true,
      auth: {
        token: token || '',
      },
    });

    newSocket.on('connect', () => {
      console.log('🔌 Socket connected:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('🔌 Socket connection error:', err.message);
      // If auth fails, don't keep retrying with bad credentials
      if (err.message === 'Authentication required') {
        console.warn('Socket auth failed — will retry when token is available');
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Update auth token when it changes (e.g., login/logout)
  useEffect(() => {
    if (!socket) return;

    const handleStorageChange = () => {
      const token = localStorage.getItem('echomeet_token');
      socket.auth = { token: token || '' };
      // Reconnect with new credentials if currently disconnected
      if (!socket.connected) {
        socket.connect();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};
