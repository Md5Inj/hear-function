import { getTranslations } from 'next-intl/server';
import { requireUser, resolveMode } from '@/lib/page-mode';
import ProgressionsExercise from '@/components/ProgressionsExercise';
export async function generateMetadata() { const t = await getTranslations('Titles'); return { title: t('progressions') + ' — Hear Function' }; }
export default async function Page({ searchParams }) {
  const user = await requireUser('/progressions');
  const mode = await resolveMode(user, searchParams);
  const sp = (await searchParams) || {};
  return <ProgressionsExercise mode={mode} mistakes={sp.mistakes === '1'} tonus={sp.tonus === '1'} />;
}
