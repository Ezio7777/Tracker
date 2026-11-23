export default function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  const details = Array.isArray(error.details) ? error.details : [];
  return (
    <div className="error" role="alert">
      <strong>{error.message || 'Something went wrong'}</strong>
      {details.length > 0 && (
        <ul>{details.map((d, i) => <li key={i}>{d.path ? `${d.path}: ` : ''}{d.message}</li>)}</ul>
      )}
      {onRetry && <div style={{ marginTop: 8 }}><button className="btn secondary sm" onClick={onRetry}>Retry</button></div>}
    </div>
  );
}
