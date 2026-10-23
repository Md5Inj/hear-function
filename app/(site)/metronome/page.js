import { getTranslations } from 'next-intl/server';
import MetronomeExercise from '@/components/MetronomeExercise';
export async function generateMetadata() { const t = await getTranslations('Titles'); return { title: t('metronome') + ' — Hear Function' }; }
export default function Page() {
  return <MetronomeExercise />;
}
