import { requireUser } from '@/lib/page-mode';
import AccountPage from '@/components/AccountPage';
import { getTranslations } from 'next-intl/server';
export async function generateMetadata() { const t = await getTranslations('Account'); return { title: t('metaTitle') }; }
export default async function Page() { await requireUser('/account'); return <AccountPage />; }
