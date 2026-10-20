import { requireUser } from '@/lib/page-mode';
import { getStore } from '@/lib/db';
import HistoryPage from '@/components/HistoryPage';
export const metadata = { title: 'История — Тренажёр слуха' };
export default async function Page() {
  const user = await requireUser('/history');
  const seen = await getStore().find('seen', { userId: user.id });
  seen.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  return <HistoryPage initialSeen={seen} />;
}
