'use client';
/* История: вкладки по упражнениям; песни по ладу и уровню, ответы ступеней и прогрессий по ладу и уровню. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Songs from '@/lib/songs-db';
import P from '@/lib/progressions';
import { useApp } from './AppProvider';
import { confirmPop } from './ui';

const TABS = [['degrees', 'Ступени'], ['progressions', 'Прогрессии'], ['songs', 'Аккорды песен'], ['melodies', 'Мелодии песен']];
const NOTES = { songs: 'Песни, которые вы уже проходили. Они не показываются повторно, пока не убраны из истории: по одной крестиком или целиком кнопками выше.', melodies: 'Песни, которые вы уже проходили. Они не показываются повторно, пока не убраны из истории: по одной крестиком или целиком кнопками выше.', degrees: 'Ваши ответы в упражнении «Ступени»: по ладу и уровню, последние сверху.', progressions: 'Ваши ответы в упражнении «Прогрессии»: по ладу и уровню, последние сверху.' };
const fmt = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
const fmtAns = a => Array.isArray(a) ? a.map(x => x == null || x === '' ? '?' : x).join(' – ') : (a == null ? '' : String(a));
const modeName = m => m === 'major' ? 'Мажор' : 'Минор';
function levelTitle(ex, mode, level) {
  const L = ex === 'degrees' ? P.DEGREE_LEVELS : ex === 'progressions' ? P.PROG_LEVELS : Songs.SONG_LEVELS;
  const l = L[mode] && L[mode][level - 1]; return l ? `Уровень ${level}: ${l.title}` : 'Без уровня';
}

export default function HistoryPage({ initialSeen }) {
  const { api, store } = useApp();
  const [ex, setEx] = useState('songs');
  const [seen, setSeen] = useState(initialSeen || []);
  const [answers, setAnswers] = useState({});
  const isSong = ex === 'songs' || ex === 'melodies';
  useEffect(() => { if (!isSong && !answers[ex]) api('GET', '/answers?exercise=' + ex).then(d => setAnswers(a => ({ ...a, [ex]: d.answers }))).catch(() => {}); }, [ex, isSong, answers, api]);
  async function reloadSeen() { setSeen((await api('GET', '/seen')).seen); }
  const list = isSong ? seen.filter(i => i.exercise === ex) : (answers[ex] || []);
  const groups = new Map();
  list.forEach(i => {
    const key = ex === 'melodies' ? modeName(i.mode) : `${modeName(i.mode)} · ${levelTitle(ex, i.mode, i.level)}`;
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(i);
  });
  const entries = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru', { numeric: true }));
  return (
    <section className="hist">
      <div className="hist-head">
        <h1>История</h1>
        <div className="hist-tools">
          <button className="btn quiet mini" onClick={async ev => { if (!await confirmPop(ev.currentTarget, 'Очистить историю этого раздела?')) return; await api('DELETE', isSong ? '/seen?exercise=' + ex : '/answers?exercise=' + ex); if (isSong) { await reloadSeen(); store.seen = new Set([...store.seen].filter(id => !list.some(i => i.songId === id))); } else setAnswers(a => ({ ...a, [ex]: [] })); }}>Очистить этот список</button>
          <button className="btn quiet mini" onClick={async ev => { if (!await confirmPop(ev.currentTarget, 'Очистить всю историю?')) return; await api('DELETE', '/seen'); await api('DELETE', '/answers'); setAnswers({}); store.seen = new Set(); await reloadSeen(); }}>Очистить всё</button>
        </div>
      </div>
      <div className="tabs" role="tablist">{TABS.map(([k, label]) => <button key={k} role="tab" className={'tab' + (ex === k ? ' active' : '')} onClick={() => setEx(k)}>{label}</button>)}</div>
      <p className="hist-note">{NOTES[ex]}</p>
      <div className="hist-list">
        {!list.length && <div className="empty-state"><div className="lead">{isSong ? 'Пока ничего не пройдено.' : 'Пока нет ответов.'}</div></div>}
        {entries.map(([title, rows]) => (
          <div key={title}>
            <div className="hist-group"><span>{title}</span><span className="hist-group-stat">верно {rows.filter(r => r.correct).length} из {rows.length}</span></div>
            {rows.map(i => isSong ? (
              <div key={i.id} className="hist-row">
                <span className={'hist-res ' + (i.correct ? 'y' : 'n')}>{i.correct ? '✓' : '✕'}</span>
                <span className="hist-title">{i.title || i.songId}</span>
                <span className="hist-artist">{i.artist || ''}</span>
                <span className="hist-date">{fmt(i.at)}</span>
                <Link className="btn quiet mini" href={(ex === 'melodies' ? '/melodies' : '/songs') + '?song=' + encodeURIComponent(i.songId)}>Пройти ещё раз</Link>
                <button className="link hist-del" data-tip="Убрать из истории" onClick={async () => { await api('DELETE', '/seen/' + encodeURIComponent(i.id)); store.seen.delete(i.songId); setSeen(s => s.filter(x => x.id !== i.id)); }}>×</button>
              </div>
            ) : (
              <div key={i.id} className="hist-row answers">
                <span className={'hist-res ' + (i.correct ? 'y' : 'n')}>{i.correct ? '✓' : '✕'}</span>
                <span className="hist-title">{fmtAns(i.truth)}</span>
                <span className="hist-artist">{i.correct ? '' : 'ваш вариант: ' + fmtAns(i.answer)}</span>
                <span className="hist-date">{fmt(i.at)}</span>
                <button className="link hist-del" data-tip="Убрать из истории" onClick={async () => { await api('DELETE', '/answers/' + encodeURIComponent(i.id)); setAnswers(a => ({ ...a, [ex]: a[ex].filter(x => x.id !== i.id) })); }}>×</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
