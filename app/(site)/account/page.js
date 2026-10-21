import { requireUser } from '@/lib/page-mode';
import AccountPage from '@/components/AccountPage';
export const metadata = { title: 'Аккаунт — Тренажёр слуха' };
export default async function Page() { await requireUser('/account'); return <AccountPage />; }
