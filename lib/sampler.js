/* Сэмплы настоящих инструментов (General MIDI, FluidR3) с нашего сервера (/samples, см. tools/fetch-samples.js)
   поверх интерфейса синтезатора: playNote(preset, midi, t, dur, vel), playChord(preset, midis, t, dur, vel), warm(preset).
   Инструмент грузится целиком при первом обращении; каждый сэмпл нормализуется по пику; на выходе компрессор.
   Если нота к моменту воспроизведения ещё не пришла, звук ждёт её; синтез остаётся только если файл не загрузился. */
import Synth from './synth';

const GM = { piano: 'acoustic_grand_piano', epiano: 'electric_piano_1', organ: 'drawbar_organ', strings: 'string_ensemble_1', brass: 'brass_section', pluck: 'acoustic_guitar_nylon', flute: 'flute' };
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const LO = 33, HI = 96;
const noteName = midi => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
const SUSTAINED = { organ: true, strings: true, brass: true, flute: true };

export function createSampledEngine(ctx) {
  const buffers = new Map(); const pending = new Map(); const warmed = new Map();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 20; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  const master = ctx.createGain(); master.gain.value = 1.3; master.connect(comp); comp.connect(ctx.destination);
  /* Шина текущего звучания: stopAll() глушит её вместе со всеми уже запланированными нотами и заводит новую.
     У синтеза своя шина (master движка), поэтому вместе с шиной пересоздаётся и движок синтеза. */
  let bus, synth;
  function newBus() { bus = ctx.createGain(); bus.connect(master); synth = Synth.createEngine(ctx); }
  newBus();
  function stopAll() {
    const t = ctx.currentTime, ob = bus, os = synth;
    for (const g of [ob.gain, os.master.gain]) { try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.03); } catch (e) { /* узел уже отключён */ } }
    setTimeout(() => { try { ob.disconnect(); os.master.disconnect(); if (os.comp) os.comp.disconnect(); } catch (e) { /* уже отключён */ } }, 120);
    newBus();
  }
  function normalize(buf) {
    let peak = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; } }
    if (peak > 0 && peak < 0.9) { const k = 0.9 / peak; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } }
    return buf;
  }
  function load(preset, midi) {
    const instr = GM[preset]; if (!instr || midi < LO || midi > HI) return Promise.resolve(null);
    const key = instr + ':' + midi;
    if (buffers.has(key)) return Promise.resolve(buffers.get(key));
    if (pending.has(key)) return pending.get(key);
    const p = fetch(`/samples/${instr}/${noteName(midi)}.mp3`).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(ab => ctx.decodeAudioData(ab)).then(buf => { buffers.set(key, normalize(buf)); pending.delete(key); return buffers.get(key); })
      .catch(() => { buffers.set(key, null); pending.delete(key); return null; });
    pending.set(key, p); return p;
  }
  /* весь инструмент разом (кэшируется); midis не обязательны — для совместимости */
  function warm(preset) {
    const instr = GM[preset]; if (!instr) return Promise.resolve();
    if (!warmed.has(instr)) { const all = []; for (let m = LO; m <= HI; m++) all.push(load(preset, m)); warmed.set(instr, Promise.all(all)); }
    return warmed.get(instr);
  }
  function start(preset, buf, t, dur, v, b) {
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006);
    const rel = SUSTAINED[preset] ? 0.12 : 0.35; const end = t + dur;
    g.gain.setValueAtTime(v, Math.max(t + 0.006, end - 0.01)); g.gain.exponentialRampToValueAtTime(0.0008, end + rel);
    src.connect(g); g.connect(b || bus); src.start(t); src.stop(end + rel + 0.05);
  }
  function playNote(preset, midi, t, dur, vel) {
    if (ctx.state === 'suspended') ctx.resume();
    const v = vel == null ? 0.7 : vel; const instr = GM[preset]; const key = instr + ':' + midi; const b = bus, sy = synth;
    if (!instr) return sy.playNote(preset, midi, t, dur, vel);
    if (buffers.has(key)) { const buf = buffers.get(key); return buf ? start(preset, buf, t, dur, v, b) : sy.playNote(preset, midi, t, dur, vel); }
    // сэмпл ещё грузится: ждём его, сдвигая старт не раньше момента загрузки (а не подменяем тембр)
    const offset = t - ctx.currentTime;
    load(preset, midi).then(buf => { if (b !== bus) return;  // пока грузилось, звук остановили
      const t2 = Math.max(ctx.currentTime + 0.02, ctx.currentTime + offset); if (buf) start(preset, buf, t2, dur, v, b); else sy.playNote(preset, midi, t2, dur, vel); });
  }
  function playChord(preset, midis, t, dur, vel) { const v = (vel == null ? 0.7 : vel) / Math.pow(midis.length, 0.35); midis.forEach(m => playNote(preset, m, t, dur, v)); }
  return { ctx, playNote, playChord, warm, stopAll, loaded: (preset, midi) => !!(GM[preset] && buffers.get(GM[preset] + ':' + midi)) };
}
