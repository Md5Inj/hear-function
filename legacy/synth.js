/* Синтезатор на Web Audio с набором тембров. Интерфейс движка:
     engine.playNote(preset, midi, t, dur, vel)
     engine.playChord(preset, midis, t, dur, vel)
   Движок создаётся поверх любого BaseAudioContext (в т.ч. OfflineAudioContext),
   поэтому тот же код можно использовать для оффлайн-рендера и тестов.
   Чтобы заменить на сэмплы (SoundFont и т.п.), достаточно реализовать движок с тем же интерфейсом. */
(function (root) {
  'use strict';

  const PRESETS = {
    piano: {
      name: 'Пианино',
      oscs: [{ type: 'triangle', ratio: 1, gain: 0.55 }, { type: 'sine', ratio: 2, gain: 0.22 }, { type: 'sine', ratio: 3, gain: 0.07 }, { type: 'sine', ratio: 4.01, gain: 0.04 }],
      env: { a: 0.004, d: 1.4, s: 0.12, r: 0.25 },
      filter: { freq: 2500, q: 0.6, env: 3500, attack: 0.005, decay: 0.5 },
    },
    epiano: {
      name: 'Электропиано',
      oscs: [{ type: 'sine', ratio: 1, gain: 0.7 }],
      fm: { ratio: 1, index: 2.2, decay: 0.9 },
      env: { a: 0.004, d: 1.6, s: 0.18, r: 0.3 },
      filter: { freq: 3200, q: 0.5 },
      tremolo: { rate: 4.5, depth: 0.12 },
    },
    organ: {
      name: 'Орган',
      oscs: [{ type: 'sine', ratio: 0.5, gain: 0.25 }, { type: 'sine', ratio: 1, gain: 0.4 }, { type: 'sine', ratio: 1.5, gain: 0.12 }, { type: 'sine', ratio: 2, gain: 0.3 }, { type: 'sine', ratio: 3, gain: 0.14 }, { type: 'sine', ratio: 4, gain: 0.1 }],
      env: { a: 0.015, d: 0.05, s: 1, r: 0.07 },
      vibrato: { rate: 6.2, depth: 5 },
    },
    strings: {
      name: 'Струнные',
      oscs: [{ type: 'sawtooth', ratio: 1, gain: 0.22, detune: -9 }, { type: 'sawtooth', ratio: 1, gain: 0.22, detune: 8 }, { type: 'sawtooth', ratio: 1, gain: 0.18, detune: 0 }, { type: 'sawtooth', ratio: 2, gain: 0.06, detune: 4 }],
      env: { a: 0.28, d: 0.3, s: 0.85, r: 0.5 },
      filter: { freq: 1500, q: 0.8, env: 600, attack: 0.3, decay: 0.6 },
      vibrato: { rate: 5.5, depth: 7, delay: 0.3 },
    },
    brass: {
      name: 'Медные',
      oscs: [{ type: 'sawtooth', ratio: 1, gain: 0.42 }, { type: 'square', ratio: 1, gain: 0.08, detune: 6 }],
      env: { a: 0.07, d: 0.25, s: 0.7, r: 0.18 },
      filter: { freq: 800, q: 1.8, env: 2800, attack: 0.09, decay: 0.35 },
    },
    pluck: {
      name: 'Щипок (гитара)',
      oscs: [{ type: 'square', ratio: 1, gain: 0.22 }, { type: 'triangle', ratio: 1, gain: 0.35 }, { type: 'sine', ratio: 2, gain: 0.1 }],
      env: { a: 0.002, d: 0.7, s: 0.0, r: 0.1 },
      filter: { freq: 500, q: 1.2, env: 4500, attack: 0.002, decay: 0.22 },
    },
    flute: {
      name: 'Флейта',
      oscs: [{ type: 'sine', ratio: 1, gain: 0.6 }, { type: 'triangle', ratio: 1, gain: 0.12 }, { type: 'sine', ratio: 3, gain: 0.05 }],
      env: { a: 0.07, d: 0.15, s: 0.8, r: 0.15 },
      filter: { freq: 2200, q: 0.5 },
      vibrato: { rate: 5.2, depth: 9, delay: 0.15 },
    },
  };

  const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);

  function createEngine(ctx) {
    const master = ctx.createGain();
    master.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);

    function playNote(presetId, midi, t, dur, vel) {
      const p = PRESETS[presetId] || PRESETS.piano;
      vel = vel == null ? 0.3 : vel;
      const hz = midiToHz(midi);
      const env = p.env;
      const end = t + dur;
      const stopAt = end + env.r + 0.05;

      const voice = ctx.createGain();
      voice.gain.setValueAtTime(0.0001, t);
      voice.gain.exponentialRampToValueAtTime(vel, t + env.a);
      const sus = Math.max(vel * env.s, 0.0001);
      voice.gain.setTargetAtTime(sus, t + env.a, env.d / 3);
      voice.gain.setTargetAtTime(0.0001, end, env.r / 3);

      let out = voice;
      if (p.filter) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.Q.value = p.filter.q || 0.7;
        const base = Math.min(p.filter.freq, ctx.sampleRate / 2 - 100);
        if (p.filter.env) {
          const peak = Math.min(base + p.filter.env, ctx.sampleRate / 2 - 100);
          f.frequency.setValueAtTime(p.filter.attack ? base : peak, t);
          f.frequency.linearRampToValueAtTime(peak, t + (p.filter.attack || 0.001));
          f.frequency.setTargetAtTime(base, t + (p.filter.attack || 0.001), (p.filter.decay || 0.3) / 3);
        } else f.frequency.value = base;
        f.connect(voice); out = f;
      }
      voice.connect(master);

      const nodes = [];
      let lfo = null;
      if (p.vibrato) {
        lfo = ctx.createOscillator(); lfo.frequency.value = p.vibrato.rate;
        const lg = ctx.createGain();
        const d0 = p.vibrato.delay || 0;
        lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(p.vibrato.depth, t + d0 + 0.4);
        lfo.connect(lg); lfo.start(t); lfo.stop(stopAt); nodes.push(lg);
        lfo._gainNode = lg;
      }
      if (p.tremolo) {
        const tl = ctx.createOscillator(); tl.frequency.value = p.tremolo.rate;
        const tg = ctx.createGain(); tg.gain.value = p.tremolo.depth * vel;
        tl.connect(tg); tg.connect(voice.gain); tl.start(t); tl.stop(stopAt);
      }
      for (const o of p.oscs) {
        const osc = ctx.createOscillator();
        osc.type = o.type; osc.frequency.value = hz * o.ratio; osc.detune.value = o.detune || 0;
        const g = ctx.createGain(); g.gain.value = o.gain;
        osc.connect(g); g.connect(out);
        if (lfo) lfo._gainNode.connect(osc.detune);
        if (p.fm && o.ratio === 1) {
          const mod = ctx.createOscillator(); mod.frequency.value = hz * p.fm.ratio;
          const mg = ctx.createGain();
          mg.gain.setValueAtTime(hz * p.fm.index, t);
          mg.gain.setTargetAtTime(hz * p.fm.index * 0.15, t, p.fm.decay / 3);
          mod.connect(mg); mg.connect(osc.frequency); mod.start(t); mod.stop(stopAt);
        }
        osc.start(t); osc.stop(stopAt);
      }
    }

    function playChord(presetId, midis, t, dur, vel) {
      vel = vel == null ? 0.26 : vel;
      midis.forEach((m, i) => playNote(presetId, m, t + i * 0.004, dur, i === 0 ? vel * 1.1 : vel));
    }

    return { ctx, master, playNote, playChord };
  }

  /* Оффлайн-рендер для проверки слышимости: возвращает RMS буфера. */
  function renderRms(presetId, midis, dur) {
    const sr = 22050;
    const off = new (root.OfflineAudioContext || root.webkitOfflineAudioContext)(1, Math.ceil(sr * (dur + 0.5)), sr);
    const eng = createEngine(off);
    eng.playChord(presetId, midis, 0.05, dur);
    return off.startRendering().then(buf => {
      const d = buf.getChannelData(0);
      let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
      return Math.sqrt(s / d.length);
    });
  }

  root.Synth = { PRESETS, createEngine, renderRms, midiToHz };
})(typeof window !== 'undefined' ? window : globalThis);
