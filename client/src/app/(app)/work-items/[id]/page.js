'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { useNotifications } from '@/context/SocketContext';
import { useAssigneeOptions } from '@/lib/useAssigneeOptions';
import { PRIORITIES } from '@/lib/constants';
import { fmtDateTime, label, toInputDateTime } from '@/lib/format';
import Spinner from '@/components/Spinner';
import ErrorBox from '@/components/ErrorBox';
import { StatusBadge, PriorityBadge, TypeBadge, UserChip } from '@/components/Badges';
import CommentSection from '@/components/CommentSection';
import HistoryTimeline from '@/components/HistoryTimeline';

export default function WorkItemDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { last } = useNotifications();
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data: item, loading, error, reload } = useAsync(() => api(`/work-items/${id}`).then((j) => j.data), [id]);
  const { data: history, reload: reloadHistory } = useAsync(() => api(`/work-items/${id}/history`).then((j) => j.data), [id]);
  const perms = item?.permissions;
  const assignees = useAssigneeOptions(item?.project?._id || null, editing && perms?.editScope === 'FULL');

  // Live: someone changed / commented on this item -> refresh everything
  useEffect(() => {
    if (last && last.entityId === id) { reload(); reloadHistory(); setTick((t) => t + 1); }
  }, [last]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAll = async () => { await reload(); reloadHistory(); };
  const act = async (fn) => {
    setBusy(true);
    setActionError(null);
    try { await fn(); await refreshAll(); } catch (err) { setActionError(err); }
    setBusy(false);
  };

  const startEdit = () => {
    setForm({
      title: item.title, description: item.description, priority: item.priority,
      assignee: item.assignee?._id || '', dueDate: toInputDateTime(item.dueDate),
    });
    setEditing(true);
  };

  const saveEdit = (e) => {
    e.preventDefault();
    const body = {};
    if (perms.editableFields.includes('title') && form.title !== item.title) body.title = form.title;
    if (perms.editableFields.includes('description') && form.description !== item.description) body.description = form.description;
    if (perms.editableFields.includes('priority') && form.priority !== item.priority) body.priority = form.priority;
    if (perms.editableFields.includes('assignee') && form.assignee !== (item.assignee?._id || '')) body.assignee = form.assignee || null;
    if (perms.editableFields.includes('dueDate') && form.dueDate !== toInputDateTime(item.dueDate)) body.dueDate = form.dueDate ? new Date(form.dueDate).toISOString() : null;
    if (!Object.keys(body).length) return setEditing(false);
    act(async () => { await api(`/work-items/${id}`, { method: 'PATCH', body }); setEditing(false); });
  };

  const remove = () => {
    if (!window.confirm('Delete this work item? It will be hidden from everyone.')) return;
    act(async () => { await api(`/work-items/${id}`, { method: 'DELETE' }); router.push('/work-items'); });
  };

  if (loading && !item) return <Spinner />;
  if (error && !item) {
    return (
      <>
        <ErrorBox error={error} onRetry={reload} />
        <Link href="/work-items">← Back to work items</Link>
      </>
    );
  }

  const can = (f) => perms.editableFields.includes(f);

  return (
    <>
      <p className="small"><Link href="/work-items">← Work items</Link></p>
      <ErrorBox error={actionError} />

      <div className="card">
        <div className="row between">
          <div className="row"><TypeBadge type={item.type} /><StatusBadge status={item.status} /><PriorityBadge priority={item.priority} /></div>
          <div className="row">
            {perms.allowedNextStatuses.length > 0 && (
              <select aria-label="Change status" disabled={busy} value="" onChange={(e) => e.target.value && act(() => api(`/work-items/${id}`, { method: 'PATCH', body: { status: e.target.value } }))}>
                <option value="">Move to...</option>
                {perms.allowedNextStatuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </select>
            )}
            {perms.canEscalate && <button className="btn danger sm" disabled={busy} onClick={() => act(() => api(`/work-items/${id}/escalate`, { method: 'POST' }))}>Escalate</button>}
            {perms.editableFields.length > 0 && !editing && <button className="btn secondary sm" onClick={startEdit}>Edit</button>}
            {perms.canDelete && <button className="btn danger sm" disabled={busy} onClick={remove}>Delete</button>}
          </div>
        </div>

        {!editing ? (
          <>
            <h1 style={{ marginTop: 12 }}>{item.title}</h1>
            <p style={{ whiteSpace: 'pre-wrap' }}>{item.description || <span className="muted">No description.</span>}</p>
          </>
        ) : (
          <form onSubmit={saveEdit}>
            {can('title') && (<><label htmlFor="t">Title</label><input id="t" required minLength={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></>)}
            {can('description') && (<><label htmlFor="d">Description</label><textarea id="d" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></>)}
            <div className="grid cols-2">
              {can('priority') && (<div><label htmlFor="p">Priority</label><select id="p" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></div>)}
              {can('assignee') && (
                <div><label htmlFor="a">Assignee</label>
                  <select id="a" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}>
                    <option value="">Unassigned</option>
                    {assignees.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
                  </select>
                </div>
              )}
              {can('dueDate') && (<div><label htmlFor="due">Due date</label><input id="due" type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>)}
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" disabled={busy}>Save</button>
              <button type="button" className="btn secondary" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        )}

        <hr className="divider" />
        <div className="grid cols-4">
          <div><div className="meta-label">Project</div>{item.project ? <Link href={`/projects/${item.project._id}`}>{item.project.name}</Link> : 'None (general support)'}</div>
          <div><div className="meta-label">Requester</div><UserChip user={item.requester} /></div>
          <div><div className="meta-label">Assignee</div><UserChip user={item.assignee} /></div>
          <div><div className="meta-label">Due</div>{fmtDateTime(item.dueDate)}</div>
          <div><div className="meta-label">Created</div>{fmtDateTime(item.createdAt)}</div>
          <div><div className="meta-label">Updated</div>{fmtDateTime(item.updatedAt)}</div>
          {item.escalatedAt && <div><div className="meta-label">Escalated</div>{fmtDateTime(item.escalatedAt)}</div>}
        </div>
        {perms.editableFields.length === 0 && <p className="muted small" style={{ marginTop: 12 }}>You have read-only access to this item.</p>}
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <CommentSection workItemId={id} refreshKey={tick} />
        <div className="card"><h2>Activity</h2><HistoryTimeline history={history || []} /></div>
      </div>
    </>
  );
}
