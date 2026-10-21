/* Служебная страница базы: снаружи доступна только по адресу из app.config.js (см. proxy.js), вход по логину администратора. */
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { adminFromToken, adminPath } from '@/lib/api';
import AdminPage from '@/components/AdminPage';
import AdminLogin from '@/components/AdminLogin';
export const metadata = { title: 'Админка — Тренажёр слуха' };
export default async function Page() {
  if (!adminPath()) notFound();
  const c = await cookies();
  const admin = await adminFromToken(c.get('asid')?.value);
  return admin ? <AdminPage admin={admin} /> : <AdminLogin />;
}
