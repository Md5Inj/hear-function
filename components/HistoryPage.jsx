'use client';
/* История: вкладки по упражнениям; песни по ладу и уровню, ответы ступеней и прогрессий по ладу и уровню. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Songs from '@/lib/songs-db';
import P from '@/lib/progressions';
import IV from '@/lib/intervals';
import { useApp } from './AppProvider';
import { confirmPop } from './ui';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

const TABS = [['degrees', 'Degrees'], ['intervals', 'Intervals'], ['progressions', 'Progressions'], ['songs', 'Song chords'], ['melodies', 'Song melodies']];
const NOTES = { songs: 'Songs you have already passed. They are not shown again until removed from the history: one by one with the cross, or all at once with the buttons above.', melodies: 'Songs you have already passed. They are not shown again until removed from the history: one by one with the cross, or all at once with the buttons above.', degrees: 'Your answers in the Degrees exercise: by key and level, newest on top.', progressions: 'Your answers in the Progressions exercise: by key and level, newest on top.', intervals: 'Your answers in the Intervals exercise: by level, newest on top.' };
const fmt = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
const fmtAns = a => Array.isArray(a) ? a.map(x => x == null || x === '' ? '?' : x).join(' – ') : (a == null ? '' : String(a));
const modeName = m => m === 'major' ? 'Major' : 'Minor';
function levelTitle(ex, mode, level) {
  const L = ex === 'degrees' ? P.DEGREE_LEVELS : ex === 'progressions' ? P.PROG_LEVELS : ex === 'intervals' ? { major: IV.LEVELS, minor: IV.LEVELS } : Songs.SONG_LEVELS;
  const l = L[mode] && L[mode][level - 1]; return l ? `Level ${level}: ${l.title}` : 'No level';
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
    const key = ex === 'melodies' ? modeName(i.mode) : ex === 'intervals' ? levelTitle(ex, i.mode, i.level) : `${modeName(i.mode)} · ${levelTitle(ex, i.mode, i.level)}`;
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(i);
  });
  const entries = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru', { numeric: true }));
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif font-medium text-[30px] m-0">History</h1>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button variant="quiet" size="mini" onClick={async ev => { if (!await confirmPop(ev.currentTarget, 'Clear the history of this section?')) return; await api('DELETE', isSong ? '/seen?exercise=' + ex : '/answers?exercise=' + ex); if (isSong) { await reloadSeen(); store.seen = new Set([...store.seen].filter(k => !list.some(i => i.exercise + ':' + i.songId === k))); } else setAnswers(a => ({ ...a, [ex]: [] })); }}>Clear this list</Button>
          <Button variant="quiet" size="mini" onClick={async ev => { if (!await confirmPop(ev.currentTarget, 'Clear all history?')) return; await api('DELETE', '/seen'); await api('DELETE', '/answers'); setAnswers({}); store.seen = new Set(); await reloadSeen(); }}>Clear all</Button>
        </div>
      </div>
      <div className="flex gap-[26px] border-b border-rule mt-[22px] flex-wrap" role="tablist">{TABS.map(([k, label]) => <button key={k} role="tab" className={cn('bg-transparent border-0 border-b-2 border-transparent pt-2.5 pb-3 px-0.5 -mb-px text-base text-ink-2 cursor-pointer hover:text-ink', ex === k && 'text-ink border-ink font-medium')} onClick={() => setEx(k)}>{label}</button>)}</div>
      <p className="text-ink-2 text-sm my-3.5 mb-1.5">{NOTES[ex]}</p>
      <div className="grid gap-1 mt-2.5">
        {!list.length && <div className="text-center py-14"><div className="font-serif text-2xl">{isSong ? 'Nothing passed yet.' : 'No answers yet.'}</div></div>}
        {entries.map(([title, rows]) => (
          <div key={title}>
            <div className="flex justify-between items-baseline font-serif text-xl mt-[26px] mb-1.5"><span>{title}</span><span className="font-sans text-sm text-ink-2">correct {rows.filter(r => r.correct).length} of {rows.length}</span></div>
            {rows.map(i => isSong ? (
              <div key={i.id} className="grid grid-cols-[28px_1fr_1fr_auto_auto_28px] items-center gap-3 px-2.5 py-2 border-b border-rule">
                <span className={cn('font-semibold', i.correct ? 'text-ok' : 'text-bad')}>{i.correct ? '✓' : '✕'}</span>
                <span className="font-serif text-lg">{i.title || i.songId}</span>
                <span className="text-ink-2 text-sm">{i.artist || ''}</span>
                <span className="text-ink-2 text-sm">{fmt(i.at)}</span>
                <Button asChild variant="quiet" size="mini"><Link href={(ex === 'melodies' ? '/melodies' : '/songs') + '?song=' + encodeURIComponent(i.songId)}>Pass again</Link></Button>
                <button className="text-lg text-ink-3 hover:text-bad bg-transparent border-0 cursor-pointer" data-tip="Remove from history" onClick={async () => { await api('DELETE', '/seen/' + encodeURIComponent(i.id)); store.seen.delete(i.exercise + ':' + i.songId); setSeen(s => s.filter(x => x.id !== i.id)); }}>×</button>
              </div>
            ) : (
              <div key={i.id} className="grid grid-cols-[28px_1fr_1fr_auto_28px] items-center gap-3 px-2.5 py-2 border-b border-rule">
                <span className={'hist-res ' + (i.correct ? 'y' : 'n')}>{i.correct ? '✓' : '✕'}</span>
                <span className="hist-title">{ex === 'intervals' ? (IV.byLabel(i.truth) || {}).disp || i.truth : fmtAns(i.truth)}</span>
                <span className="hist-artist">{i.correct ? '' : 'your answer: ' + (ex === 'intervals' ? (IV.byLabel(i.answer) || {}).disp || i.answer : fmtAns(i.answer))}</span>
                <span className="hist-date">{fmt(i.at)}</span>
                <button className="link hist-del" data-tip="Remove from history" onClick={async () => { await api('DELETE', '/answers/' + encodeURIComponent(i.id)); setAnswers(a => ({ ...a, [ex]: a[ex].filter(x => x.id !== i.id) })); }}>×</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
