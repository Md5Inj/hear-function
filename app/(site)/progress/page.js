import { requireUser } from '@/lib/page-mode';
import { currentState } from '@/lib/session';
import { appSettings } from '@/lib/api';
import { getStore } from '@/lib/db';
import P from '@/lib/progressions';
import Songs from '@/lib/songs-db';
import IV from '@/lib/intervals';
import LevelPath from '@/components/LevelPath';
export const metadata = { title: 'Прогресс — Тренажёр слуха' };
const EX = [['degrees', 'Ступени', P.DEGREE_LEVELS], ['intervals', 'Интервалы', { major: IV.LEVELS }], ['progressions', 'Прогрессии', P.PROG_LEVELS], ['songs', 'Аккорды песен', Songs.SONG_LEVELS]];
const fmt = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); };
export default async function Progress() {
  const user = await requireUser('/progress');
  const state = await currentState(); const progress = (state && state.progress) || {}; const st = await appSettings();
  const answers = await getStore().find('answers', { userId: user.id });
  const lastAt = {}; for (const a of answers) { const k = a.exercise + '.' + a.mode; if (!lastAt[k] || a.at > lastAt[k]) lastAt[k] = a.at; }
  return (
    <section className="progress-page">
      <h1>Ваш путь</h1>
      <p className="hist-note">Каждый уровень добавляет одну ступень или аккорд. Следующий открывается, когда из последних {st.levelUpWindow} ответов верных не меньше {st.levelUpNeed}.</p>
      {EX.map(([ex, name, levels]) => (
        <div key={ex} className="progress-ex">
          <h2>{name}</h2>
          {(levels.minor ? ['major', 'minor'] : ['major']).map(mode => { const p = progress[ex + '.' + mode] || { level: 1, history: [], total: 0 }; const top = Math.max(p.maxLevel || 1, p.level); const pct = Math.round(((top - 1) / levels[mode].length) * 100); return (
            <div key={mode} className="progress-mode">
              <div className="progress-head"><span>{levels.minor ? (mode === 'major' ? 'Мажор' : 'Минор') : 'Все задачи'}</span><span className="muted">{pct}% пути{p.total ? ` · ответов ${p.total}, верных ${p.correct}` : ' · ещё не начинали'}{lastAt[ex + '.' + mode] ? ` · последнее занятие ${fmt(lastAt[ex + '.' + mode])}` : ''}</span></div>
              <LevelPath levels={levels[mode]} level={top} maxLevel={top} history={(p.byLevel || {})[top] || p.history || []} W={st.levelUpWindow} NEED={st.levelUpNeed} />
            </div>
          ); })}
        </div>
      ))}
      <div className="progress-ex"><h2>Мелодии песен</h2><p className="muted">Без уровней: тренируются по ладу, прогресс виден в истории.</p></div>
    </section>
  );
}
