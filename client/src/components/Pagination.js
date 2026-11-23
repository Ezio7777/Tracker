export default function Pagination({ meta, onChange }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <div className="pager">
      <span className="muted small">{meta.total} results</span>
      <button className="btn secondary sm" disabled={meta.page <= 1} onClick={() => onChange(meta.page - 1)}>Previous</button>
      <span>Page {meta.page} of {meta.pages}</span>
      <button className="btn secondary sm" disabled={meta.page >= meta.pages} onClick={() => onChange(meta.page + 1)}>Next</button>
    </div>
  );
}
