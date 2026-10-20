import { requireUser, resolveMode } from '@/lib/page-mode';
import DegreesExercise from '@/components/DegreesExercise';
export const metadata = { title: 'Ступени — Тренажёр слуха' };
export default async function Page({ searchParams }) {
  const user = await requireUser('/degrees');
  const mode = await resolveMode(user, searchParams);
  return <DegreesExercise mode={mode} />;
}
