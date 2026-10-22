'use client';
/* Полоса времени: кусок записи вокруг фрагмента, такты с отдельными границами, бегунок. Всё правится перетягиванием:
   тянуть такт — сдвиг всех тактов; при закрытом замке любая граница растягивает все такты
   пропорционально, при снятом — граница двигает только соседние такты, левый край — начало первого, правый — длину последнего. В режиме редактора в такте выпадашка ступени и кнопки: ▶ прослушать, + такт после, ÷ ещё аккорд в такте, ✕ удалить.
   bars: [{ c, beats, t, dur, n, barStart }]. */
import { useEffect, useRef, useState } from 'react';
import { YTP as Y } from '@/lib/yt';

export const r3 = x => Math.round(x * 1000) / 1000;
export default function GridTimeline({ song, bars, setBars, editable, vocab, onChord, onAdd, onDel, onSplit, onTwin }) {
  const start = bars[0].t, end = bars[bars.length - 1].t + bars[bars.length - 1].dur, dur = end - start, pad = Math.max(2.5, dur * (editable ? 0.2 : 0.4));  // в редакторе фрагменту отдаём больше ширины
  const win0 = Math.max(0, start - pad), win1 = end + pad, winLen = win1 - win0;
  const ref = useRef(null); const [playT, setPlayT] = useState(null); const [playing, setPlaying] = useState(false); const [vdur, setVdur] = useState(0); const [pos, setPos] = useState(0);
  const drag = useRef(null); const [locked, setLocked] = useState(false); const scrubRef = useRef(null); const scrubbing = useRef(false); const seekAt = useRef(0); const lastGesture = useRef(0);  // после перемотки позицию плеера не читаем, пока он не перескочил; lastGesture — чтобы клик после перетаскивания не перематывал
  const scrubT = clientX => { const r = scrubRef.current.getBoundingClientRect(); const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width)); return xToTime(f); };  // клик над тактом N попадает в такт N
  const xOf = t => (t - win0) / winLen * 100;
  // позиция по реальному времени: доля полосы (0..1) <-> секунды в окне win0..win1
  const xToTime = f => win0 + Math.max(0, Math.min(1, f)) * winLen;
  const timeToFrac = tt => Math.max(0, Math.min(1, (tt - win0) / winLen));
  useEffect(() => {
    const id = setInterval(() => { const on = Y.state() === 1 && Y.currentId === song.youtube; setPlaying(on); setPlayT(on ? Y.time() : null); if (Y.currentId === song.youtube && !scrubbing.current && Date.now() - seekAt.current > 800) { setPos(Y.time()); const p = Y.player; const d = p && typeof p.getDuration === 'function' ? p.getDuration() : 0; if (d > 0) setVdur(d); } }, 80);
    return () => clearInterval(id);
  }, [song.youtube]);
  function down(ev, kind, k) {
    ev.preventDefault(); ev.stopPropagation(); ref.current.setPointerCapture && ref.current.setPointerCapture(ev.pointerId);
    drag.current = { kind, k, x0: ev.clientX, bars0: bars.map(b => ({ ...b })) };
  }
  function move(ev) {
    const d = drag.current; if (!d) return;
    const dt = (ev.clientX - d.x0) / ref.current.getBoundingClientRect().width * winLen; const b0 = d.bars0;
    const s0 = b0[0].t, e0 = b0[b0.length - 1].t + b0[b0.length - 1].dur;
    const scale = (f, anchor) => { f = Math.max(0.2 / Math.min(...b0.map(b => b.dur)), f); let t = anchor === 'end' ? e0 - (e0 - s0) * f : s0; setBars(b0.map(b => { const nb = { ...b, t: r3(t), dur: r3(b.dur * f) }; t += b.dur * f; return nb; })); };
    if (d.kind === 'shift') { const sh = Math.max(-b0[0].t, dt); setBars(b0.map(b => ({ ...b, t: r3(b.t + sh) }))); }
    else if (locked) {  // замок: любая граница растягивает все такты вместе
      if (d.kind === 'edge') scale((b0[d.k].t + dt - s0) / (b0[d.k].t - s0), 'start');
      else if (d.kind === 'last') scale((e0 + dt - s0) / (e0 - s0), 'start');
      else if (d.kind === 'first') scale((e0 - Math.max(0, s0 + dt)) / (e0 - s0), 'end');
    }
    else if (d.kind === 'edge') {  // граница между тактами k-1 и k
      const k = d.k, x = Math.min(Math.max(b0[k].t + dt, b0[k - 1].t + 0.2), b0[k].t + b0[k].dur - 0.2);
      setBars(b0.map((b, i) => i === k - 1 ? { ...b, dur: r3(x - b.t) } : i === k ? { ...b, t: r3(x), dur: r3(b.t + b.dur - x) } : b));
    } else if (d.kind === 'last') { const k = b0.length - 1; setBars(b0.map((b, i) => i === k ? { ...b, dur: r3(Math.max(0.2, b.dur + dt)) } : b)); }
    else if (d.kind === 'first') { const x = Math.min(Math.max(0, b0[0].t + dt), b0[0].t + b0[0].dur - 0.2); setBars(b0.map((b, i) => i === 0 ? { ...b, t: r3(x), dur: r3(b.t + b.dur - x) } : b)); }
  }
  function up() { if (drag.current) lastGesture.current = Date.now(); drag.current = null; }  // пометка: только что было перетаскивание — следующий click не должен перематывать
  const ticks = []; for (let t = Math.ceil(win0); t <= win1; t++) ticks.push(t);
  const fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  const beats = bars.reduce((a, b) => a + b.beats, 0), bpm = beats * 60 / dur;
  const total = vdur || Math.max(win1 + 30, end + 30);
  const goTo = t => { seekAt.current = Date.now(); setPos(t); Y.playRange(song.youtube, Math.max(0, t), total); };  // перемотка: играть отсюда до конца записи
  const fmt2 = t => fmt(t) + '.' + Math.floor((t % 1) * 10);
  const playBtn = <button className="btn quiet mini gtl-playfrag" onClick={() => { if (playing) Y.pause(); else Y.playRange(song.youtube, start, end); }} data-tip="From the first bar to the end of the last">{playing ? '❚❚ Pause' : '▶ Play fragment'}</button>;
  const lockBtn = <button className={'btn quiet mini gtl-lock' + (locked ? ' on' : '')} onClick={() => setLocked(v => !v)} aria-label={locked ? 'Locked' : 'Unlocked'} data-tip={locked ? 'Locked: borders stretch all bars together' : 'Unlocked: each border moves only the neighbouring bars'}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d={locked ? 'M8 11V7a4 4 0 0 1 8 0v4' : 'M8 11V7a4 4 0 0 1 7.5-2'} /></svg></button>;
  const nb = bars.filter(b => b.barStart !== false).length, taktov = n => n === 1 ? 'bar' : 'bars';
  const meta = <span className="gtl-meta">{nb} {taktov(nb)} · {start.toFixed(2)}–{end.toFixed(2)} s · {bpm.toFixed(1)} bpm</span>;
  return (
    <div className={'gtl' + (editable ? ' editing' : '')}>
      {!editable && <div className="gtl-tools">{playBtn}{lockBtn}{meta}</div>}
      {editable && (
        <div className="gtl-transport">
          {playBtn}
          <span className="gtl-time">{fmt2(pos)}</span>
          <span style={{ flex: 1 }} />
          {lockBtn}
        </div>
      )}
      {editable && (  /* полоса позиции в той же шкале, что полоса тактов: клик над тактом — играть с этого места */
        <div className="gtl-scrub" ref={scrubRef} onPointerDown={ev => { ev.preventDefault(); scrubRef.current.setPointerCapture(ev.pointerId); scrubbing.current = true; const t = scrubT(ev.clientX); setPos(t); goTo(t); }}
          onPointerMove={ev => { if (!scrubbing.current) return; setPos(scrubT(ev.clientX)); }} onPointerUp={ev => { if (!scrubbing.current) return; scrubbing.current = false; goTo(scrubT(ev.clientX)); }} onPointerCancel={() => { scrubbing.current = false; }}
          role="slider" aria-label="Playback position" aria-valuemin={Math.round(win0)} aria-valuemax={Math.round(win1)} aria-valuenow={Math.round(pos)}>
          <div className="gtl-scrub-fill" style={{ width: timeToFrac(pos) * 100 + '%' }} />
          <div className="gtl-scrub-knob" style={{ left: timeToFrac(pos) * 100 + '%' }} />
        </div>
      )}
      <div className={'gtl-strip' + (editable ? ' seekable' : '')} ref={ref} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={ev => { if (Date.now() - lastGesture.current < 350) return; if (editable && ev.target === ref.current) { const r = ref.current.getBoundingClientRect(); goTo(xToTime(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)))); } }} title={editable ? 'Click an empty spot to play from there' : undefined}>
        {!editable && ticks.map(t => <span key={t} className={'gtl-tick' + (t % 5 === 0 ? ' major' : '')} style={{ left: xOf(t) + '%' }}>{t % 5 === 0 ? <em>{fmt(t)}</em> : null}</span>)}
        <div className={'gtl-grid' + (editable ? ' editable' : '')} style={{ left: xOf(start) + '%', width: (dur / winLen * 100) + '%' }} onPointerDown={ev => down(ev, 'shift')} title="Drag to move all bars">
          {bars.map((b, k) => (
            <i key={k} className={'gtl-bar' + (b.barStart === false ? ' sub' : '')} style={{ left: ((b.t - start) / dur * 100) + '%', width: (b.dur / dur * 100) + '%' }}>
              <b>{b.barStart === false ? '' : b.n}</b>
              {editable && (
                <span className="gtl-cell-tools" onPointerDown={ev => ev.stopPropagation()}>
                  <select className="gtl-chord" value={b.c} onChange={e => onChord(k, e.target.value)} title="Degree">
                    {!vocab.includes(b.c) && <option value={b.c}>{b.c}</option>}
                    {vocab.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <button type="button" className="gtl-ic gtl-play" onClick={() => Y.playRange(song.youtube, b.t, b.t + b.dur)} data-tip="Listen"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg></button>
                  <button type="button" className="gtl-ic gtl-del" onClick={() => onDel(k)} data-tip={b.barStart === false ? 'Remove this chord' : 'Delete bar'} disabled={bars.length <= 1}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                  {b.beats >= 1 && <button type="button" className="gtl-ic gtl-split" onClick={() => onSplit(k)} data-tip="Split: another chord in the bar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v16" strokeDasharray="3 3" /><path d="M8 8l-4 4 4 4M16 8l4 4-4 4" /></svg></button>}
                  {b.beats >= 1 && <button type="button" className="gtl-ic gtl-twin" onClick={() => onTwin(k)} data-tip="Split into two bars"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="7" height="10" rx="1" /><rect x="14" y="7" width="7" height="10" rx="1" /></svg></button>}
                  <button type="button" className="gtl-ic gtl-add" onClick={() => onAdd(k)} data-tip="Add a bar after"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
                </span>
              )}
              {k > 0 && <u className="gtl-edge" onPointerDown={ev => down(ev, 'edge', k)} title="Drag the bar border" />}
            </i>
          ))}
        </div>
        <div className="gtl-handle left" style={{ left: xOf(start) + '%' }} onPointerDown={ev => down(ev, 'first')} title="Drag to change the start of the first bar" />
        <div className="gtl-handle" style={{ left: xOf(end) + '%' }} onPointerDown={ev => down(ev, 'last')} title="Drag to change the length of the last bar" />
        {playT != null && playT >= start && playT <= end && <div className="gtl-head" style={{ left: xOf(playT) + '%' }} />}
      </div>
    </div>
  );
}
