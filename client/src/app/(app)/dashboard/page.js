'use client';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/SocketContext';
import Spinner from '@/components/Spinner';
import ErrorBox from '@/components/ErrorBox';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import WorkItemTable from '@/components/WorkItemTable';
import { StatusBadge } from '@/components/Badges';

const Stat = ({ icon, bg, label, value, hint, danger }) => (
  <div className="card hover stat-card">
    <div className="stat-ico" style={{ background: bg }}>{icon}</div>
    <div>
      <div className="muted small">{label}</div>
      <div className={`stat ${danger ? 'overdue' : ''}`}>{value}</div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  </div>
);

export default function DashboardPage() {
  const { user } = useAuth();
  const { last } = useNotifications();
  const { data, loading, error, reload } = useAsync(async () => {
    const [summary, recent] = await Promise.all([api('/dashboard/summary'), api('/work-items?limit=6&sortBy=updatedAt&order=desc')]);
    return { summary: summary.data, recent: recent.data };
  }, [last?.id]); // refresh when a live notification arrives

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  const { summary: s, recent } = data;
  const statuses = Object.entries(s.byStatus).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...statuses.map(([, c]) => c));

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]} 👋`} subtitle="A quick look at the work you can access." />
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Stat icon="🗂️" bg="#eef0ff" label="Total items" value={s.total} hint={`${s.byType.TASK} tasks · ${s.byType.TICKET} tickets`} />
        <Stat icon="🎯" bg="#e3f7ee" label="Open & assigned to me" value={s.myOpen} />
        <Stat icon="⏰" bg="#ffe9e9" label="Overdue" value={s.overdue} danger={s.overdue > 0} />
        <Stat icon="🔔" bg="#fff3d9" label="Unread notifications" value={s.unreadNotifications} />
      </div>
      <div className="grid cols-2">
        <div className="card">
          <h2>By status</h2>
          {statuses.length === 0 && <EmptyState icon="📊" title="Nothing to chart yet" />}
          {statuses.map(([status, count]) => (
            <div key={status} style={{ marginBottom: 14 }}>
              <div className="row between" style={{ marginBottom: 6 }}><StatusBadge status={status} /><strong>{count}</strong></div>
              <div className="bar"><span style={{ width: `${(count / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="row between"><h2>Recently updated</h2><Link href="/work-items">View all →</Link></div>
          <WorkItemTable items={recent} compact />
        </div>
      </div>
    </>
  );
}
