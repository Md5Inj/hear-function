'use client';
/* Упражнение «Ступени»: каденция задаёт тональность, затем звучит одна нота. */
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
import { useTranslations } from 'next-intl';
import { Button } from './ui/button';
import * as EX from './ui/ex';
import { cn } from '@/lib/utils';
import { useLocale } from 'next-intl';
import { tr } from '@/lib/i18n-data';

export default function DegreesExercise({ mode, mistakes, tonus }) {
  const { store, audio, logAnswer, weightedPick, pick, settings } = useApp();
  const tx = useTranslations('Ex'); const locale = useLocale();
  const [, rerender] = useReducer(x => x + 1, 0);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const st = useRef({ q: null, answered: false, chosen: null, block: null, lastDegree: null, autoTimer: null, deadline: null, unlocked: false, pendingAcc: null }).current;
  const session = useSession(settings.sessionLength || 10);
  const mk = useMistakes('degrees', mode, mistakes); const mkRef = useRef(mk); mkRef.current = mk;
  const page = useExercise({ exercise: 'degrees', mode, levels: m => P.DEGREE_LEVELS[m], onReset: () => { st.block = null; next(false); } });

  function newQuestion() {
    const p0 = page.prog(); const top = Math.max(p0.maxLevel || 1, p0.level);
    const lvl = tonus ? page.levels()[Math.floor(Math.random() * top)] : page.levelDef(), mode = page.mode;  // тонус: случайный из пройденных уровней
    let tonicPc, playCadence = true;
    if (lvl.keyHint === 'block') {
      if (!st.block || st.block.remaining <= 0 || st.block.mode !== mode) st.block = { tonicPc: Math.floor(Math.random() * 12), remaining: lvl.blockSize, mode };
      else playCadence = false;
      tonicPc = st.block.tonicPc; st.block.remaining--;
    } else tonicPc = Math.floor(Math.random() * 12);
    let pool = lvl.degrees;
    if (mkRef.current.on) { pool = [...new Set((mkRef.current.items || []).map(i => i.truth).filter(l => T.degreeByLabel(mode, l)))]; if (!pool.length) return null; }
    const label = weightedPick(pool, l => (1 + 3 * page.errRate(l)) * (l === st.lastDegree && pool.length > 1 ? 0.35 : 1));
    st.lastDegree = label;
    const degree = T.degreeByLabel(mode, label);
    const midi = Math.max(48, Math.min(84, T.tonicMidi(tonicPc) + degree.st + 12 * pick(lvl.octaves)));
    const q = { mode, tonicPc, degree, midi, timbre: page.timbre(lvl), playCadence, fast: !!lvl.fast, cadence: T.voiceLead(T.CADENCE[mode], mode, tonicPc) };
    try { audio().warm(q.timbre, q.cadence.flatMap(c => c.notes).concat([midi])); } catch (e) { /* без звука на сервере */ }
    return q;
  }
  function play(opts) {
    const q = st.q; if (!q) return; try { audio().stopAll(); } catch (e) { /* без звука на сервере */ }  // новый звук глушит предыдущий
    opts = opts || {}; st.unlocked = true;
    const e = audio(); let t = e.ctx.currentTime + 0.1;
    // в темпе: каденция вдвое короче, нота сразу за ней, на ответ FAST_ANSWER секунд с момента ноты
    const k = q.fast ? 0.5 : 1;
    if (q.playCadence && !opts.noteOnly) {
      q.cadence.forEach((c, i) => { const d = (i === q.cadence.length - 1 ? 1.0 : 0.65) * k; e.playChord(q.timbre, c.notes, t, d); t += d; });
      t += 0.55 * k;
    }
    e.playNote(q.timbre, q.midi, t, q.fast ? 1.0 : 1.4, 0.5);
    if (q.fast && !st.deadline && !st.answered) st.deadline = setTimeout(() => fns.current.answer(null), (t - e.ctx.currentTime + P.FAST_ANSWER) * 1000);
  }
  function playResolution() {
    try { audio().stopAll(); } catch (e) { /* без звука на сервере */ } 
    const q = st.q; const e = audio();
    const scale = T.SCALES[q.mode].slice();
    if (q.mode === 'minor' && q.degree.st === 11) scale[6] = 11;
    const base = q.midi - q.degree.st, s = q.degree.st, path = [q.midi];
    if (s > 0 && s <= 6) {
      let cur = scale.includes(s) ? s : Math.max(...scale.filter(x => x < s));
      while (cur > 0) { path.push(base + cur); cur = Math.max(...scale.filter(x => x < cur)); }
      path.push(base);
    } else if (s > 6) {
      let cur = scale.includes(s) ? s : Math.min(...scale.filter(x => x > s), 12);
      while (cur < 12) { path.push(base + cur); cur = Math.min(...scale.filter(x => x > cur), 12); }
      path.push(base + 12);
    }
    let t = e.ctx.currentTime + 0.05;
    path.forEach((m, i) => { const d = i === path.length - 1 ? 0.9 : 0.38; e.playNote(q.timbre, m, t, d, 0.45); t += d; });
  }
  function answer(label) {
    const q = st.q; if (!q || st.answered) return;
    clearTimeout(st.deadline); st.deadline = null;
    st.answered = true; st.chosen = label;  // label === null — не успели ответить в темпе
    const correct = label === q.degree.label;
    if (!tonus && label !== null) page.recordConfusion(q.degree.label, label);
    const levelUp = tonus ? false : page.recordResult(correct); session.push(correct); if (levelUp) setLevelUpOpen(true);
    if (correct && mkRef.current.on) mkRef.current.remove(i => i.truth === label);
    logAnswer({ exercise: 'degrees', mode: q.mode, level: page.prog().level, correct, answer: label, truth: q.degree.label });
    rerender();
    if (!levelUp && store.autoNext) { clearTimeout(st.autoTimer); st.autoTimer = setTimeout(next, correct ? 1400 : 3200); }
  }
  function next(autoplay) {
    clearTimeout(st.autoTimer); clearTimeout(st.deadline); st.deadline = null; session.nextIfDone();
    st.q = newQuestion(); st.answered = false; st.chosen = null; rerender();
    if (autoplay !== false && st.unlocked) play();
  }
  const fns = useRef(null); fns.current = { next, play, answer };
  useEffect(() => { if (mistakes && !mk.loaded) return; fns.current.next(false); return () => { clearTimeout(st.autoTimer); clearTimeout(st.deadline); }; }, [mode, mistakes, tonus, mk.loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = ev => {
      if (/^(SELECT|INPUT)$/.test(ev.target.tagName)) return;
      const { next, play, answer } = fns.current;
      if (ev.key === 'Enter') { ev.preventDefault(); if (st.answered) next(); else play(); }
      else if (ev.key === 'r' || ev.key === 'к') { if (st.q) play(); }
      else if ((ev.key === '-' || ev.key === 'b' || ev.key === 'и') && st.q && !st.answered) { st.pendingAcc = '♭'; }
      else if ((ev.key === '+' || ev.key === '=' || ev.key === '#') && st.q && !st.answered) { st.pendingAcc = '♯'; }
      else if (/^[1-7]$/.test(ev.key) && st.q && !st.answered) {
        // цифра — ступень лада; «-» или «+» перед цифрой — понижение или повышение
        ev.preventDefault(); const d = +ev.key; const acc = st.pendingAcc; st.pendingAcc = null;
        const semis = (T.SCALES[page.mode][d - 1] + (acc === '♭' ? -1 : acc === '♯' ? 1 : 0) + 12) % 12;
        const deg = T.DEGREES[page.mode].find(x => x.st === semis);
        if (!deg) return;
        if (page.levelDef().degrees.includes(deg.label)) answer(deg.label); else toast(tx('degreeNotOnLevel', { x: deg.label }));
      }
    };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [page, st]);

  const q = st.q, answered = st.answered;
  const order = q ? T.DEGREES[q.mode].map(d => d.label) : [];
  const keys = q ? page.levelDef().degrees.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b)) : [];
  const correct = answered && st.chosen === q.degree.label;
  return (
    <>
      <SessionStrip session={session} noun={tx('question')} active={!!q} idle={mistakes && mk.loaded && !q} note={mistakes ? tx('mistakesNote') : tonus ? tx('tonusNote') : null} right={<><MistakesBadge exercise="degrees" mode={mode} level={page.prog().level} href={'/degrees?mode=' + mode + '&mistakes=1'} on={!!mistakes} /><HelpPopover exercise="degrees" /><SettingsPopover ctx={page} showTimbre mistakes={{ on: !!mistakes, count: mk.count, tonus: !!tonus }} /></>} />
      {!mistakes && !tonus && <LevelPath levels={page.levels()} level={page.prog().level} maxLevel={page.prog().maxLevel} passed={page.prog().correctByLevel} history={(page.prog().byLevel || {})[Math.max(page.prog().maxLevel || 1, page.prog().level)] || page.prog().history} W={settings.levelUpWindow || 20} NEED={settings.levelUpNeed || 16} onSelect={n => page.setLevel(n)} collapsible />}
      {levelUpOpen && <LevelUpBanner ctx={page} onClose={() => setLevelUpOpen(false)} />}
      {mistakes && mk.loaded && !q && <MistakesEmpty href={'/degrees?mode=' + mode} />}
      <section className={EX.STAGE} hidden={mistakes && mk.loaded && !q}>
        <div className={EX.ACTIONS}>
          <Button variant="primary" size="primary" onClick={() => play()}>{tx('listen')}</Button>
          {q && q.playCadence && <button className={EX.LINK} onClick={() => play({ noteOnly: true })}>{tx('noteOnly')}</button>}
        </div>
        <div className={EX.PARTLINE}>{q && q.fast ? tx('degreeFastQ', { n: P.FAST_ANSWER }) : tx('degreeQ')}</div>
        <div className={EX.KEYS}>
          {keys.map(label => (
            <button key={label} className={cn(EX.KEY, /[♭♯♮]/.test(label) && EX.KEY_CHROM, answered && label === q.degree.label && EX.KEY_OK, answered && label === st.chosen && label !== q.degree.label && EX.KEY_BAD)} disabled={answered} onClick={() => answer(label)}>{label}</button>
          ))}
        </div>
        {answered && <div className={EX.ACTIONS + ' mt-[22px]'} id="nextActions"><Button variant="primary" size="primary" onClick={() => next()}>{tx('next')}</Button></div>}
        <div className={EX.feedbackCls(answered, correct)}>
          {answered && <div className="text-lg"><b className="font-semibold">{correct ? tx('yes') : st.chosen === null ? tx('tooSlow') : tx('no')}</b> <span className={EX.ROMAN}>{q.degree.label}</span>, {T.NOTE_NAMES[q.midi % 12]} {tx('inKey')} {tr(T.keyName(q.mode, q.tonicPc), locale)}. <button className={EX.LINK} onClick={playResolution}>{tx('resolution')}</button></div>}
        </div>
      </section>
    </>
  );
}
