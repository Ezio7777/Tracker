'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { useAuth } from '@/context/AuthContext';
import Spinner from '@/components/Spinner';
import ErrorBox from '@/components/ErrorBox';
import { StatusBadge, UserChip } from '@/components/Badges';
import WorkItemTable from '@/components/WorkItemTable';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [actionError, setActionError] = useState(null);
  const [pick, setPick] = useState('');

  const { data: project, loading, error, reload } = useAsync(() => api(`/projects/${id}`).then((j) => j.data), [id]);
  const canManage = project && (user.role === 'ADMIN' || project.owner._id === user._id);

  const { data: candidates } = useAsync(async () => {
    if (!canManage) return [];
    const j = await api('/users?limit=50');
    return j.data.filter((u) => u.role !== 'ADMIN' && u.isActive !== false);
  }, [canManage]);

  const { data: items, reload: reloadItems } = useAsync(() => api(`/work-items?project=${id}&limit=10&sortBy=updatedAt`).then((j) => j.data), [id]);

  const run = async (fn) => {
    setActionError(null);
    try { await fn(); await reload(); reloadItems(); } catch (err) { setActionError(err); }
  };

  if (loading && !project) return <Spinner />;
  if (error && !project) return <ErrorBox error={error} onRetry={reload} />;

  const memberIds = new Set([project.owner._id, ...project.members.map((m) => m._id)]);
  const addable = (candidates || []).filter((u) => !memberIds.has(u._id));

  return (
    <>
      <p className="small"><Link href="/projects">← Projects</Link></p>
      <div className="row between">
        <div>
          <h1>{project.name} <StatusBadge status={project.status} /></h1>
          <p className="muted">{project.description || 'No description'}</p>
        </div>
        <div className="row">
          <Link className="btn secondary" href={`/work-items?project=${id}`}>All work items</Link>
          {canManage && project.status === 'ACTIVE' && <Link className="btn" href={`/work-items/new?project=${id}`}>Add work item</Link>}
          {canManage && (
            <button className="btn secondary" onClick={() => run(() => api(`/projects/${id}`, { method: 'PATCH', body: { status: project.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' } }))}>
              {project.status === 'ACTIVE' ? 'Archive' : 'Restore'}
            </button>
          )}
        </div>
      </div>
      <ErrorBox error={actionError} />

      <div className="card">
        <h2>Team</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
            <tbody>
              <tr><td><UserChip user={project.owner} /> <span className="badge" style={{ marginLeft: 6 }}>Owner</span></td><td>{project.owner.email}</td><td>{project.owner.role}</td><td /></tr>
              {project.members.map((m) => (
                <tr key={m._id}>
                  <td><UserChip user={m} /></td><td className="muted">{m.email}</td><td>{m.role}</td>
                  <td style={{ textAlign: 'right' }}>
                    {canManage && <button className="btn danger sm" onClick={() => run(() => api(`/projects/${id}/members/${m._id}`, { method: 'DELETE' }))}>Remove</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canManage && (
          <div className="row" style={{ marginTop: 12 }}>
            <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ maxWidth: 320 }} aria-label="Add member">
              <option value="">Add a member...</option>
              {addable.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
            </select>
            <button className="btn" disabled={!pick} onClick={() => run(async () => { await api(`/projects/${id}/members`, { method: 'POST', body: { userId: pick } }); setPick(''); })}>Add</button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Latest work items</h2>
        <WorkItemTable items={items || []} compact />
      </div>
    </>
  );
}
