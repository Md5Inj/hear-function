'use client';
/* Упражнение «Прогрессии»: аккорды по тактам после каденции. */
import { useEffect, useRef, useReducer, useState } from 'react';
import T from '@/lib/theory';
import P from '@/lib/progressions';
import { useApp } from './AppProvider';
import { useExercise } from './useExercise';
import { useSession, SessionStrip, SettingsPopover } from './SessionStrip';
import { useMistakes, MistakesEmpty, MistakesBadge } from './useMistakes';
import HelpPopover from './HelpPopover';
import LevelPath from './LevelPath';
import LevelUpBanner from './LevelUpBanner';
import { toast } from './ui';
import { Button } from './ui/button';
import * as EX from './ui/ex';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const isChrom = (sym, mode) => /\//.test(sym) || /^♭/.test(sym) || sym === 'N' || (mode === 'minor' && sym === 'I') || (mode === 'major' && sym === 'iv') || sym === 'vii°7';

export default function ProgressionsExercise({ mode, mistakes, tonus }) {
  const { store, audio, logAnswer, weightedPick, settings } = useApp();
  const tx = useTranslations('Ex');
  const [, rerender] = useReducer(x => x + 1, 0);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const st = useRef({ q: null, answered: false, slots: [], sel: 0, lastEntry: null, autoTimer: null, unlocked: false, pendingAcc: null }).current;
  const session = useSession(settings.sessionLength || 10);
  const mk = useMistakes('progressions', mode, mistakes); const mkRef = useRef(mk); mkRef.current = mk;
  const page = useExercise({ exercise: 'progressions', mode, levels: m => P.PROG_LEVELS[m], onReset: () => next(false) });

  function newQuestion() {
    const p0 = page.prog(); const top = Math.max(p0.maxLevel || 1, p0.level);
    const lvl = page.levelDef(), mode = page.mode;
    let pool = P.PROGRESSIONS.filter(p => p.mode === mode && (tonus ? p.level <= top : p.level === page.prog().level));  // тонус: все пройденные уровни
    if (mkRef.current.on) {
      pool = (mkRef.current.items || []).filter(i => Array.isArray(i.truth)).map(i => P.PROGRESSIONS.find(p => p.mode === mode && JSON.stringify(p.chords) === JSON.stringify(i.truth)) || { mode, level: i.level, chords: i.truth, name: 'From your mistakes', examples: [] });
      if (!pool.length) return null;
    }
    const entry = weightedPick(pool, p => (1 + 3 * Math.max(0, ...p.chords.map(c => page.errRate(T.parseToken(c).symbol)))) * (p === st.lastEntry && pool.length > 1 ? 0.25 : 1));
    st.lastEntry = entry;
    const tonicPc = Math.floor(Math.random() * 12);
    const hint = lvl.keyHint === 'cadence' ? T.CADENCE[mode] : [T.CADENCE[mode][0]];
    const voiced = T.voiceLead(hint.concat(entry.chords), mode, tonicPc);
    const q = { mode, tonicPc, entry, chords: entry.chords, hint: voiced.slice(0, hint.length), voiced: voiced.slice(hint.length), keyHint: lvl.keyHint, chordDur: lvl.chordDur, timbre: page.timbre(lvl) };
    try { audio().warm(q.timbre, voiced.flatMap(c => c.notes)); } catch (e) { /* без звука на сервере */ }
    return q;
  }
  function play() {
    const q = st.q; if (!q) return; st.unlocked = true;
    const e = audio(); let t = e.ctx.currentTime + 0.1;
    q.hint.forEach((c, i) => { const d = q.keyHint === 'cadence' ? (i === q.hint.length - 1 ? 0.9 : 0.6) : 1.0; e.playChord(q.timbre, c.notes, t, d); t += d; });
    t += 0.7;
    q.voiced.forEach((c, i) => { const d = i === q.voiced.length - 1 ? q.chordDur * 1.5 : q.chordDur; e.playChord(q.timbre, c.notes, t, d * 0.97); t += d; });
  }
  function playChord(i) { const q = st.q; if (!q) return; const e = audio(); e.playChord(q.timbre, q.voiced[i].notes, e.ctx.currentTime + 0.05, q.chordDur * 1.3); }
  function fill(sym) {
    if (st.answered) return;
    st.slots[st.sel] = sym;
    const after = st.slots.findIndex((s, i) => !s && i > st.sel), any = st.slots.findIndex(s => !s);
    st.sel = after >= 0 ? after : any >= 0 ? any : Math.min(st.sel + 1, st.slots.length - 1);
    rerender();
  }
  function check() {
    const q = st.q; if (!q || st.answered || st.slots.some(s => !s)) return;
    st.answered = true;
    let all = true;
    q.chords.forEach((tok, i) => { const sym = T.parseToken(tok).symbol; if (sym !== st.slots[i]) all = false; if (!tonus) page.recordConfusion(sym, st.slots[i]); });
    const levelUp = tonus ? false : page.recordResult(all); session.push(all); if (levelUp) setLevelUpOpen(true);
    if (all && mkRef.current.on) mkRef.current.remove(i => JSON.stringify(i.truth) === JSON.stringify(q.chords));
    logAnswer({ exercise: 'progressions', mode: q.mode, level: page.prog().level, correct: all, answer: st.slots.slice(), truth: q.chords.slice() });
    rerender();
    if (!levelUp && store.autoNext) { clearTimeout(st.autoTimer); st.autoTimer = setTimeout(next, all ? 1800 : 4500); }
  }
  function next(autoplay) {
    clearTimeout(st.autoTimer); session.nextIfDone();
    st.q = newQuestion(); st.answered = false; st.slots = st.q ? st.q.chords.map(() => null) : []; st.sel = 0; rerender();
    if (autoplay !== false && st.unlocked) play();
  }
  const fns = useRef(null); fns.current = { next, play, check, playChord, fill };
  useEffect(() => { if (mistakes && !mk.loaded) return; fns.current.next(false); return () => clearTimeout(st.autoTimer); }, [mode, mistakes, tonus, mk.loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = ev => {
      if (/^(SELECT|INPUT)$/.test(ev.target.tagName)) return;
      const { next, play, check, playChord } = fns.current;
      if (ev.key === 'Enter') { ev.preventDefault(); if (st.answered) next(); else if (!st.slots.some(s => !s)) check(); else play(); }
      else if (ev.key === 'r' || ev.key === 'к') { if (st.q) play(); }
      else if (ev.key === ' ' && st.q) { ev.preventDefault(); playChord(st.sel); }
      else if (ev.key === 'Backspace' && st.q && !st.answered) { ev.preventDefault(); st.slots[st.sel] = null; rerender(); }
      else if ((ev.key === '-' || ev.key === 'b' || ev.key === 'и') && st.q && !st.answered) { st.pendingAcc = '♭'; }
      else if (/^[1-7]$/.test(ev.key) && st.q && !st.answered) {
        // цифра — диатонический аккорд ступени; «-» перед цифрой — аккорд на пониженной ступени (♭III, ♭VI, ♭VII)
        ev.preventDefault(); const d = +ev.key; const acc = st.pendingAcc; st.pendingAcc = null;
        const diat = st.q.mode === 'major' ? ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] : ['i', 'ii°', 'III', 'iv', 'V', 'VI', 'VII'];
        const flat = ['', 'N', '♭III', '', '', '♭VI', '♭VII'];
        const sym = acc === '♭' ? flat[d - 1] : diat[d - 1];
        if (sym && page.levelDef().vocab.includes(sym)) fns.current.fill(sym); else toast(tx('noSuchChord', { x: sym || '—' }));
      }
      else if (ev.key === 'ArrowLeft' && st.q && !st.answered) { st.sel = Math.max(0, st.sel - 1); rerender(); }
      else if (ev.key === 'ArrowRight' && st.q && !st.answered) { st.sel = Math.min(st.slots.length - 1, st.sel + 1); rerender(); }
    };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [st, page]);

  const q = st.q, answered = st.answered, slots = st.slots;
  const groups = [[], [], []];
  if (q) T.sortByDegree(q.mode, page.levelDef().vocab).forEach(sym => { groups[isChrom(sym, q.mode) ? 2 : /7|ø|sus/.test(sym) ? 1 : 0].push(sym); });
  const all = answered && q.chords.every((tok, i) => T.parseToken(tok).symbol === slots[i]);
  const nRight = answered ? q.chords.filter((tok, i) => T.parseToken(tok).symbol === slots[i]).length : 0;
  const score = answered ? { n: nRight, total: q.chords.length, pct: Math.round(nRight / q.chords.length * 100) } : null;
  const where = q ? [q.entry.name].concat(q.entry.examples).filter(Boolean).join('; ') : '';
  return (
    <>
      <SessionStrip session={session} noun={tx('question')} active={!!q} idle={mistakes && mk.loaded && !q} note={mistakes ? tx('mistakesNote') : tonus ? tx('tonusNote') : null} right={<><MistakesBadge exercise="progressions" mode={mode} level={page.prog().level} href={'/progressions?mode=' + mode + '&mistakes=1'} on={!!mistakes} /><HelpPopover exercise="progressions" /><SettingsPopover ctx={page} showTimbre mistakes={{ on: !!mistakes, count: mk.count, tonus: !!tonus }} /></>} />
      {!mistakes && !tonus && <LevelPath levels={page.levels()} level={page.prog().level} maxLevel={page.prog().maxLevel} passed={page.prog().correctByLevel} history={(page.prog().byLevel || {})[Math.max(page.prog().maxLevel || 1, page.prog().level)] || page.prog().history} W={settings.levelUpWindow || 20} NEED={settings.levelUpNeed || 16} onSelect={n => page.setLevel(n)} collapsible />}
      {levelUpOpen && <LevelUpBanner ctx={page} onClose={() => setLevelUpOpen(false)} />}
      {mistakes && mk.loaded && !q && <MistakesEmpty href={'/progressions?mode=' + mode} />}
      <section className={EX.STAGE} hidden={mistakes && mk.loaded && !q}>
        <div className={EX.ACTIONS}><Button variant="primary" size="primary" onClick={() => play()}>{tx('listen')}</Button></div>
        <div className={EX.PARTLINE}>{tx('progLine')}</div>
        <div className="sheet-wrap"><div className="sheet">
          {q && q.chords.map((tok, i) => {
            if (answered) {
              const sym = T.parseToken(tok).symbol, ok = sym === slots[i];
              return <button key={i} className={'slot ' + (ok ? 'correct' : 'wrong')} onClick={() => playChord(i)}><span>{T.displayToken(tok)}</span>{!ok && <small>{tx('yourVariant', { x: slots[i] })}</small>}</button>;
            }
            return <button key={i} className={'slot' + (i === st.sel ? ' sel' : '')} onClick={() => { st.sel = i; rerender(); }}>{slots[i] ? <span>{slots[i]}</span> : <span className="q">?</span>}</button>;
          })}
        </div></div>
        <div className="vocab">
          {groups.map((g, gi) => g.length ? <div key={gi} className="vocab-group">{g.map(sym => <button key={sym} className="chord" disabled={answered} onClick={() => fill(sym)}>{sym}</button>)}</div> : null)}
        </div>
        <div className={EX.ACTIONS + ' mt-[22px]'}>
          {!answered && <Button variant="primary" size="primary" disabled={!q || slots.some(s => !s)} onClick={check}>{tx('check')}</Button>}
          {answered && <Button variant="primary" size="primary" onClick={() => next()}>{tx('next')}</Button>}
        </div>
        <div className={EX.feedbackCls(answered, all)}>
          {answered && <><div className="text-lg"><b className="font-semibold">{all ? tx('yes') : tx('notQuite')}</b> <span className="text-ink-2">{tx('score', score)}</span></div><div className="text-ink-2 text-[15px] mt-1">{T.keyName(q.mode, q.tonicPc)}: {q.chords.map(c => T.letterName(q.mode, c, q.tonicPc)).join(' – ')}.</div>{where && <div className="text-ink-2 text-[15px] mt-1">{where}.</div>}</>}
        </div>
      </section>
    </>
  );
}
