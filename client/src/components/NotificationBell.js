'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/context/SocketContext';
import { fmtDateTime } from '@/lib/format';

export default function NotificationBell() {
  const { notifications, unread, markRead, markAllRead, connected } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = async (n) => {
    await markRead(n);
    setOpen(false);
    router.push(`/work-items/${n.entityId}`);
  };

  return (
    <div className="bell" ref={ref}>
      <button className="bell-btn" onClick={() => setOpen((o) => !o)} aria-label={`Notifications (${unread} unread)`}>
        🔔{unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="panel">
          <div className="panel-head">
            <strong><span className={`live ${connected ? 'on' : ''}`} title={connected ? 'Live' : 'Offline'} />Notifications</strong>
            <button className="btn secondary sm" disabled={!unread} onClick={markAllRead}>Mark all read</button>
          </div>
          {notifications.length === 0 && <p className="muted" style={{ padding: 16 }}>You&apos;re all caught up.</p>}
          {notifications.map((n) => (
            <div key={n.id} className={`notif ${n.isRead ? 'read' : 'unread'}`} onClick={() => go(n)}>
              <span className="unread-dot" />
              <div>
                <div>{n.message}</div>
                <div className="muted small">{n.type.replace('_', ' ')} · {fmtDateTime(n.createdAt)}</div>
              </div>
            </div>
          ))}
          <div style={{ padding: 10, textAlign: 'center' }}>
            <button className="btn ghost sm" onClick={() => { setOpen(false); router.push('/notifications'); }}>View all notifications</button>
          </div>
        </div>
      )}
    </div>
  );
}
