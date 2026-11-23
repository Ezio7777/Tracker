'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { fmtDateTime } from '@/lib/format';
import Spinner from './Spinner';
import ErrorBox from './ErrorBox';

export default function CommentSection({ workItemId, refreshKey }) {
  const { data, loading, error, reload } = useAsync(
    () => api(`/work-items/${workItemId}/comments?limit=100`).then((j) => j.data),
    [workItemId, refreshKey]
  );
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [postError, setPostError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setPostError(null);
    try {
      await api(`/work-items/${workItemId}/comments`, { method: 'POST', body: { body } });
      setBody('');
      reload();
    } catch (err) { setPostError(err); }
    setBusy(false);
  };

  return (
    <div className="card">
      <h2>Comments {data ? `(${data.length})` : ''}</h2>
      {loading && !data && <Spinner />}
      <ErrorBox error={error} onRetry={reload} />
      {data && data.length === 0 && <p className="muted">No comments yet. Start the conversation.</p>}
      {data && data.map((c) => (
        <div className="comment" key={c._id}>
          <strong>{c.author?.name}</strong> <span className="badge">{c.author?.role}</span>
          <span className="muted small"> · {fmtDateTime(c.createdAt)}</span>
          <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{c.body}</div>
        </div>
      ))}
      <form onSubmit={submit}>
        <label htmlFor="comment">Add a comment</label>
        <textarea id="comment" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
        <ErrorBox error={postError} />
        <button className="btn" style={{ marginTop: 8 }} disabled={busy || !body.trim()}>{busy ? 'Posting...' : 'Post comment'}</button>
      </form>
    </div>
  );
}
