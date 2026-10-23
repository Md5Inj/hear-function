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
import { useLocale, useTranslations } from 'next-intl';
import { tr } from '@/lib/i18n-data';

const TABS = ['degrees', 'intervals', 'progressions', 'songs', 'melodies'];
const fmt = (iso, locale) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
const fmtAns = a => Array.isArray(a) ? a.map(x => x == null || x === '' ? '?' : x).join(' – ') : (a == null ? '' : String(a));
function levelOf(ex, mode, level) {
  const L = ex === 'degrees' ? P.DEGREE_LEVELS : ex === 'progressions' ? P.PROG_LEVELS : ex === 'intervals' ? { major: IV.LEVELS, minor: IV.LEVELS } : Songs.SONG_LEVELS;
  return L[mode] && L[mode][level - 1];
}

export default function HistoryPage({ initialSeen }) {
  const { api, store } = useApp(); const th = useTranslations('History'); const locale = useLocale();
  const modeName = m => th(m === 'major' ? 'major' : 'minor');
  const levelTitle = (ex, mode, level) => { const l = levelOf(ex, mode, level); return l ? th('levelN', { n: level, title: tr(l.title, locale) }) : th('noLevel'); };
  const ivShow = x => { const iv = IV.byLabel(x); return iv ? (locale === 'ru' ? iv.label : iv.disp) : x; };
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
  const entries = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], locale, { numeric: true }));
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif font-medium text-[30px] m-0">{th('title')}</h1>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button variant="quiet" size="mini" onClick={async ev => { if (!await confirmPop(ev.currentTarget, th('confirmList'))) return; await api('DELETE', isSong ? '/seen?exercise=' + ex : '/answers?exercise=' + ex); if (isSong) { await reloadSeen(); store.seen = new Set([...store.seen].filter(k => !list.some(i => i.exercise + ':' + i.songId === k))); } else setAnswers(a => ({ ...a, [ex]: [] })); }}>{th('clearList')}</Button>
          <Button variant="quiet" size="mini" onClick={async ev => { if (!await confirmPop(ev.currentTarget, th('confirmAll'))) return; await api('DELETE', '/seen'); await api('DELETE', '/answers'); setAnswers({}); store.seen = new Set(); await reloadSeen(); }}>{th('clearAll')}</Button>
        </div>
      </div>
      <div className="flex gap-[26px] border-b border-rule mt-[22px] flex-wrap" role="tablist">{TABS.map(k => <button key={k} role="tab" className={cn('bg-transparent border-0 border-b-2 border-transparent pt-2.5 pb-3 px-0.5 -mb-px text-base text-ink-2 cursor-pointer hover:text-ink', ex === k && 'text-ink border-ink font-medium')} onClick={() => setEx(k)}>{th('tab_' + k)}</button>)}</div>
      <p className="text-ink-2 text-sm my-3.5 mb-1.5">{th('note_' + ex)}</p>
      <div className="grid gap-1 mt-2.5">
        {!list.length && <div className="text-center py-14"><div className="font-serif text-2xl">{isSong ? th('nothingPassed') : th('noAnswers')}</div></div>}
        {entries.map(([title, rows]) => (
          <div key={title}>
            <div className="flex justify-between items-baseline font-serif text-xl mt-[26px] mb-1.5"><span>{title}</span><span className="font-sans text-sm text-ink-2">{th('correctOf', { c: rows.filter(r => r.correct).length, n: rows.length })}</span></div>
            {rows.map(i => isSong ? (
              <div key={i.id} className="grid grid-cols-[28px_1fr_1fr_auto_auto_28px] items-center gap-3 px-2.5 py-2 border-b border-rule">
                <span className={cn('font-semibold', i.correct ? 'text-ok' : 'text-bad')}>{i.correct ? '✓' : '✕'}</span>
                <span className="font-serif text-lg">{i.title || i.songId}</span>
                <span className="text-ink-2 text-sm">{i.artist || ''}</span>
                <span className="text-ink-2 text-sm">{fmt(i.at, locale)}</span>
                <Button asChild variant="quiet" size="mini"><Link href={(ex === 'melodies' ? '/melodies' : '/songs') + '?song=' + encodeURIComponent(i.songId)}>{th('passAgain')}</Link></Button>
                <button className="text-lg text-ink-3 hover:text-bad bg-transparent border-0 cursor-pointer" data-tip={th('remove')} onClick={async () => { await api('DELETE', '/seen/' + encodeURIComponent(i.id)); store.seen.delete(i.exercise + ':' + i.songId); setSeen(s => s.filter(x => x.id !== i.id)); }}>×</button>
              </div>
            ) : (
              <div key={i.id} className="grid grid-cols-[28px_1fr_1fr_auto_28px] items-center gap-3 px-2.5 py-2 border-b border-rule">
                <span className={'hist-res ' + (i.correct ? 'y' : 'n')}>{i.correct ? '✓' : '✕'}</span>
                <span className="hist-title">{ex === 'intervals' ? ivShow(i.truth) : fmtAns(i.truth)}</span>
                <span className="hist-artist">{i.correct ? '' : th('yourAnswer', { a: ex === 'intervals' ? ivShow(i.answer) : fmtAns(i.answer) })}</span>
                <span className="hist-date">{fmt(i.at, locale)}</span>
                <button className="link hist-del" data-tip={th('remove')} onClick={async () => { await api('DELETE', '/answers/' + encodeURIComponent(i.id)); setAnswers(a => ({ ...a, [ex]: a[ex].filter(x => x.id !== i.id) })); }}>×</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
