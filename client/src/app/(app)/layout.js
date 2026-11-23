'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import Toast from '@/components/Toast';
import Spinner from '@/components/Spinner';

export default function AppLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);
  if (loading || !user) return <Spinner full />;
  return (
    <>
      <Navbar />
      <main className="container">{children}</main>
      <Toast />
    </>
  );
}
