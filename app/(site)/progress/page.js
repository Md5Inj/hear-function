import { requireUser } from '@/lib/page-mode';
import { currentState } from '@/lib/session';
import { appSettings } from '@/lib/api';
import { getStore } from '@/lib/db';
import P from '@/lib/progressions';
import Songs from '@/lib/songs-db';
import IV from '@/lib/intervals';
import LevelPath from '@/components/LevelPath';
export const metadata = { title: 'Progress — Hear Function' };
const EX = [['degrees', 'Degrees', P.DEGREE_LEVELS], ['intervals', 'Intervals', { major: IV.LEVELS }], ['progressions', 'Progressions', P.PROG_LEVELS], ['songs', 'Song chords', Songs.SONG_LEVELS]];
const fmt = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
export default async function Progress() {
  const user = await requireUser('/progress');
  const state = await currentState(); const progress = (state && state.progress) || {}; const st = await appSettings();
  const answers = await getStore().find('answers', { userId: user.id });
  const lastAt = {}; for (const a of answers) { const k = a.exercise + '.' + a.mode; if (!lastAt[k] || a.at > lastAt[k]) lastAt[k] = a.at; }
  return (
    <section className="pt-7">
      <h1 className="font-serif font-medium text-[30px] mb-1.5">Your path</h1>
      <p className="text-ink-2 text-sm">Each level adds one degree or chord. The next opens once at least {st.levelUpNeed} of the last {st.levelUpWindow} answers are correct.</p>
      {EX.map(([ex, name, levels]) => (
        <div key={ex} className="mt-7">
          <h2 className="font-serif font-medium text-[22px] mb-1">{name}</h2>
          {(levels.minor ? ['major', 'minor'] : ['major']).map(mode => { const p = progress[ex + '.' + mode] || { level: 1, history: [], total: 0 }; const top = Math.max(p.maxLevel || 1, p.level); const pct = Math.round(((top - 1) / levels[mode].length) * 100); return (
            <div key={mode} className="pt-2 pb-3.5 border-t border-rule">
              <div className="flex justify-between gap-3 flex-wrap text-[15px]"><span>{levels.minor ? (mode === 'major' ? 'Major' : 'Minor') : 'All tasks'}</span><span className="muted">{pct}% done{p.total ? ` · answers ${p.total}, correct ${p.correct}` : ' · not started yet'}{lastAt[ex + '.' + mode] ? ` · last session ${fmt(lastAt[ex + '.' + mode])}` : ''}</span></div>
              <LevelPath levels={levels[mode]} level={top} maxLevel={top} history={(p.byLevel || {})[top] || p.history || []} W={st.levelUpWindow} NEED={st.levelUpNeed} />
            </div>
          ); })}
        </div>
      ))}
      <div className="mt-7"><h2 className="font-serif font-medium text-[22px] mb-1">Song melodies</h2><p className="text-ink-3 text-[15px]">No levels: practised by key, progress is visible in the history.</p></div>
    </section>
  );
}
