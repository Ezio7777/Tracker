'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ErrorBox from '@/components/ErrorBox';

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { await login(form.email, form.password); } catch (err) { setError(err); setBusy(false); }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h1>Sign in</h1>
      <p className="muted">Welcome back.</p>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <label htmlFor="password">Password</label>
      <input id="password" type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <ErrorBox error={error} />
      <button className="btn block" style={{ marginTop: 18, height: 42 }} disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      <p className="small muted" style={{ textAlign: 'center' }}>No account? <Link href="/register">Create one</Link></p>
    </form>
  );
}
