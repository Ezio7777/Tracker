'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { useAuth } from '@/context/AuthContext';
import { isStaff } from '@/lib/constants';
import Spinner from '@/components/Spinner';
import ErrorBox from '@/components/ErrorBox';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import Pagination from '@/components/Pagination';
import { StatusBadge, UserChip } from '@/components/Badges';

export default function ProjectsPage() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useAsync(() => api(`/projects?page=${page}&limit=12`), [page]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api('/projects', { method: 'POST', body: form });
      setForm({ name: '', description: '' });
      setShowForm(false);
      page === 1 ? reload() : setPage(1);
    } catch (err) { setFormError(err); }
    setBusy(false);
  };

  const newButton = staff && (
    <button className="btn" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : '+ New project'}</button>
  );

  return (
    <>
      <PageHeader title="Projects" subtitle={staff ? 'Projects you own or belong to.' : 'Projects you are a member of.'}>{newButton}</PageHeader>

      {showForm && (
        <form className="card slide" onSubmit={create}>
          <h2>Create a project</h2>
          <div className="grid cols-2">
            <div><label htmlFor="pname" style={{ marginTop: 0 }}>Name</label><input id="pname" autoFocus required minLength={2} placeholder="e.g. Website revamp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label htmlFor="pdesc" style={{ marginTop: 0 }}>Description (optional)</label><input id="pdesc" placeholder="What is this project about?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <ErrorBox error={formError} />
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" disabled={busy}>{busy ? 'Creating...' : 'Create project'}</button>
            <button type="button" className="btn ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <p className="muted small" style={{ margin: '12px 0 0' }}>You become the project manager. Add team members from the project page afterwards.</p>
        </form>
      )}

      {loading && !data && <Spinner />}
      <ErrorBox error={error} onRetry={reload} />
      {data && data.data.length === 0 && (
        <div className="card">
          <EmptyState icon="📁" title="No projects yet" action={staff ? <button className="btn" onClick={() => setShowForm(true)}>+ Create your first project</button> : null}>
            {staff ? 'Create a project to start assigning tasks to your team.' : 'You have not been added to any project yet. Ask a manager to add you.'}
          </EmptyState>
        </div>
      )}
      {data && data.data.length > 0 && (
        <>
          <div className="grid cols-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
            {data.data.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="card hover project-card" style={{ marginBottom: 0 }}>
                <div className="row between" style={{ alignItems: 'flex-start' }}><h3>{p.name}</h3><StatusBadge status={p.status} /></div>
                <p>{p.description || 'No description'}</p>
                <div className="row between">
                  <UserChip user={p.manager} />
                  <span className="muted small">👥 {p.members.length + 1} {p.members.length === 0 ? 'person' : 'people'}</span>
                </div>
              </Link>
            ))}
          </div>
          <Pagination meta={data.meta} onChange={setPage} />
        </>
      )}
    </>
  );
}
