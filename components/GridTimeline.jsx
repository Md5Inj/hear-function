'use client';
/* Полоса времени: кусок записи вокруг фрагмента, сетка тактов с аккордами, бегунок.
   Тянуть сетку целиком — сдвиг начала; тянуть последнюю черту — растяжение (темп). */
import { useEffect, useRef, useState } from 'react';
import { YTP as Y } from '@/lib/yt';

export default function GridTimeline({ song, grid, setGrid }) {
  const bpb = song.beatsPerBar || 4;
  const beats = song.chords.reduce((a, c) => a + (c.beats != null ? c.beats : bpb), 0);
  const nBars = beats / bpb, bar = 240 / grid.bpm * (bpb / 4);
  const dur = nBars * bar, pad = Math.max(3, dur * 0.4);
  const win0 = Math.max(0, grid.start - pad), win1 = grid.start + dur + pad, winLen = win1 - win0;
  const ref = useRef(null); const [playT, setPlayT] = useState(null); const [playing, setPlaying] = useState(false);
  const drag = useRef(null);
  const xOf = t => (t - win0) / winLen * 100;
  const tOf = clientX => { const r = ref.current.getBoundingClientRect(); return win0 + (clientX - r.left) / r.width * winLen; };
  useEffect(() => {
    const id = setInterval(() => { const on = Y.state() === 1 && Y.currentId === song.youtube; setPlaying(on); setPlayT(on ? Y.time() : null); }, 80);
    return () => clearInterval(id);
  }, [song.youtube]);
  function down(ev, kind) {
    ev.preventDefault(); ev.currentTarget.setPointerCapture && ref.current.setPointerCapture(ev.pointerId);
    drag.current = { kind, x0: ev.clientX, start0: grid.start, bar0: bar };
  }
  function move(ev) {
    const d = drag.current; if (!d) return;
    const dt = (ev.clientX - d.x0) / ref.current.getBoundingClientRect().width * winLen;
    if (d.kind === 'shift') setGrid({ ...grid, start: Math.max(0, Math.round((d.start0 + dt) * 100) / 100) });
    else { const nb = Math.max(0.3, d.bar0 + dt / nBars); setGrid({ ...grid, bpm: Math.round(240 / nb * (bpb / 4) * 10) / 10 }); }
  }
  function up() { drag.current = null; }
  const ticks = []; for (let t = Math.ceil(win0); t <= win1; t++) ticks.push(t);
  const fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  return (
    <div className="gtl">
      <div className="gtl-tools">
        <button className="btn quiet mini" onClick={() => { if (playing) Y.pause(); else Y.playRange(song.youtube, win0, win1); }}>{playing ? '❚❚ Пауза' : '▶ Играть этот кусок'}</button>
        <span className="muted">{fmt(win0)}–{fmt(win1)} · начало {grid.start.toFixed(2)} с · такт {bar.toFixed(2)} с · {grid.bpm.toFixed(1)} bpm</span>
      </div>
      <div className="gtl-strip" ref={ref} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {ticks.map(t => <span key={t} className={'gtl-tick' + (t % 5 === 0 ? ' major' : '')} style={{ left: xOf(t) + '%' }}>{t % 5 === 0 ? <em>{fmt(t)}</em> : null}</span>)}
        <div className="gtl-grid" style={{ left: xOf(grid.start) + '%', width: (dur / winLen * 100) + '%' }} onPointerDown={ev => down(ev, 'shift')} title="Тяните, чтобы сдвинуть сетку">
          {Array.from({ length: nBars + 1 }, (_, k) => <i key={k} className="gtl-bar" style={{ left: (k / nBars * 100) + '%' }}><b>{k < nBars ? k + 1 : ''}</b></i>)}
        </div>
        <div className="gtl-handle" style={{ left: xOf(grid.start + dur) + '%' }} onPointerDown={ev => { ev.stopPropagation(); down(ev, 'stretch'); }} title="Тяните, чтобы растянуть или сжать такты" />
        {playT != null && playT >= win0 && playT <= win1 && <div className="gtl-head" style={{ left: xOf(playT) + '%' }} />}
      </div>
    </div>
  );
}
