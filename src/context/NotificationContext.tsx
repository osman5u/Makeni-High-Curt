'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import axiosInstance from '@/utils/axiosInstance';

interface NotificationContextType {
  notificationCount: number;
  refreshNotificationCount: () => Promise<void>;
  decrementCount: () => void;
  resetCount: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { user, token } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);

  const refreshNotificationCount = async () => {
    try {
      const response = await axiosInstance.get('/notifications/count');
      setNotificationCount(response.data.count);
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  };

  const decrementCount = () => {
    setNotificationCount(prev => Math.max(0, prev - 1));
  };

  const resetCount = () => {
    setNotificationCount(0);
  };

  // Fetch notification count once when user is authenticated (no auto refresh)
  useEffect(() => {
    if (!user) {
      setNotificationCount(0);
      return;
    }
    refreshNotificationCount();
  }, [user]);

  // Realtime updates via Socket.IO (per-user private channel)
  useEffect(() => {
    if (!user || !token) {
      return;
    }

    let socket: any;
    let unsubscribed = false;

    (async () => {
      try {
        const mod = await import('socket.io-client');
        const io = (mod as any).io || (mod as any).default?.io || (mod as any).default || (mod as any);
        // Establish connection with both auth and header for robustness across proxies
        socket = io('/', {
          path: '/socket.io',
          transports: ['websocket'], // prefer WS to avoid slow polling fallbacks
          auth: { token },
          extraHeaders: { Authorization: `Bearer ${token}` },
        });

        // Join the user's private notifications room
        socket.emit('join-notifications', user.id);

        const onCreated = () => setNotificationCount((prev) => prev + 1);
        const onNew = () => setNotificationCount((prev) => prev + 1);
        const onCount = (data: any) => {
          if (data && typeof data.count === 'number') {
            setNotificationCount(data.count);
          }
        };

        socket.on('notification-created', onCreated);
        socket.on('notification-new', onNew);
        socket.on('notification-count', onCount);

        socket.on('connect_error', (err: any) => {
          console.error('Socket.IO notifications connection error:', err);
        });

        // Cleanup
        const cleanup = () => {
          try {
            socket?.off('notification-created', onCreated);
            socket?.off('notification-new', onNew);
            socket?.off('notification-count', onCount);
            socket?.disconnect();
          } catch {}
        };

        if (unsubscribed) cleanup();
        else return cleanup;
      } catch (e) {
        // Fallback: do nothing, polling will continue
        console.error('Failed to initialize Socket.IO client for notifications:', e);
      }
    })();

    return () => {
      unsubscribed = true;
      try { socket?.disconnect(); } catch {}
    };
  }, [user, token]);

  const value = {
    notificationCount,
    refreshNotificationCount,
    decrementCount,
    resetCount,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};