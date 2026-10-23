import { requireUser } from '@/lib/page-mode';
import AccountPage from '@/components/AccountPage';
export const metadata = { title: 'Account — Hear Function' };
export default async function Page() { await requireUser('/account'); return <AccountPage />; }
