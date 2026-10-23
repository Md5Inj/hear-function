'use client';
/* Таблица тактов под полосой времени: ступень, начало, длина, прослушать, добавить такт, удалить.
   bars: [{ c, beats, t, dur, n, barStart }] — тактовые единицы с явными временами. */
import SB from '@/lib/songs-db';
import T from '@/lib/theory';
import { YTP as Y } from '@/lib/yt';
import { r3 } from './GridTimeline';

/* Нормализация песни в такты с явными временами и порядковыми номерами */
export function toBars(song) {
  const units = SB.barUnits(song); let n = 0;
  return units.map(u => ({ c: u.c, beats: u.beats, t: u.t0, dur: r3(u.t1 - u.t0), barStart: u.barStart, n: u.barStart ? ++n : n }));
}
/* Такты обратно в документ песни: аккорды с t и dur, начало, конец, средний темп, уровень */
export function fromBars(song, bars) {
  const chords = bars.map(b => ({ c: b.c, beats: b.beats, t: r3(b.t), dur: r3(b.dur) }));
  const start = chords[0].t, end = r3(chords[chords.length - 1].t + chords[chords.length - 1].dur), beats = bars.reduce((a, b) => a + b.beats, 0);
  const doc = Object.assign({}, song, { chords, start, end, bpm: Math.round(beats * 60 / (end - start) * 10) / 10 });
  doc.level = SB.levelFor(doc) || doc.level;
  return doc;
}
const renumber = bars => { let n = 0; return bars.map(b => ({ ...b, n: b.barStart ? ++n : n })); };

/* Операции над тактами, общие для полосы времени и таблицы точных значений */
export function barOps(song, bars, setBars) {
  const mode = song.key.mode, bpb = song.beatsPerBar || 4;
  const levels = SB.SONG_LEVELS[mode]; const vocab = T.sortByDegree(mode, levels[levels.length - 1].vocab);
  const setT = (k, t) => { t = Math.max(0, +t || 0); setBars(bars.map((b, i) => i === k - 1 ? { ...b, dur: r3(Math.max(0.1, t - b.t)) } : i === k ? { ...b, t: r3(t), dur: r3(Math.max(0.1, b.t + b.dur - t)) } : b)); };
  const setDur = (k, dur) => { dur = Math.max(0.1, +dur || 0); const delta = dur - bars[k].dur; setBars(bars.map((b, i) => i === k ? { ...b, dur: r3(dur) } : i > k ? { ...b, t: r3(b.t + delta) } : b)); };
  const setC = (k, c) => setBars(bars.map((b, i) => i === k ? { ...b, c } : b));
  const add = k => { const b = bars[k]; const nb = { c: b.c, beats: bpb, t: r3(b.t + b.dur), dur: b.dur, barStart: true }; setBars(renumber([...bars.slice(0, k + 1), nb, ...bars.slice(k + 1).map(x => ({ ...x, t: r3(x.t + b.dur) }))])); };
  /* удалить: часть такта отдаёт время соседней части того же такта; целый такт — следующие сдвигаются назад */
  const del = k => {
    if (bars.length <= 1) return; const b = bars[k]; const prevSame = k > 0 && b.barStart === false, nextSame = k + 1 < bars.length && bars[k + 1].barStart === false;
    if (prevSame) return setBars(renumber(bars.flatMap((x, i) => i === k - 1 ? [{ ...x, beats: x.beats + b.beats, dur: r3(x.dur + b.dur) }] : i === k ? [] : [x])));
    if (nextSame) return setBars(renumber(bars.flatMap((x, i) => i === k + 1 ? [{ ...x, t: b.t, beats: x.beats + b.beats, dur: r3(x.dur + b.dur), barStart: true }] : i === k ? [] : [x])));
    setBars(renumber([...bars.slice(0, k), ...bars.slice(k + 1).map(x => ({ ...x, t: r3(x.t - b.dur) }))]));
  };
  /* разделить: ещё один аккорд в такте — единица делится пополам, вторая половина с тем же аккордом (внутри одного такта) */
  const split = k => { const b = bars[k]; if (b.beats < 1) return; const h = b.beats / 2, d = r3(b.dur / 2); setBars(renumber(bars.flatMap((x, i) => i === k ? [{ ...x, beats: h, dur: d }, { ...x, t: r3(x.t + d), beats: h, dur: r3(x.dur - d), barStart: false }] : [x]))); };
  /* разделить на два такта: такт делится пополам, но обе половины становятся полноценными тактами с тем же аккордом */
  const twin = k => { const b = bars[k]; if (b.beats < 1) return; const h = b.beats / 2, d = r3(b.dur / 2); setBars(renumber(bars.flatMap((x, i) => i === k ? [{ ...x, beats: h, dur: d, barStart: true }, { ...x, t: r3(x.t + d), beats: h, dur: r3(x.dur - d), barStart: true }] : [x]))); };
  return { vocab, bpb, setT, setDur, setC, add, del, split, twin };
}

export default function BarEditor({ song, bars, setBars }) {
  const { vocab, bpb, setT, setDur, setC, add, del, split, twin } = barOps(song, bars, setBars);
  return (
    <table className="bar-editor">
      <thead><tr><th>Bar</th><th>Degree</th><th>Start, s</th><th>Length, s</th><th></th></tr></thead>
      <tbody>
        {bars.map((b, k) => (
          <tr key={k} className={b.barStart === false ? 'sub' : ''}>
            <td className="num">{b.barStart === false ? `${b.n} (${b.beats} of ${bpb} beats)` : b.n}</td>
            <td>
              <select value={b.c} onChange={e => setC(k, e.target.value)}>
                {!vocab.includes(b.c) && <option value={b.c}>{b.c}</option>}
                {vocab.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </td>
            <td><input type="number" step="0.05" value={b.t} onChange={e => setT(k, e.target.value)} /></td>
            <td><input type="number" step="0.05" min="0.1" value={b.dur} onChange={e => setDur(k, e.target.value)} /></td>
            <td className="bar-actions">
              <button className="btn quiet mini" data-tip="Listen to this bar" onClick={() => Y.playRange(song.youtube, b.t, b.t + b.dur)}>▶</button>
              <button className="btn quiet mini" data-tip="Add a bar after this one" onClick={() => add(k)}>+</button>
              <button className="btn quiet mini" data-tip="Another chord in this bar: split in half" onClick={() => split(k)} disabled={b.beats < 1}>÷</button>
              <button className="btn quiet mini" data-tip="Split into two bars" onClick={() => twin(k)} disabled={b.beats < 1}>‖</button>
              <button className="btn quiet mini" data-tip="Delete bar" onClick={() => del(k)} disabled={bars.length <= 1}>✕</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
