'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { qs, fmtDateTime, label } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/SocketContext';
import Spinner from '@/components/Spinner';
import ErrorBox from '@/components/ErrorBox';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import Pagination from '@/components/Pagination';
import { UserChip } from '@/components/Badges';

const TABS = [['all', 'All'], ['unread', 'Unread']];

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { last, markRead, markAllRead, unread } = useNotifications();
  const [tab, setTab] = useState('all'); // all | unread | everyone (admin)
  const [page, setPage] = useState(1);
  const everyone = tab === 'everyone';

  const { data, loading, error, reload } = useAsync(
    () => api(`/notifications?${qs({ scope: everyone ? 'all' : 'me', unread: tab === 'unread' ? 'true' : '', page, limit: 15 })}`),
    [tab, page, last?.id]
  );

  const open = async (n) => {
    if (!everyone) { await markRead(n); reload(); }
    router.push(`/work-items/${n.entityId}`);
  };
  const switchTab = (t) => { setTab(t); setPage(1); };
  const tabs = user.role === 'ADMIN' ? [...TABS, ['everyone', 'Everyone (admin)']] : TABS;

  return (
    <>
      <PageHeader title="Notifications" subtitle="Stored in the database, so you see what you missed while offline.">
        {!everyone && <button className="btn secondary" disabled={!unread} onClick={async () => { await markAllRead(); reload(); }}>Mark all as read{unread ? ` (${unread})` : ''}</button>}
      </PageHeader>

      <div className="row" style={{ marginBottom: 16 }}>
        {tabs.map(([key, text]) => (
          <button key={key} className={`btn sm ${tab === key ? '' : 'secondary'}`} onClick={() => switchTab(key)}>{text}</button>
        ))}
      </div>

      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Spinner /> : data && (
        <div className="card" style={{ padding: 0, opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
          {data.data.length === 0 && <EmptyState icon="🎉" title={tab === 'unread' ? 'No unread notifications' : 'Nothing here yet'}>New activity on your work items will show up here instantly.</EmptyState>}
          {data.data.map((n) => (
            <div key={n.id} className={`notif ${n.isRead ? 'read' : 'unread'}`} onClick={() => open(n)} style={{ padding: '14px 18px' }}>
              <span className="unread-dot" />
              <div style={{ flex: 1 }}>
                <div>{n.message}</div>
                <div className="muted small">{label(n.type)} · {fmtDateTime(n.createdAt)}</div>
              </div>
              {everyone && n.recipient && <UserChip user={n.recipient} />}
            </div>
          ))}
        </div>
      )}
      {data && <Pagination meta={data.meta} onChange={setPage} />}
    </>
  );
}
