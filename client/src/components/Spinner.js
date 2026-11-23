export default function Spinner({ full }) {
  if (full) return <div className="center"><div className="spinner" role="status" aria-label="Loading" /></div>;
  return (
    <div className="stack" role="status" aria-label="Loading" style={{ padding: '8px 0' }}>
      <div className="skeleton" style={{ height: 22, width: '40%' }} />
      <div className="skeleton" style={{ height: 70 }} />
      <div className="skeleton" style={{ height: 70 }} />
    </div>
  );
}
