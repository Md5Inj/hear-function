import { requireUser } from '@/lib/page-mode';
import IntervalsExercise from '@/components/IntervalsExercise';
export const metadata = { title: 'Intervals — Hear Function' };
export default async function Page({ searchParams }) {
  await requireUser('/intervals');
  const sp = (await searchParams) || {};
  return <IntervalsExercise mistakes={sp.mistakes === '1'} tonus={sp.tonus === '1'} />;
}
