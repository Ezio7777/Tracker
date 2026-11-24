import Link from 'next/link';
import { StatusBadge, PriorityBadge, TypeBadge, UserChip } from './Badges';
import EmptyState from './EmptyState';
import { fmtDate } from '@/lib/format';
import { CLOSED_LIKE } from '@/lib/constants';

export default function WorkItemTable({ items, compact }) {
  if (!items.length) return <EmptyState icon="🗂️" title="No work items found">Try adjusting your filters or create a new item.</EmptyState>;
  const now = Date.now();
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th><th>Title</th><th>Status</th><th>Priority</th>
            {!compact && <th>Project</th>}<th>Assignee</th><th>Due</th>{!compact && <th>Updated</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const overdue = i.dueDate && new Date(i.dueDate) < now && !CLOSED_LIKE.includes(i.status);
            return (
              <tr key={i.id}>
                <td><TypeBadge type={i.type} /></td>
                <td><Link href={`/work-items/${i.id}`}>{i.title}</Link></td>
                <td><StatusBadge status={i.status} /></td>
                <td><PriorityBadge priority={i.priority} /></td>
                {!compact && <td>{i.project ? i.project.name : <span className="muted">-</span>}</td>}
                <td><UserChip user={i.assignee} /></td>
                <td className={overdue ? 'overdue' : 'muted'}>{fmtDate(i.dueDate)}{overdue ? ' · overdue' : ''}</td>
                {!compact && <td className="muted">{fmtDate(i.updatedAt)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
