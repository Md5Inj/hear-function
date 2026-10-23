'use client';
/* Список уровней: пройденные — зелёный кружок с кубком, текущий — кольцо с процентом до следующего уровня,
   закрытые — серый кружок с нотой. На страницах упражнений список сворачивается до текущей строки. Вёрстка на Tailwind. */
import { useState } from 'react';
import { cn } from '@/lib/utils';

const Trophy = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M7 6H4a3 3 0 0 0 3 3" /><path d="M17 6h3a3 3 0 0 1-3 3" /></svg>;
const Note = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3v11.6a3.5 3.5 0 1 0 2 3.2V7l4-1V3l-6 1.5z" /></svg>;
const ICON = 'inline-flex items-center justify-center rounded-full w-[42px] h-[42px]';
function Ring({ pct, size = 'w-[42px] h-[42px]', num = 'text-[13px]', label }) {
  const r = 17, c = 2 * Math.PI * r;
  return (
    <span className={cn('relative inline-flex items-center justify-center', size)}>
      <svg viewBox="0 0 42 42" className="absolute inset-0 w-full h-full"><circle cx="21" cy="21" r={r} fill="var(--paper)" stroke="var(--rule)" strokeWidth="3.5" /><circle cx="21" cy="21" r={r} fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round" transform="rotate(-90 21 21)" /></svg>
      <b className={cn('relative z-[1] font-semibold text-ink', num)}>{label != null ? label : pct}</b>
    </span>
  );
}

/* Пройден ли уровень: только по своим результатам — PASS верных ответов на этом уровне (passed: { [уровень]: верных }).
   Достигнутый уровень (top) лишь открывает следующие, «пройденными» их не делает. */
export default function LevelPath({ levels, level, maxLevel, history = [], W = 20, NEED = 16, passed = {}, PASS = 100, onSelect, collapsible, compact }) {
  const top = Math.max(maxLevel || 1, level);
  const cnt = n => (passed && passed[n]) || 0, isPassed = n => cnt(n) >= PASS;
  const countRing = (n, size, num) => <Ring pct={Math.min(100, Math.round(cnt(n) / PASS * 100))} size={size} num={num} label={cnt(n)} />;
  const [open, setOpen] = useState(false);
  const right = history.reduce((a, b) => a + b, 0);
  const pct = Math.min(100, Math.round((Math.min(right, NEED) / NEED) * 100));
  const leftN = Math.max(0, NEED - right), need = Math.max(0, W - history.length);
  const last = top >= levels.length;
  const hint = last ? 'last level' : `to next: ${leftN} correct${need > 0 ? ` and ${need} more answers` : ''} of ${W}`;
  const [opened, setOpened] = useState(null);

  const itemBase = cn('grid gap-3.5 items-start text-left bg-transparent border-0 rounded-xl text-ink',
    compact ? 'grid-cols-[34px_minmax(0,1fr)] px-0 py-1' : 'grid-cols-[42px_minmax(0,1fr)_auto] px-2.5 py-2');
  const ringSize = compact ? 'w-[34px] h-[34px]' : 'w-[42px] h-[42px]';
  const icoSize = compact ? 'w-[34px] h-[34px]' : 'w-[42px] h-[42px]';
  const titleCls = compact ? 'text-sm' : 'text-base';
  const subCls = compact ? 'text-xs text-ink-2' : 'text-[13px] text-ink-2';

  const row = (l, i, short) => {
    const n = i + 1, state = isPassed(n) ? 'done' : n === top ? 'cur' : n < top ? 'open' : 'locked';
    const num = compact ? 'text-[11px]' : 'text-[13px]';
    const icon = state === 'done' ? <span className={cn(ICON, icoSize, 'bg-accent text-white')}><Trophy /></span>
      : state === 'cur' ? <Ring pct={pct} size={ringSize} num={num} />
      : state === 'open' ? countRing(n, ringSize, num)
      : <span className={cn(ICON, icoSize, 'bg-rule text-paper')}><Note /></span>;
    const sub = state === 'done' ? `passed · ${l.desc}` : state === 'cur' ? (n === level ? hint : l.desc) : state === 'open' ? `${cnt(n)} of ${PASS} correct · ${l.desc}` : l.desc;
    const numCls = state === 'locked' ? 'text-ink-3' : 'text-accent';
    const body = (<>
      <span className="grid gap-0.5 min-w-0">
        <b className={cn('font-medium', titleCls, state === 'locked' && 'font-normal')}><span className={cn('font-medium mr-0.5', numCls)}>{n}.</span> {short && l.short ? l.short : l.title}</b>
        <small className={subCls}>{sub}</small>
      </span>
      {n === level && <span className="text-xs text-accent whitespace-nowrap">now</span>}
    </>);
    const cls = cn(itemBase, state === 'locked' && 'text-ink-3', n === level && 'bg-accent-soft');
    return onSelect
      ? <button key={n} className={cn(cls, 'cursor-pointer hover:bg-tint')} onClick={() => { onSelect(n); setOpen(false); }}>{icon}{body}</button>
      : <div key={n} className={cls}>{icon}{body}</div>;
  };

  if (compact) return <div className="grid gap-1 pt-1.5">{row(levels[level - 1], level - 1)}</div>;
  if (collapsible && !open) {
    const done = isPassed(level);
    const closedSub = done ? `passed · ${cnt(level)} correct` : level === top ? hint : `${cnt(level)} of ${PASS} correct`;
    return (
      <div className="grid gap-1 pt-3 pb-1">
        <button className={cn(itemBase, 'bg-tint cursor-pointer hover:bg-accent-soft')} onClick={() => setOpen(true)}>
          {done ? <span className={cn(ICON, 'bg-accent text-white')}><Trophy /></span> : level === top ? <Ring pct={pct} /> : countRing(level)}
          <span className="grid gap-0.5 min-w-0"><b className="font-medium text-base"><span className="font-medium mr-0.5 text-accent">{level}.</span> {levels[level - 1].title}</b><small className="text-[13px] text-ink-2">level {level} of {levels.length} · {closedSub}</small></span>
          <span className="text-accent shrink-0" aria-label="all levels"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></span>
        </button>
      </div>
    );
  }
  const groups = levels[0] && levels[0].group ? levels.reduce((acc, l, i) => { const g = acc[acc.length - 1]; if (g && g.title === l.group) g.idx.push(i); else acc.push({ title: l.group, idx: [i] }); return acc; }, []) : null;
  const isOpen = g => opened ? opened.has(g.title) : g.idx.includes(level - 1);
  const toggle = g => { const next = new Set(opened || groups.filter(isOpen).map(x => x.title)); if (next.has(g.title)) next.delete(g.title); else next.add(g.title); setOpened(next); };
  const group = g => {
    const first = g.idx[0] + 1, lastN = g.idx[g.idx.length - 1] + 1, done = g.idx.filter(i => isPassed(i + 1)).length;
    const state = done === g.idx.length ? 'done' : first <= top ? 'cur' : 'locked', gopen = isOpen(g);
    const icon = state === 'done' ? <span className={cn(ICON, 'bg-accent text-white')}><Trophy /></span>
      : state === 'cur' ? <span className={cn(ICON, 'bg-accent-soft text-accent text-[13px] font-medium')}>{done}/{g.idx.length}</span>
      : <span className={cn(ICON, 'bg-rule text-paper')}><Note /></span>;
    const sub = state === 'done' ? `levels ${first}–${lastN} · passed` : state === 'cur' ? `levels ${first}–${lastN} · ${done} of ${g.idx.length} passed` : `levels ${first}–${lastN}`;
    return (
      <div key={g.title} className="grid gap-0.5">
        <button type="button" className={cn(itemBase, 'w-full cursor-pointer hover:bg-tint', gopen && 'bg-tint')} aria-expanded={gopen} onClick={() => toggle(g)}>
          {icon}<span className="grid gap-0.5 min-w-0"><b className="font-medium text-base">{g.title}</b><small className="text-[13px] text-ink-2">{sub}</small></span><span className="text-ink-3 text-[13px]">{gopen ? '▴' : '▾'}</span>
        </button>
        {gopen && <div className="grid gap-0.5 pt-0.5 pb-1.5 pl-[22px] ml-[30px] mb-1 border-l-2 border-rule [&>*]:px-2.5 [&>*]:py-1.5">{g.idx.map(i => row(levels[i], i, true))}</div>}
      </div>
    );
  };
  return (
    <div className="grid gap-1 pt-3 pb-1">
      {groups ? groups.map(group) : levels.map((l, i) => row(l, i))}
      {collapsible && <button className="justify-self-start text-[13px] text-accent px-2.5 py-1 hover:underline cursor-pointer bg-transparent border-0" onClick={() => setOpen(false)}>collapse ▴</button>}
    </div>
  );
}
