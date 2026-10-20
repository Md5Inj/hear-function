import { requireUser, resolveMode } from '@/lib/page-mode';
import ProgressionsExercise from '@/components/ProgressionsExercise';
export const metadata = { title: 'Прогрессии — Тренажёр слуха' };
export default async function Page({ searchParams }) {
  const user = await requireUser('/progressions');
  const mode = await resolveMode(user, searchParams);
  return <ProgressionsExercise mode={mode} />;
}
