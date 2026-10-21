import { requireUser, resolveMode } from '@/lib/page-mode';
import DegreesExercise from '@/components/DegreesExercise';
export const metadata = { title: 'Ступени — Тренажёр слуха' };
export default async function Page({ searchParams }) {
  const user = await requireUser('/degrees');
  const mode = await resolveMode(user, searchParams);
  const sp = (await searchParams) || {};
  return <DegreesExercise mode={mode} mistakes={sp.mistakes === '1'} tonus={sp.tonus === '1'} />;
}
