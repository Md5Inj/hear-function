/* Каркас админки: без шапки сайта, на всю ширину. */
export default function AdminLayout({ children }) {
  return <div className="admin-shell">{children}</div>;
}
