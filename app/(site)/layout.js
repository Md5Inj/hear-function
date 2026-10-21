/* Каркас сайта: шапка с меню и контейнер. Админка живёт в app/admin со своим каркасом. */
import Header from '@/components/Header';
export default function SiteLayout({ children }) {
  return <div className="wrap wide"><Header />{children}</div>;
}
