'use client';
/* Упражнение «Ступени»: каденция задаёт тональность, затем звучит одна нота. */
import { useEffect, useRef, useReducer } from 'react';
import T from '@/lib/theory';
import P from '@/lib/progressions';
import { useApp } from './AppProvider';
import { useExercise } from './useExercise';
import { useSession, SessionStrip, SettingsPopover } from './SessionStrip';
import { toast } from './ui';

export default function DegreesExercise({ mode }) {
  const { store, audio, logAnswer, weightedPick, pick, settings } = useApp();
  const [, rerender] = useReducer(x => x + 1, 0);
  const st = useRef({ q: null, answered: false, chosen: null, block: null, lastDegree: null, autoTimer: null, unlocked: false, pendingAcc: null }).current;
  const session = useSession(settings.sessionLength || 10);
  const page = useExercise({ exercise: 'degrees', mode, levels: m => P.DEGREE_LEVELS[m], onReset: () => { st.block = null; next(false); } });

  function newQuestion() {
    const lvl = page.levelDef(), mode = page.mode;
    let tonicPc, playCadence = true;
    if (lvl.keyHint === 'block') {
      if (!st.block || st.block.remaining <= 0 || st.block.mode !== mode) st.block = { tonicPc: Math.floor(Math.random() * 12), remaining: lvl.blockSize, mode };
      else playCadence = false;
      tonicPc = st.block.tonicPc; st.block.remaining--;
    } else tonicPc = Math.floor(Math.random() * 12);
    const label = weightedPick(lvl.degrees, l => (1 + 3 * page.errRate(l)) * (l === st.lastDegree ? 0.35 : 1));
    st.lastDegree = label;
    const degree = T.degreeByLabel(mode, label);
    const midi = Math.max(48, Math.min(84, T.tonicMidi(tonicPc) + degree.st + 12 * pick(lvl.octaves)));
    return { mode, tonicPc, degree, midi, timbre: page.timbre(lvl), playCadence, cadence: T.voiceLead(T.CADENCE[mode], mode, tonicPc) };
  }
  function play(opts) {
    const q = st.q; if (!q) return;
    opts = opts || {}; st.unlocked = true;
    const e = audio(); let t = e.ctx.currentTime + 0.1;
    if (q.playCadence && !opts.noteOnly) {
      q.cadence.forEach((c, i) => { const d = i === q.cadence.length - 1 ? 1.0 : 0.65; e.playChord(q.timbre, c.notes, t, d); t += d; });
      t += 0.55;
    }
    e.playNote(q.timbre, q.midi, t, 1.4, 0.5);
  }
  function playResolution() {
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
    st.answered = true; st.chosen = label;
    const correct = label === q.degree.label;
    page.recordConfusion(q.degree.label, label);
    const levelUp = page.recordResult(correct); session.push(correct);
    logAnswer({ exercise: 'degrees', mode: q.mode, level: page.prog().level, correct, answer: label, truth: q.degree.label });
    rerender();
    if (!levelUp && store.autoNext) { clearTimeout(st.autoTimer); st.autoTimer = setTimeout(next, correct ? 1400 : 3200); }
  }
  function next(autoplay) {
    clearTimeout(st.autoTimer); session.nextIfDone();
    st.q = newQuestion(); st.answered = false; st.chosen = null; rerender();
    if (autoplay !== false && st.unlocked) play();
  }
  const fns = useRef(null); fns.current = { next, play, answer };
  useEffect(() => { fns.current.next(false); return () => clearTimeout(st.autoTimer); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
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
        if (page.levelDef().degrees.includes(deg.label)) answer(deg.label); else toast(`Ступени ${deg.label} нет на этом уровне`);
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
      <SessionStrip session={session} noun="Вопрос" active={!!q} right={<SettingsPopover ctx={page} showTimbre />} />
      <section className="stage-mid">
        <div className="actions">
          <button className="btn primary" onClick={() => play()}>Слушать</button>
          {q && q.playCadence && <button className="link" onClick={() => play({ noteOnly: true })}>только нота</button>}
        </div>
        <div className="part-line">Какая ступень звучит после каденции?</div>
        <div className="keys">
          {keys.map(label => (
            <button key={label} className={'key' + (/[♭♯♮]/.test(label) ? ' chrom' : '') + (answered && label === q.degree.label ? ' correct' : '') + (answered && label === st.chosen && label !== q.degree.label ? ' wrong' : '')} disabled={answered} onClick={() => answer(label)}>{label}</button>
          ))}
        </div>
        {answered && <div className="actions"><button className="btn primary" onClick={() => next()}>Дальше</button></div>}
        <div className={'feedback' + (answered ? ' show ' + (correct ? 'ok' : 'bad') : '')}>
          {answered && <div className="lead"><b>{correct ? 'Верно.' : 'Нет.'}</b> <span className="roman">{q.degree.label}</span>, {T.NOTE_NAMES[q.midi % 12]} в {T.keyName(q.mode, q.tonicPc)}. <button className="link" onClick={playResolution}>разрешение</button></div>}
        </div>
      </section>
    </>
  );
}
