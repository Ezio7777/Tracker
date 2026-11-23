'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import NotificationBell from './NotificationBell';
import { Avatar } from './Badges';
import { isStaff } from '@/lib/constants';

export default function Navbar() {
  const { user, logout } = useAuth();
  const path = usePathname();
  const links = [
    { href: '/dashboard', text: 'Dashboard' },
    { href: '/projects', text: 'Projects' },
    { href: '/work-items', text: 'Work items' },
    { href: '/work-items/new', text: isStaff(user) ? 'New item' : 'Raise ticket' },
    ...(user.role === 'ADMIN' ? [{ href: '/admin/users', text: 'Users' }] : []),
  ];
  const active = (href) => (href === '/work-items' ? path === href || /^\/work-items\/[^n]/.test(path) : path.startsWith(href));

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/dashboard" className="brand"><span className="logo">✓</span>Tracker</Link>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`link ${active(l.href) ? 'active' : ''}`}>{l.text}</Link>
        ))}
        <span className="spacer" />
        <NotificationBell />
        <span className="chip" style={{ margin: '0 8px' }}>
          <Avatar name={user.name} size={30} />
          <span style={{ lineHeight: 1.2 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{user.name}</div><div className="muted small">{user.role}</div></span>
        </span>
        <button className="btn secondary sm" onClick={logout}>Log out</button>
      </div>
    </nav>
  );
}
