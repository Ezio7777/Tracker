'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { qs } from '@/lib/format';
import { useNotifications } from '@/context/SocketContext';
import Spinner from '@/components/Spinner';
import ErrorBox from '@/components/ErrorBox';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';
import WorkItemTable from '@/components/WorkItemTable';
import WorkItemFilters from '@/components/WorkItemFilters';

const INITIAL = { q: '', type: '', status: '', priority: '', project: '', assignee: '', requester: '', sortBy: 'createdAt', order: 'desc' };

export default function WorkItemsPage({ searchParams }) {
  const [filters, setFilters] = useState({ ...INITIAL, project: searchParams?.project || '' });
  const [page, setPage] = useState(1);
  const { last } = useNotifications();

  const { data: projects } = useAsync(() => api('/projects?limit=50').then((j) => j.data), []);
  const { data, loading, error, reload } = useAsync(
    () => api(`/work-items?${qs({ ...filters, page, limit: 10 })}`),
    [filters, page, last?.id]
  );

  const change = (patch) => { setFilters((f) => ({ ...f, ...patch })); setPage(1); };
  const reset = () => { setFilters(INITIAL); setPage(1); };

  return (
    <>
      <PageHeader title="Work items" subtitle="Everything you are allowed to see, filtered by the server.">
        <Link className="btn" href="/work-items/new">+ New</Link>
      </PageHeader>
      <WorkItemFilters filters={filters} onChange={change} onReset={reset} projects={projects || []} />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Spinner /> : (
        <div className="card" style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .2s' }}>
          <WorkItemTable items={data?.data || []} />
          <Pagination meta={data?.meta} onChange={setPage} />
        </div>
      )}
    </>
  );
}
