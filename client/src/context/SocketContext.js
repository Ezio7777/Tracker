'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { api, API_URL, getAccessToken, refreshSession } from '@/lib/api';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);
export const useNotifications = () => useContext(SocketContext);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [last, setLast] = useState(null); // latest pushed notification (pages react to it)
  const [toast, setToast] = useState(null);
  const [connected, setConnected] = useState(false);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) { setNotifications([]); setUnread(0); return undefined; }
    let active = true;

    // 1) initial state from the DB (source of truth, survives reloads / missed events)
    api('/notifications?limit=20')
      .then((j) => { if (active) { setNotifications(j.data); setUnread(j.meta.unreadCount); } })
      .catch(() => {});

    // 2) live updates; auth is a function so every (re)connect sends the freshest token
    const socket = io(API_URL, { auth: (cb) => cb({ token: getAccessToken() }), withCredentials: true });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => { refreshSession().catch(() => {}); }); // expired token -> refresh, socket.io retries
    socket.on('notification:new', (n) => {
      setNotifications((prev) => [n, ...prev].slice(0, 50));
      setUnread((c) => c + 1);
      setLast(n);
      setToast(n);
    });
    return () => { active = false; socket.disconnect(); };
  }, [userId]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const markRead = useCallback(async (n) => {
    if (n.isRead) return;
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    setUnread((c) => Math.max(0, c - 1));
    try { await api(`/notifications/${n.id}/read`, { method: 'PATCH' }); } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
    try { await api('/notifications/read-all', { method: 'PATCH' }); } catch {}
  }, []);

  return (
    <SocketContext.Provider value={{ notifications, unread, last, toast, setToast, connected, markRead, markAllRead }}>
      {children}
    </SocketContext.Provider>
  );
}
