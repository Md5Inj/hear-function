import { requireUser, resolveMode } from '@/lib/page-mode';
import ProgressionsExercise from '@/components/ProgressionsExercise';
export const metadata = { title: 'Progressions — hear function' };
export default async function Page({ searchParams }) {
  const user = await requireUser('/progressions');
  const mode = await resolveMode(user, searchParams);
  const sp = (await searchParams) || {};
  return <ProgressionsExercise mode={mode} mistakes={sp.mistakes === '1'} tonus={sp.tonus === '1'} />;
}
