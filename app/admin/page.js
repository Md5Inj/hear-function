/* Служебная страница базы: снаружи доступна только по адресу из app.config.js (см. proxy.js), вход по логину администратора. */
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { adminFromToken, adminPath } from '@/lib/api';
import AdminPage from '@/components/AdminPage';
import AdminLogin from '@/components/AdminLogin';
export const metadata = { title: 'Admin — Hear Function' };
export default async function Page({ searchParams }) {
  if (!adminPath()) notFound();
  const c = await cookies();
  const admin = await adminFromToken(c.get('asid')?.value);
  const sp = (await searchParams) || {};
  const initial = { s: sp.s, kind: sp.kind, mode: sp.mode, level: sp.level, song: sp.song }; // параметры адреса — чтобы первый рендер на сервере совпал с клиентом
  return admin ? <AdminPage admin={admin} initial={initial} /> : <AdminLogin />;
}
