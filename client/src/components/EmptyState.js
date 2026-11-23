export default function EmptyState({ icon = '📭', title, children, action }) {
  return (
    <div className="empty">
      <div className="ico">{icon}</div>
      <h3>{title}</h3>
      {children && <p style={{ margin: '0 0 14px' }}>{children}</p>}
      {action}
    </div>
  );
}
