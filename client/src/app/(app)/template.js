// A template re-mounts on every navigation, which replays the page-in animation.
export default function Template({ children }) {
  return <div className="page">{children}</div>;
}
