'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useAssigneeOptions } from '@/lib/useAssigneeOptions';
import { PRIORITIES, isStaff } from '@/lib/constants';
import ErrorBox from './ErrorBox';

export default function WorkItemForm({ initialProject = '' }) {
  const { user } = useAuth();
  const router = useRouter();
  const staff = isStaff(user);
  const [form, setForm] = useState({
    type: staff ? 'TASK' : 'TICKET', title: '', description: '', priority: 'MEDIUM',
    project: initialProject, assignee: '', dueDate: '',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value, ...(k === 'project' ? { assignee: '' } : {}) }));

  const { data: projects } = useAsync(() => api('/projects?status=ACTIVE&limit=50').then((j) => j.data), []);
  const usableProjects = useMemo(() => {
    const list = projects || [];
    // tasks can only be created in projects the user manages; tickets in any project they belong to
    if (form.type === 'TASK' && user.role === 'MANAGER') return list.filter((p) => p.manager?.id === user.id);
    return list;
  }, [projects, form.type, user]);

  const canAssign = staff && (form.type === 'TASK' || !form.project || usableProjects.some((p) => p.id === form.project && (user.role === 'ADMIN' || p.manager?.id === user.id)));
  const assignees = useAssigneeOptions(form.project || null, canAssign);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      type: form.type, title: form.title, description: form.description, priority: form.priority,
      project: form.project || null,
      ...(canAssign && form.assignee ? { assignee: form.assignee } : {}),
      ...(canAssign && form.dueDate ? { dueDate: new Date(form.dueDate).toISOString() } : {}),
    };
    try {
      const j = await api('/work-items', { method: 'POST', body });
      router.push(`/work-items/${j.data.id}`);
    } catch (err) { setError(err); setBusy(false); }
  };

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 640 }}>
      <h1>{staff ? 'New work item' : 'Raise a support ticket'}</h1>
      {staff && (
        <>
          <label htmlFor="type">Type</label>
          <select id="type" value={form.type} onChange={set('type')}>
            <option value="TASK">Task (needs a project)</option>
            <option value="TICKET">Support ticket</option>
          </select>
        </>
      )}
      <label htmlFor="title">Title</label>
      <input id="title" required minLength={3} maxLength={200} value={form.title} onChange={set('title')} />
      <label htmlFor="description">Description</label>
      <textarea id="description" value={form.description} onChange={set('description')} />
      <div className="grid cols-2">
        <div>
          <label htmlFor="priority">Priority</label>
          <select id="priority" value={form.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
        </div>
        <div>
          <label htmlFor="project">Project {form.type === 'TASK' ? '(required)' : '(optional)'}</label>
          <select id="project" required={form.type === 'TASK'} value={form.project} onChange={set('project')}>
            <option value="">{form.type === 'TASK' ? 'Select a project' : 'No project (general support)'}</option>
            {usableProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {canAssign && (
          <>
            <div>
              <label htmlFor="assignee">Assignee</label>
              <select id="assignee" value={form.assignee} onChange={set('assignee')}>
                <option value="">Unassigned</option>
                {assignees.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="dueDate">Due date</label>
              <input id="dueDate" type="datetime-local" value={form.dueDate} onChange={set('dueDate')} />
            </div>
          </>
        )}
      </div>
      <ErrorBox error={error} />
      <button className="btn" style={{ marginTop: 14 }} disabled={busy}>{busy ? 'Saving...' : form.type === 'TASK' ? 'Create task' : 'Submit ticket'}</button>
    </form>
  );
}
