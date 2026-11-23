'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { useAuth } from '@/context/AuthContext';
import { qs, fmtDate } from '@/lib/format';
import Spinner from '@/components/Spinner';
import ErrorBox from '@/components/ErrorBox';
import Pagination from '@/components/Pagination';
import PageHeader from '@/components/PageHeader';
import { UserChip } from '@/components/Badges';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState(null);

  useEffect(() => { if (user.role !== 'ADMIN') router.replace('/dashboard'); }, [user, router]);
  const { data, loading, error, reload } = useAsync(
    () => (user.role === 'ADMIN' ? api(`/users?${qs({ q, role, page, limit: 15 })}`) : Promise.resolve(null)),
    [q, role, page]
  );

  const update = async (id, suffix, body) => {
    setActionError(null);
    try { await api(`/users/${id}/${suffix}`, { method: 'PATCH', body }); reload(); } catch (err) { setActionError(err); }
  };

  if (user.role !== 'ADMIN') return null;
  return (
    <>
      <PageHeader title="User management" subtitle="Change roles or deactivate accounts. Changes apply immediately." />
      <div className="card row">
        <input style={{ maxWidth: 280 }} placeholder="Search name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search users" />
        <select style={{ maxWidth: 180 }} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Filter by role">
          <option value="">All roles</option><option>ADMIN</option><option>MANAGER</option><option>MEMBER</option>
        </select>
      </div>
      <ErrorBox error={actionError} />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Spinner /> : data && (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>
              {data.data.map((u) => {
                const self = u._id === user._id;
                return (
                  <tr key={u._id}>
                    <td><UserChip user={u} />{self && <span className="badge" style={{ marginLeft: 6 }}>You</span>}</td>
                    <td>{u.email}</td>
                    <td>
                      <select value={u.role} disabled={self} style={{ width: 130 }} onChange={(e) => update(u._id, 'role', { role: e.target.value })} aria-label={`Role for ${u.name}`}>
                        <option>ADMIN</option><option>MANAGER</option><option>MEMBER</option>
                      </select>
                    </td>
                    <td>
                      <button className={`btn sm ${u.isActive ? 'secondary' : ''}`} disabled={self} onClick={() => update(u._id, 'status', { isActive: !u.isActive })}>
                        {u.isActive ? 'Active - deactivate' : 'Inactive - activate'}
                      </button>
                    </td>
                    <td className="muted">{fmtDate(u.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination meta={data.meta} onChange={setPage} />
        </div>
      )}
    </>
  );
}
