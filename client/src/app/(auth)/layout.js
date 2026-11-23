'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Spinner from '@/components/Spinner';

export default function AuthLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && user) router.replace('/dashboard'); }, [loading, user, router]);
  if (loading || user) return <Spinner full />;
  return (
    <div className="auth-shell">
      <div className="auth-box">
        <div className="auth-brand"><span className="logo">✓</span>Tracker</div>
        {children}
      </div>
    </div>
  );
}
