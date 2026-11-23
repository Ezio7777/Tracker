import { label } from '@/lib/format';

export const StatusBadge = ({ status }) => <span className={`badge pip s-${status}`}>{label(status)}</span>;
export const PriorityBadge = ({ priority }) => <span className={`badge p-${priority}`}>{priority}</span>;
export const TypeBadge = ({ type }) => <span className={`badge t-${type}`}>{type}</span>;

const hue = (s = '') => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
export function Avatar({ name = '?', size = 26 }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg,hsl(${hue(name)} 70% 62%),hsl(${(hue(name) + 40) % 360} 65% 50%))` }}>
      {initials}
    </span>
  );
}
export const UserChip = ({ user, fallback = 'Unassigned' }) =>
  user ? <span className="chip"><Avatar name={user.name} /><span className="n">{user.name}</span></span> : <span className="muted">{fallback}</span>;
