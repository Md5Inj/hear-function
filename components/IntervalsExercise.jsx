'use client';
/* Упражнение «Интервалы»: две ноты вверх, вниз или вместе; ответ — название интервала. */
import { useEffect, useRef, useReducer, useState } from 'react';
import T from '@/lib/theory';
import IV from '@/lib/intervals';
import { useApp } from './AppProvider';
import { useExercise } from './useExercise';
import { useSession, SessionStrip, SettingsPopover } from './SessionStrip';
import { useMistakes, MistakesEmpty, MistakesBadge } from './useMistakes';
import HelpPopover from './HelpPopover';
import LevelPath from './LevelPath';
import LevelUpBanner from './LevelUpBanner';
import { toast } from './ui';
import { useTranslations } from 'next-intl';
import { Button } from './ui/button';
import * as EX from './ui/ex';
import { cn } from '@/lib/utils';

export default function IntervalsExercise({ mistakes, tonus }) {
  const mode = 'major';  // интервалы не зависят от лада; прогресс хранится под intervals.major
  const { store, audio, logAnswer, weightedPick, pick, settings } = useApp();
  const tx = useTranslations('Ex');
  const [, rerender] = useReducer(x => x + 1, 0);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const st = useRef({ q: null, answered: false, chosen: null, last: null, autoTimer: null, unlocked: false, pendingAcc: null }).current;
  const session = useSession(settings.sessionLength || 10);
  const mk = useMistakes('intervals', mode, mistakes); const mkRef = useRef(mk); mkRef.current = mk;
  const page = useExercise({ exercise: 'intervals', mode, levels: () => IV.LEVELS, onReset: () => next(false) });

  function newQuestion() {
    const p0 = page.prog(); const top = Math.max(p0.maxLevel || 1, p0.level);
    const lvl = tonus ? IV.LEVELS[Math.floor(Math.random() * top)] : page.levelDef();
    let pool = lvl.semis.map(s => IV.bySemis(s));
    if (mkRef.current.on) { pool = [...new Set((mkRef.current.items || []).map(i => i.truth))].map(IV.byLabel).filter(Boolean); if (!pool.length) return null; }
    const iv = weightedPick(pool, i => (1 + 3 * page.errRate(i.label)) * (i.label === st.last && pool.length > 1 ? 0.35 : 1));
    st.last = iv.label;
    const low = 48 + Math.floor(Math.random() * (72 - 48 - iv.semis)), high = low + iv.semis;
    const dir = lvl.dir === 'mix' ? ['up', 'down', 'harm'][Math.floor(Math.random() * 3)] : lvl.dir;  // смешанно: способ подачи каждый раз случайный
    const q = { iv, low, high, dir, timbre: page.timbre(lvl), level: lvl };
    try { audio().warm(q.timbre, [low, high]); } catch (e) { /* без звука на сервере */ }
    return q;
  }
  function play() {
    const q = st.q; if (!q) return; st.unlocked = true;
    const e = audio(); const t = e.ctx.currentTime + 0.1;
    if (q.dir === 'harm') { e.playChord(q.timbre, [q.low, q.high], t, 1.8, 0.75); return; }
    const [a, b] = q.dir === 'up' ? [q.low, q.high] : [q.high, q.low];
    e.playNote(q.timbre, a, t, 0.8, 0.7); e.playNote(q.timbre, b, t + 0.85, 1.3, 0.7);
  }
  function answer(label) {
    const q = st.q; if (!q || st.answered) return;
    st.answered = true; st.chosen = label;
    const correct = label === q.iv.label;
    if (!tonus) page.recordConfusion(q.iv.label, label);
    const levelUp = tonus ? false : page.recordResult(correct); session.push(correct); if (levelUp) setLevelUpOpen(true);
    if (correct && mkRef.current.on) mkRef.current.remove(i => i.truth === label);
    logAnswer({ exercise: 'intervals', mode, level: page.prog().level, correct, answer: label, truth: q.iv.label });
    rerender();
    if (!levelUp && store.autoNext) { clearTimeout(st.autoTimer); st.autoTimer = setTimeout(next, correct ? 1400 : 3200); }
  }
  function next(autoplay) {
    clearTimeout(st.autoTimer); session.nextIfDone();
    st.q = newQuestion(); st.answered = false; st.chosen = null; rerender();
    if (autoplay !== false && st.unlocked) play();
  }
  const fns = useRef(null); fns.current = { next, play, answer };
  useEffect(() => { if (mistakes && !mk.loaded) return; fns.current.next(false); return () => clearTimeout(st.autoTimer); }, [mistakes, tonus, mk.loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = ev => {
      if (/^(SELECT|INPUT|TEXTAREA)$/.test(ev.target.tagName)) return;
      const { next, play, answer } = fns.current; const q = st.q;
      if (ev.key === 'Enter') { ev.preventDefault(); if (st.answered) next(); else play(); }
      else if (ev.key === 'r' || ev.key === 'к') { if (q) play(); }
      else if ((ev.key === '-' || ev.key === 'и') && q && !st.answered) st.pendingAcc = 'm';
      else if ((ev.key === '+' || ev.key === '=') && q && !st.answered) st.pendingAcc = 'A';
      else if (/^[2-8]$/.test(ev.key) && q && !st.answered) {
        ev.preventDefault(); const n = +ev.key; const acc = st.pendingAcc; st.pendingAcc = null;
        const want = IV.INTERVALS.find(i => i.num === n && (acc === 'A' ? i.q === 'A' : acc === 'm' ? i.q === 'm' : (i.q === 'M' || i.q === 'P')));
        if (want && q.level.semis.includes(want.semis)) answer(want.label); else if (want) toast(tx('intervalNotOnLevel', { x: want.disp }));
      }
    };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [st]);

  const q = st.q, answered = st.answered;
  const choices = q ? q.level.semis.map(IV.bySemis) : [];
  const correct = answered && st.chosen === q.iv.label;
  const noMistakes = mistakes && mk.loaded && !q;
  return (
    <>
      <SessionStrip session={session} noun={tx('question')} active={!!q} idle={noMistakes} note={mistakes ? tx('mistakesNote') : tonus ? tx('tonusNote') : null} right={<><MistakesBadge exercise="intervals" mode={mode} level={page.prog().level} href="/intervals?mistakes=1" on={!!mistakes} /><HelpPopover exercise="intervals" /><SettingsPopover ctx={page} showTimbre mistakes={{ on: !!mistakes, count: mk.count, tonus: !!tonus }} /></>} />
      {!mistakes && !tonus && <LevelPath levels={page.levels()} level={page.prog().level} maxLevel={page.prog().maxLevel} history={(page.prog().byLevel || {})[Math.max(page.prog().maxLevel || 1, page.prog().level)] || page.prog().history} W={settings.levelUpWindow || 20} NEED={settings.levelUpNeed || 16} onSelect={n => page.setLevel(n)} collapsible />}
      {levelUpOpen && <LevelUpBanner ctx={page} onClose={() => setLevelUpOpen(false)} />}
      {noMistakes && <MistakesEmpty href="/intervals" />}
      <section className={EX.STAGE} hidden={noMistakes}>
        <div className={EX.ACTIONS}><Button variant="primary" size="primary" onClick={() => play()}>{tx('listen')}</Button></div>
        <div className={EX.PARTLINE}>{q ? (q.dir === 'harm' ? tx('intervalHarm') : q.dir === 'up' ? tx('intervalUp') : tx('intervalDown')) : ''}</div>
        <div className={EX.KEYS}>
          {choices.map(i => (
            <button key={i.label} className={cn(EX.KEY, answered && i.label === q.iv.label && EX.KEY_OK, answered && i.label === st.chosen && i.label !== q.iv.label && EX.KEY_BAD)} disabled={answered} data-tip={i.name} onClick={() => answer(i.label)}>{i.disp}</button>
          ))}
        </div>
        {answered && <div className={EX.ACTIONS + ' mt-[22px]'} id="nextActions"><Button variant="primary" size="primary" onClick={() => next()}>{tx('next')}</Button></div>}
        <div className={EX.feedbackCls(answered, correct)}>
          {answered && <div className="text-lg"><b className="font-semibold">{correct ? tx('yes') : tx('no')}</b> {q.iv.name}: {T.NOTE_NAMES[q.low % 12]}–{T.NOTE_NAMES[q.high % 12]}. <button className={EX.LINK} onClick={play}>{tx('again')}</button></div>}
        </div>
      </section>
    </>
  );
}
