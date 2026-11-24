import { fmtDateTime, label } from '@/lib/format';

function describe(h) {
  switch (h.action) {
    case 'CREATED': return `created this item (${label(h.to)})`;
    case 'STATUS_CHANGED': return `changed status ${label(h.from)} → ${label(h.to)}`;
    case 'ESCALATED': return `escalated the ticket (${label(h.from)} → ${label(h.to)})`;
    case 'ASSIGNED': return h.to ? 'changed the assignee' : 'removed the assignee';
    case 'PRIORITY_CHANGED': return `changed priority ${h.from} → ${h.to}`;
    case 'UPDATED': return `updated ${h.meta?.field || 'details'}`;
    case 'COMMENTED': return 'added a comment';
    case 'DELETED': return 'deleted this item';
    default: return h.action;
  }
}

export default function HistoryTimeline({ history }) {
  if (!history.length) return <p className="muted">No activity yet.</p>;
  return (
    <ul className="timeline">
      {[...history].reverse().map((h) => (
        <li key={h.id}>
          <strong>{h.actor?.name || 'Someone'}</strong> {describe(h)}
          <div className="muted small">{fmtDateTime(h.createdAt)}</div>
        </li>
      ))}
    </ul>
  );
}
