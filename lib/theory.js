/* Теоретический движок: лады, ступени, аккорды по римским цифрам, голосоведение.
   Без DOM — работает и в браузере (window.Theory), и в Node (module.exports). */
(function (root) {
  'use strict';

  const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

  const QUALITIES = {
    maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
    dom7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10],
    m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9], sus4: [0, 5, 7], sus2: [0, 2, 7],
  };
  const QUALITY_LETTER = {
    maj: '', min: 'm', dim: '°', aug: '+', dom7: '7', maj7: 'maj7', min7: 'm7',
    m7b5: 'ø7', dim7: '°7', sus4: 'sus4', sus2: 'sus2',
  };

  // Словарь аккордов относительно тоники. root — полутоны от тоники.
  const CHORDS = {
    major: {
      // диатоника
      'I': { root: 0, q: 'maj' }, 'ii': { root: 2, q: 'min' }, 'iii': { root: 4, q: 'min' },
      'IV': { root: 5, q: 'maj' }, 'V': { root: 7, q: 'maj' }, 'vi': { root: 9, q: 'min' }, 'vii°': { root: 11, q: 'dim' },
      // септаккорды
      'Imaj7': { root: 0, q: 'maj7' }, 'ii7': { root: 2, q: 'min7' }, 'iii7': { root: 4, q: 'min7' },
      'IVmaj7': { root: 5, q: 'maj7' }, 'V7': { root: 7, q: 'dom7' }, 'vi7': { root: 9, q: 'min7' }, 'viiø7': { root: 11, q: 'm7b5' },
      'Vsus4': { root: 7, q: 'sus4' }, 'I7': { root: 0, q: 'dom7' }, 'IV7': { root: 5, q: 'dom7' }, 'i': { root: 0, q: 'min' },
      // побочные доминанты
      'V/ii': { root: 9, q: 'dom7' }, 'V/iii': { root: 11, q: 'dom7' }, 'V/IV': { root: 0, q: 'dom7' },
      'V/V': { root: 2, q: 'dom7' }, 'V/vi': { root: 4, q: 'dom7' },
      // заимствованные из одноимённого минора и пр.
      'iv': { root: 5, q: 'min' }, '♭III': { root: 3, q: 'maj' }, '♭VI': { root: 8, q: 'maj' }, '♭VII': { root: 10, q: 'maj' },
      'ii°': { root: 2, q: 'dim' }, 'vii°7': { root: 11, q: 'dim7' }, 'N': { root: 1, q: 'maj' },
    },
    minor: {
      // диатоника натурального минора + гармонические V и vii°
      'i': { root: 0, q: 'min' }, 'ii°': { root: 2, q: 'dim' }, 'III': { root: 3, q: 'maj' }, 'iv': { root: 5, q: 'min' },
      'v': { root: 7, q: 'min' }, 'V': { root: 7, q: 'maj' }, 'VI': { root: 8, q: 'maj' }, 'VII': { root: 10, q: 'maj' }, 'vii°': { root: 11, q: 'dim' },
      // септаккорды
      'i7': { root: 0, q: 'min7' }, 'iiø7': { root: 2, q: 'm7b5' }, 'IIImaj7': { root: 3, q: 'maj7' }, 'iv7': { root: 5, q: 'min7' },
      'v7': { root: 7, q: 'min7' }, 'V7': { root: 7, q: 'dom7' }, 'VImaj7': { root: 8, q: 'maj7' }, 'VII7': { root: 10, q: 'dom7' }, 'vii°7': { root: 11, q: 'dim7' },
      // дорийские
      'IV': { root: 5, q: 'maj' }, 'ii': { root: 2, q: 'min' },
      // побочные доминанты, неаполитанский, пикардийская терция
      'V/iv': { root: 0, q: 'dom7' }, 'V/V': { root: 2, q: 'dom7' }, 'V/VI': { root: 3, q: 'dom7' }, 'V/III': { root: 10, q: 'dom7' },
      'N': { root: 1, q: 'maj' }, 'I': { root: 0, q: 'maj' },
    },
  };

  // Ступени: label — как показываем, st — полутоны от тоники.
  const DEGREES = {
    major: [
      { label: '1', st: 0 }, { label: '♭2', st: 1 }, { label: '2', st: 2 }, { label: '♭3', st: 3 }, { label: '3', st: 4 },
      { label: '4', st: 5 }, { label: '♯4', st: 6 }, { label: '5', st: 7 }, { label: '♭6', st: 8 }, { label: '6', st: 9 },
      { label: '♭7', st: 10 }, { label: '7', st: 11 },
    ],
    minor: [
      { label: '1', st: 0 }, { label: '♭2', st: 1 }, { label: '2', st: 2 }, { label: '♭3', st: 3 }, { label: '♮3', st: 4 },
      { label: '4', st: 5 }, { label: '♯4', st: 6 }, { label: '5', st: 7 }, { label: '♭6', st: 8 }, { label: '♮6', st: 9 },
      { label: '♭7', st: 10 }, { label: '♮7', st: 11 },
    ],
  };

  const CADENCE = { major: ['I', 'IV', 'V', 'I'], minor: ['i', 'iv', 'V', 'i'] };
  const INV_FIGURES = { 3: ['', '⁶', '⁶₄'], 4: ['', '⁶₅', '⁴₃', '²'] };

  function parseToken(token) {
    const m = /^(.+?)(?::([0-3]))?$/.exec(token);
    if (!m) throw new Error('Bad chord token: ' + token);
    return { symbol: m[1], inversion: m[2] ? +m[2] : 0 };
  }

  function chordDef(mode, token) {
    const { symbol, inversion } = parseToken(token);
    const def = CHORDS[mode] && CHORDS[mode][symbol];
    if (!def) throw new Error('Unknown chord ' + symbol + ' in ' + mode);
    const intervals = QUALITIES[def.q];
    if (inversion >= intervals.length) throw new Error('Bad inversion for ' + token);
    const pcs = intervals.map(i => (def.root + i) % 12);
    return {
      token, symbol, inversion, root: def.root, quality: def.q, intervals, pcs,
      bassRel: pcs[inversion],
    };
  }

  function displayToken(token) {
    const { symbol, inversion } = parseToken(token);
    if (!inversion) return symbol;
    const size = /7|ø/.test(symbol) ? 4 : 3;
    return symbol + INV_FIGURES[size][inversion];
  }

  function letterName(mode, token, tonicPc) {
    const d = chordDef(mode, token);
    let name = NOTE_NAMES[(tonicPc + d.root) % 12] + QUALITY_LETTER[d.quality];
    if (d.inversion) name += '/' + NOTE_NAMES[(tonicPc + d.bassRel) % 12];
    return name;
  }

  function keyName(mode, tonicPc) {
    return NOTE_NAMES[tonicPc] + (mode === 'major' ? ' major' : ' minor');
  }

  function tonicMidi(tonicPc) {
    // тоника в диапазоне 55..66 (G3..F♯4)
    return 60 + tonicPc - (tonicPc > 6 ? 12 : 0);
  }

  function combinations(arr, k) {
    const res = [];
    (function rec(start, acc) {
      if (acc.length === k) { res.push(acc.slice()); return; }
      for (let i = start; i < arr.length; i++) { acc.push(arr[i]); rec(i + 1, acc); acc.pop(); }
    })(0, []);
    return res;
  }

  /* Голосоведение: бас = басовый тон аккорда в октаве E2..E3,
     четыре верхних голоса в G3..A5, минимальное суммарное движение между аккордами. */
  function voiceLead(tokens, mode, tonicPc) {
    const LOW = 55, HIGH = 81, N = 4;
    let prevUpper = null, prevBass = null;
    return tokens.map(token => {
      const d = chordDef(mode, token);
      const pcs = d.pcs.map(p => (p + tonicPc) % 12);
      const rootPc = (d.root + tonicPc) % 12;
      const bassPc = (d.bassRel + tonicPc) % 12;

      const bassCands = [];
      for (let m = 40; m <= 52; m++) if (m % 12 === bassPc) bassCands.push(m);
      const bassTarget = prevBass == null ? 45 : prevBass;
      const bass = bassCands.reduce((a, b) => Math.abs(b - bassTarget) < Math.abs(a - bassTarget) ? b : a);

      const pitches = [];
      for (let m = LOW; m <= HIGH; m++) if (pcs.includes(m % 12)) pitches.push(m);
      const uniq = new Set(pcs).size;
      let best = null, bestCost = Infinity;
      for (const combo of combinations(pitches, N)) {
        if (new Set(combo.map(m => m % 12)).size < uniq) continue;
        let cost = 0;
        for (let i = 1; i < N; i++) { const gap = combo[i] - combo[i - 1]; if (gap > 12) cost += (gap - 12) * 2; }
        if (combo[N - 1] > 79) cost += 3;
        if (uniq === 3 && combo.filter(m => m % 12 === rootPc).length < 2) cost += 1.5;
        if (prevUpper) {
          for (let i = 0; i < N; i++) cost += Math.abs(combo[i] - prevUpper[i]);
        } else {
          const mean = combo.reduce((a, b) => a + b, 0) / N;
          cost += Math.abs(mean - 67) * 1.5 + (combo[N - 1] - combo[0]) * 0.5;
        }
        if (cost < bestCost) { bestCost = cost; best = combo; }
      }
      prevUpper = best; prevBass = bass;
      return { token, bass, upper: best, notes: [bass].concat(best) };
    });
  }

  function degreeByLabel(mode, label) {
    return DEGREES[mode].find(d => d.label === label);
  }

  /* аккорды по порядку ступеней (I, ii, iii, IV, V, vi, vii) — по высоте основного тона от тоники; равные остаются в исходном порядке */
  function sortByDegree(mode, syms) {
    const rootOf = s => { try { return chordDef(mode, s).root; } catch (e) { return 99; } };
    return syms.map((s, i) => [rootOf(s), i, s]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
  }

  const Theory = {
    NOTE_NAMES, SCALES, QUALITIES, CHORDS, DEGREES, CADENCE,
    parseToken, chordDef, displayToken, letterName, keyName, tonicMidi, voiceLead, degreeByLabel, sortByDegree,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Theory;
  else root.Theory = Theory;
})(typeof window !== 'undefined' ? window : globalThis);
