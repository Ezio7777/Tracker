'use client';
import { useEffect, useState } from 'react';
import { ALL_STATUSES, PRIORITIES } from '@/lib/constants';
import { label } from '@/lib/format';

export default function WorkItemFilters({ filters, onChange, onReset, projects }) {
  const [text, setText] = useState(filters.q);
  useEffect(() => setText(filters.q), [filters.q]);
  useEffect(() => { // debounce the search box
    const t = setTimeout(() => { if (text !== filters.q) onChange({ q: text }); }, 350);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = ['q', 'type', 'status', 'priority', 'project', 'assignee', 'requester'].some((k) => filters[k]);
  const sel = (key, options, placeholder) => (
    <select value={filters[key]} onChange={(e) => onChange({ [key]: e.target.value })} aria-label={placeholder}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.text ?? label(o)}</option>)}
    </select>
  );

  return (
    <div className="card filters">
      <div className="search">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input placeholder="Search by title or description" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search" />
      </div>
      <div className="filter-row">
        {sel('type', ['TASK', 'TICKET'], 'All types')}
        {sel('status', ALL_STATUSES, 'All statuses')}
        {sel('priority', PRIORITIES, 'All priorities')}
        {sel('project', projects.map((p) => ({ value: p._id, text: p.name })), 'All projects')}
        {sel('assignee', [{ value: 'me', text: 'Assigned to me' }], 'Any assignee')}
        {sel('requester', [{ value: 'me', text: 'Raised by me' }], 'Any requester')}
        <div className="seg">
          <select value={filters.sortBy} onChange={(e) => onChange({ sortBy: e.target.value })} aria-label="Sort by">
            {[['createdAt', 'Newest created'], ['updatedAt', 'Last updated'], ['dueDate', 'Due date'], ['priority', 'Priority'], ['status', 'Status'], ['title', 'Title']].map(([v, t]) => <option key={v} value={v}>Sort: {t}</option>)}
          </select>
          <button type="button" className="btn secondary icon" title={filters.order === 'asc' ? 'Ascending' : 'Descending'} aria-label="Toggle sort order"
            onClick={() => onChange({ order: filters.order === 'asc' ? 'desc' : 'asc' })}>{filters.order === 'asc' ? '↑' : '↓'}</button>
          {active && <button type="button" className="btn ghost" onClick={onReset}>Clear</button>}
        </div>
      </div>
    </div>
  );
}
