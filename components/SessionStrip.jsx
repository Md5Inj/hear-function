'use client';
/* Полоса серии (сколько сделано / текущий / осталось, верно и ошибок) и попап настроек за шестерёнкой. Вёрстка на Tailwind. */
import { useEffect, useRef, useState } from 'react';
import Synth from '@/lib/synth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from './AppProvider';
import LevelPath from './LevelPath';
import { cn } from '@/lib/utils';

export function useSession(n) {
  const [results, setResults] = useState([]);
  const ref = useRef([]); ref.current = results;
  return {
    n, results,
    push(ok) { const r = ref.current.concat([ok]); ref.current = r; setResults(r); if (r.length >= n) { const right = r.filter(Boolean).length; import('./ui').then(m => m.toast(`Series complete: ${right} of ${n} correct`)); } },
    nextIfDone() { if (ref.current.length >= n) { ref.current = []; setResults([]); } },
  };
}

const stepBg = { y: 'bg-ok', n: 'bg-bad', cur: 'bg-accent', '': 'bg-rule' };

/* idle: вопроса нет (уровень пуст или пройден) — остаются только настройки */
export function SessionStrip({ session, noun, active, right, note, idle }) {
  const { n, results } = session;
  const good = results.filter(Boolean).length, bad = results.length - good;
  return (
    <section className="py-[18px] pb-4 border-b border-rule grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-y-2.5 gap-x-[22px] items-center">
      {!idle && <div className="flex gap-1.5 w-full sm:w-auto">
        {Array.from({ length: n }, (_, i) => { const s = i < results.length ? (results[i] ? 'y' : 'n') : (i === results.length && active ? 'cur' : ''); return <i key={i} className={cn('block h-2 rounded flex-1 min-w-0 sm:flex-none sm:w-[26px]', stepBg[s])} />; })}
      </div>}
      <div className="text-ink-2 text-[15px] whitespace-nowrap">
        {active ? <>{noun} <b className="text-ink font-medium">{Math.min(results.length + 1, n)}</b> of {n} <span className="inline-block min-w-[22px] ml-2.5 px-[7px] py-px rounded-full font-semibold tabular-nums text-center text-ok bg-ok-bg" data-tip="Correct">{good}</span><span className="inline-block min-w-[22px] ml-1 px-[7px] py-px rounded-full font-semibold tabular-nums text-center text-bad bg-bad-bg" data-tip="Mistakes">{bad}</span>{note ? <span className="text-ink-3"> · {note}</span> : null}</> : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-2 justify-self-end relative order-first sm:order-none">{right}</div>
    </section>
  );
}

const gearCls = 'w-9 h-9 rounded-full border border-rule bg-paper text-ink-2 inline-flex items-center justify-center cursor-pointer hover:border-ink hover:text-ink';
const closeCls = 'absolute top-2 right-2 w-8 h-8 rounded-full bg-transparent text-ink-3 text-2xl leading-none inline-flex items-center justify-center cursor-pointer hover:bg-tint hover:text-ink';
const labelCls = 'text-[13px] text-ink-3';
const rowCls = 'flex gap-3 items-start text-left border rounded-[10px] px-2.5 py-2 cursor-pointer text-ink hover:border-ink-2 [&>span:last-child>b]:block [&>span:last-child>b]:font-medium [&>span:last-child>b]:text-[15px] [&>span:last-child>small]:block [&>span:last-child>small]:text-ink-2 [&>span:last-child>small]:text-[13px] [&>span:last-child>small]:mt-0.5';

/* Шестерёнка и попап: уровни (всегда), тембр и автопереход (ступени и прогрессии). */
export function SettingsPopover({ ctx, showTimbre, hidden, mistakes }) {
  const { store, settings } = useApp(); const path = usePathname();
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = ev => { if (popRef.current && !popRef.current.contains(ev.target)) setOpen(false); };
    const onKey = ev => { if (ev.key === 'Escape') setOpen(false); };
    const t = setTimeout(() => { document.addEventListener('click', onClick); document.addEventListener('keydown', onKey); }, 0);
    return () => { clearTimeout(t); document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);
  if (hidden) return null;
  const p = ctx.prog();
  const numCls = 'font-serif text-xl min-w-5 leading-tight';
  return (
    <>
      <button className={gearCls} aria-label="Settings" data-tip="Settings" onClick={ev => { ev.stopPropagation(); setOpen(o => !o); }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-[min(360px,calc(100vw-1.5rem))] bg-paper border border-rule rounded-xl shadow-[0_12px_32px_rgba(28,32,51,0.12)] p-4 pt-5 grid gap-4" ref={popRef}>
          <button className={closeCls} type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          <div className="grid gap-2"><span className={labelCls}>Level</span>
            <LevelPath levels={ctx.levels()} level={p.level} maxLevel={p.maxLevel} passed={p.correctByLevel} history={(p.byLevel || {})[Math.max(p.maxLevel || 1, p.level)] || p.history || []} W={settings.levelUpWindow || 20} NEED={settings.levelUpNeed || 16} onSelect={n => { ctx.setLevel(n); setOpen(false); }} />
          </div>
          {mistakes && (
            <div className="grid gap-2"><span className={labelCls}>Mode</span>
              <div className="grid gap-1.5">
                <Link className={cn(rowCls, !mistakes.on ? 'border-accent bg-accent-soft' : 'border-rule')} href={path + '?mode=' + ctx.mode} onClick={() => setOpen(false)}><span className={numCls}>•</span><span><b>Normal</b><small>questions by level</small></span></Link>
                <Link className={cn(rowCls, mistakes.on ? 'border-accent bg-accent-soft' : 'border-rule')} href={path + '?mode=' + ctx.mode + '&mistakes=1'} onClick={() => setOpen(false)}><span className={numCls}>!</span><span><b>Mistakes</b><small>{mistakes.count == null ? 'what was answered incorrectly' : mistakes.count ? `unfixed: ${mistakes.count}` : 'no mistakes'}</small></span></Link>
                {mistakes.tonus != null && <Link className={cn(rowCls, mistakes.tonus ? 'border-accent bg-accent-soft' : 'border-rule')} href={path + '?mode=' + ctx.mode + '&tonus=1'} onClick={() => setOpen(false)}><span className={numCls}>∞</span><span><b>Endurance</b><small>{(p.maxLevel || p.level) > 1 ? `shuffled from passed levels 1–${p.maxLevel || p.level}, does not affect levels` : 'unlocks once the first level is passed'}</small></span></Link>}
              </div>
            </div>
          )}
          {showTimbre && (
            <>
              <div className="grid gap-2"><span className={labelCls}>Timbre</span>
                <select className="font-sans text-sm px-3 py-2 border border-rule rounded-md bg-paper text-ink cursor-pointer" value={store.timbre} onChange={e => ctx.setTimbre(e.target.value)}>
                  <option value="auto">by level</option>
                  {Object.entries(Synth.PRESETS).map(([id, pr]) => <option key={id} value={id}>{pr.name}</option>)}
                </select>
              </div>
              <div className="grid gap-2"><label className="inline-flex items-center gap-2 text-ink-2 text-[15px] cursor-pointer"><input type="checkbox" className="accent-accent w-4 h-4" checked={store.autoNext} onChange={e => ctx.setAutoNext(e.target.checked)} /> Advance automatically</label></div>
            </>
          )}
        </div>
      )}
    </>
  );
}
