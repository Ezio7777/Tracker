'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ErrorBox from '@/components/ErrorBox';

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { await register(form.name, form.email, form.password); } catch (err) { setError(err); setBusy(false); }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h1>Create account</h1>
      <p className="muted">New accounts start as Members. An admin can change roles.</p>
      <label htmlFor="name">Name</label>
      <input id="name" required minLength={2} value={form.name} onChange={set('name')} />
      <label htmlFor="email">Email</label>
      <input id="email" type="email" required value={form.email} onChange={set('email')} />
      <label htmlFor="password">Password</label>
      <input id="password" type="password" required minLength={8} value={form.password} onChange={set('password')} />
      <div className="muted small">At least 8 characters with a letter and a digit.</div>
      <ErrorBox error={error} />
      <button className="btn block" style={{ marginTop: 18, height: 42 }} disabled={busy}>{busy ? 'Creating...' : 'Create account'}</button>
      <p className="small muted" style={{ textAlign: 'center' }}>Already registered? <Link href="/login">Sign in</Link></p>
    </form>
  );
}
