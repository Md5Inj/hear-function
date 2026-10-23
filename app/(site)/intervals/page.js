import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/page-mode';
import IntervalsExercise from '@/components/IntervalsExercise';
export async function generateMetadata() { const t = await getTranslations('Titles'); return { title: t('intervals') + ' — Hear Function' }; }
export default async function Page({ searchParams }) {
  await requireUser('/intervals');
  const sp = (await searchParams) || {};
  return <IntervalsExercise mistakes={sp.mistakes === '1'} tonus={sp.tonus === '1'} />;
}
