import { requireUser, resolveMode } from '@/lib/page-mode';
import SongsExercise from '@/components/SongsExercise';
export const metadata = { title: 'Song chords — Hear Function' };
export default async function Page({ searchParams }) {
  const user = await requireUser('/songs');
  const sp = (await searchParams) || {};
  const mode = await resolveMode(user, searchParams);
  return <SongsExercise task="chords" mode={mode} forcedSong={typeof sp.song === 'string' ? sp.song : null} mistakes={sp.mistakes === '1'} tonus={sp.tonus === '1'} />;
}
