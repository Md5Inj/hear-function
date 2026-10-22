'use client';
/* Метроном. По умолчанию щёлкает каждую долю, акцент на первой. «Тихий режим»: такт звучит,
   затем N тактов тишины — держишь темп сам, звучащий такт сверяет. Планировщик на Web Audio с упреждением. */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const mark = b => b < 60 ? 'Largo' : b < 76 ? 'Adagio' : b < 108 ? 'Andante' : b < 120 ? 'Moderato' : b < 168 ? 'Allegro' : 'Presto';
const clampBpm = v => Math.max(30, Math.min(240, v));

export default function MetronomeExercise() {
  const t = useTranslations('Metronome');
  const [bpm, setBpm] = useState(90);
  const [beats, setBeats] = useState(4);
  const [silentMode, setSilentMode] = useState(false);
  const [silent, setSilent] = useState(1);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [muted, setMuted] = useState(false);
  const [holdBar, setHoldBar] = useState(0);

  const st = useRef({ ctx: null, next: 0, beat: 0, bar: 0, timer: null, queue: [], raf: 0, hold: null }).current;
  const cfg = useRef({ bpm, beats, silentMode, silent }); cfg.current = { bpm, beats, silentMode, silent };

  function click(time, accent) {
    const ctx = st.ctx;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1000;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(accent ? 0.6 : 0.38, time + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(time); osc.stop(time + 0.06);
  }
  function scheduler() {
    const ctx = st.ctx; const c = cfg.current; const spb = 60 / Math.max(20, c.bpm || 20);
    while (st.next < ctx.currentTime + 0.12) {
      const audible = !c.silentMode || st.bar % (c.silent + 1) === 0;
      if (audible) click(st.next, st.beat === 0);
      st.queue.push({ t: st.next, beat: st.beat, bar: st.bar, audible });
      st.next += spb; st.beat++;
      if (st.beat >= c.beats) { st.beat = 0; st.bar++; }
    }
  }
  function visual() {
    const ctx = st.ctx; if (!ctx) return;
    const now = ctx.currentTime; let cur = null;
    while (st.queue.length && st.queue[0].t <= now + 0.001) cur = st.queue.shift();
    if (cur) {
      const c = cfg.current;
      if (cur.audible) { setMuted(false); setBeat(cur.beat); setHoldBar(0); }
      else { setMuted(true); setBeat(cur.beat); setHoldBar(cur.bar % (c.silent + 1)); }
    }
    st.raf = requestAnimationFrame(visual);
  }
  function start() {
    if (running) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    st.ctx = new AC(); st.ctx.resume && st.ctx.resume();
    st.beat = 0; st.bar = 0; st.queue = []; st.next = st.ctx.currentTime + 0.15;
    st.timer = setInterval(scheduler, 25); scheduler();
    st.raf = requestAnimationFrame(visual);
    setRunning(true);
  }
  function stop() {
    clearInterval(st.timer); cancelAnimationFrame(st.raf);
    if (st.ctx) { try { st.ctx.close(); } catch (e) {} st.ctx = null; }
    st.queue = []; setRunning(false); setBeat(-1); setMuted(false); setHoldBar(0);
  }
  useEffect(() => () => { stop(); release(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // регулятор темпа: нажатие шагает на 1, удержание ускоряется; стоп на любом отпускании указателя
  function release() { clearTimeout(st.hold); st.hold = null; window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); }
  function hold(d) {
    release();
    setBpm(b => clampBpm(b + d));
    let delay = 320;
    const tick = () => { setBpm(b => clampBpm(b + d)); delay = Math.max(40, delay * 0.8); st.hold = setTimeout(tick, delay); };
    st.hold = setTimeout(tick, delay);
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
  }

  const StepBtn = ({ d, label }) => (
    <button aria-label={label} onPointerDown={e => { e.preventDefault(); hold(d); }} onContextMenu={e => e.preventDefault()}
      className="h-12 w-12 rounded-full border border-rule text-ink-2 text-2xl leading-none flex items-center justify-center hover:border-ink hover:text-ink active:bg-tint select-none shrink-0 touch-none">{d > 0 ? '+' : '−'}</button>
  );

  return (
    <section className="pt-10 max-w-[480px] mx-auto">
      <div className="rounded-3xl border border-rule bg-paper shadow-[0_18px_50px_rgba(28,32,51,0.08)] px-7 py-8 text-center">
        <div className="text-[13px] uppercase tracking-[0.14em] text-ink-3">{mark(bpm)}</div>

        {/* регулятор темпа: − крупное число + */}
        <div className="flex items-center justify-center gap-5 mt-2">
          <StepBtn d={-1} label={t('slower')} />
          <div className="leading-none">
            <input type="text" inputMode="numeric" value={bpm || ''} aria-label={t('tempoAria')}
              onChange={e => { const n = e.target.value.replace(/\D/g, '').slice(0, 3); setBpm(n === '' ? 0 : +n); }}
              onBlur={() => setBpm(b => clampBpm(b || 30))}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="font-serif font-medium text-ink tabular-nums text-center bg-transparent border-0 outline-none p-0 cursor-text caret-accent"
              style={{ fontSize: 'clamp(56px,14vw,84px)', width: `${String(bpm || '').length + 0.6}ch` }} />
          </div>
          <StepBtn d={1} label={t('faster')} />
        </div>
        <div className="text-ink-3 text-sm mt-1 mb-5">{t('bpm')}</div>

        {/* размер — крупный, кликабельный */}
        <div className="flex justify-center mb-5">
          <select value={beats} onChange={e => setBeats(+e.target.value)} aria-label={t('sizeAria')}
            className="appearance-none text-center font-serif text-2xl text-ink tabular-nums cursor-pointer rounded-full border border-rule px-5 py-1.5 hover:border-accent hover:text-accent focus:border-accent outline-none">
            {[2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}/4</option>)}
          </select>
        </div>

        {/* доли такта — единственный визуальный индикатор */}
        <div className="flex items-center justify-center gap-3 min-h-[28px]">
          {Array.from({ length: beats }, (_, i) => (
            <span key={i} className={cn('h-5 w-5 rounded-full transition-colors',
              running && !muted && beat === i ? (i === 0 ? 'bg-accent' : 'bg-ink') : 'bg-rule')} />
          ))}
        </div>
        <div className="h-6 mt-2" aria-hidden="true">{String.fromCharCode(160)}</div>

        <button onClick={() => running ? stop() : start()}
          className={cn('mt-3 w-full rounded-full py-3.5 text-base font-medium transition-colors',
            running ? 'bg-ink text-white hover:bg-[#2a2f45]' : 'bg-accent text-white hover:bg-[#2740b8]')}>
          {running ? t('stop') : t('start')}
        </button>
      </div>

      {/* настройки */}
      <div className="mt-6 grid gap-5">
        <div className="flex items-center justify-between">
          <span className="text-[15px] text-ink">{t('silentMode')}<small className="block text-[13px] text-ink-2">{t('silentHint')}</small></span>
          <button role="switch" aria-checked={silentMode} onClick={() => setSilentMode(v => !v)}
            className={cn('relative h-6 w-11 rounded-full transition-colors shrink-0', silentMode ? 'bg-accent' : 'bg-rule')}>
            <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-paper shadow transition-all', silentMode ? 'left-[22px]' : 'left-0.5')} />
          </button>
        </div>

        {silentMode && (
          <div className="flex items-center justify-between">
            <span className="text-[15px] text-ink">{t('silentBars')}</span>
            <select value={silent} onChange={e => setSilent(+e.target.value)} className="font-sans text-sm px-3 py-2 border border-rule rounded-md bg-paper text-ink cursor-pointer">
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
      </div>
    </section>
  );
}
