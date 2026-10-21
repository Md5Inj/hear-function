'use client';
/* Список уровней: пройденные — зелёный кружок с кубком, текущий — кольцо с процентом до следующего уровня,
   закрытые — серый кружок с нотой. На страницах упражнений список сворачивается до текущей строки. */
import { useState } from 'react';

const Trophy = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M7 6H4a3 3 0 0 0 3 3" /><path d="M17 6h3a3 3 0 0 1-3 3" /></svg>;
const Note = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3v11.6a3.5 3.5 0 1 0 2 3.2V7l4-1V3l-6 1.5z" /></svg>;
function Ring({ pct }) {
  const r = 17, c = 2 * Math.PI * r;
  return (
    <span className="lvl-ring">
      <svg width="42" height="42" viewBox="0 0 42 42"><circle cx="21" cy="21" r={r} fill="var(--paper)" stroke="var(--rule)" strokeWidth="3.5" /><circle cx="21" cy="21" r={r} fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round" transform="rotate(-90 21 21)" /></svg>
      <b>{pct}</b>
    </span>
  );
}

export default function LevelPath({ levels, level, maxLevel, history = [], W = 20, NEED = 16, onSelect, collapsible, compact }) {
  const top = Math.max(maxLevel || 1, level);  // достигнутый уровень; level — выбранный
  const [open, setOpen] = useState(false);
  const right = history.reduce((a, b) => a + b, 0);  // history — окно достигнутого уровня (см. вызовы)
  const pct = Math.min(100, Math.round((Math.min(right, NEED) / NEED) * 100));
  const left = Math.max(0, NEED - right), need = Math.max(0, W - history.length);
  const last = top >= levels.length;
  const hint = last ? 'последний уровень' : `до следующего: ${left} верных${need > 0 ? ` и ещё ${need} ответов` : ''} из ${W}`;
  const [opened, setOpened] = useState(null);  // раскрытые аккордеоны групп; по умолчанию — группа выбранного уровня
  const row = (l, i, short) => {
    const n = i + 1, state = n < top ? 'done' : n === top ? 'cur' : 'locked';
    const icon = state === 'done' ? <span className="lvl-icon done"><Trophy /></span> : state === 'cur' ? <Ring pct={pct} /> : <span className="lvl-icon locked"><Note /></span>;
    const sub = state === 'done' ? `пройден · ${l.desc}` : state === 'cur' ? (n === level ? hint : l.desc) : l.desc;
    const body = <><span className="lvl-item-text"><b><span className="lvl-num">{n}.</span> {short && l.short ? l.short : l.title}</b><small>{sub}</small></span>{n === level && <span className="lvl-now">сейчас</span>}</>;
    const cls = 'lvl-item ' + state + (n === level ? ' selected' : '');
    return onSelect ? <button key={n} className={cls} onClick={() => { onSelect(n); setOpen(false); }}>{icon}{body}</button> : <div key={n} className={cls}>{icon}{body}</div>;
  };
  if (compact) return <div className="lvl-list compact">{row(levels[level - 1], level - 1)}</div>;
  if (collapsible && !open) {
    const done = level < top;
    return <div className="lvl-list collapsed"><button className="lvl-item cur selected" onClick={() => setOpen(true)}>{done ? <span className="lvl-icon done"><Trophy /></span> : <Ring pct={pct} />}<span className="lvl-item-text"><b><span className="lvl-num">{level}.</span> {levels[level - 1].title}</b><small>уровень {level} из {levels.length} · {done ? `пройден, достигнут уровень ${top}` : hint}</small></span><span className="lvl-more">все уровни ▾</span></button></div>;
  }
  // уровни с полем group (интервалы) идут аккордеонами: заголовок группы, под ним её задачи
  const groups = levels[0] && levels[0].group ? levels.reduce((acc, l, i) => { const g = acc[acc.length - 1]; if (g && g.title === l.group) g.idx.push(i); else acc.push({ title: l.group, idx: [i] }); return acc; }, []) : null;
  const isOpen = g => opened ? opened.has(g.title) : g.idx.includes(level - 1);
  const toggle = g => { const next = new Set(opened || groups.filter(isOpen).map(x => x.title)); if (next.has(g.title)) next.delete(g.title); else next.add(g.title); setOpened(next); };
  const group = g => {
    const first = g.idx[0] + 1, lastN = g.idx[g.idx.length - 1] + 1, done = g.idx.filter(i => i + 1 < top).length;
    const state = lastN < top ? 'done' : first <= top ? 'cur' : 'locked', open = isOpen(g);
    const icon = state === 'done' ? <span className="lvl-icon done"><Trophy /></span> : state === 'cur' ? <span className="lvl-icon cur">{done}/{g.idx.length}</span> : <span className="lvl-icon locked"><Note /></span>;
    const sub = state === 'done' ? `уровни ${first}–${lastN} · пройдены` : state === 'cur' ? `уровни ${first}–${lastN} · пройдено ${done} из ${g.idx.length}` : `уровни ${first}–${lastN}`;
    return (
      <div key={g.title} className={'lvl-group ' + state + (open ? ' open' : '')}>
        <button type="button" className="lvl-item lvl-group-head" aria-expanded={open} onClick={() => toggle(g)}>{icon}<span className="lvl-item-text"><b>{g.title}</b><small>{sub}</small></span><span className="lvl-chevron">{open ? '▴' : '▾'}</span></button>
        {open && <div className="lvl-group-body">{g.idx.map(i => row(levels[i], i, true))}</div>}
      </div>
    );
  };
  return (
    <div className="lvl-list">
      {groups ? groups.map(group) : levels.map((l, i) => row(l, i))}
      {collapsible && <button className="link lvl-collapse" onClick={() => setOpen(false)}>свернуть ▴</button>}
    </div>
  );
}
