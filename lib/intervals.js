/* Интервалы: каждая группа только своими интервалами, в конце все вместе; у каждой группы четыре задачи (вверх, вниз, гармонически, смешанно). Без DOM. */
(function (root) {
  'use strict';
  const INTERVALS = [
    { semis: 1, label: 'м2', disp: 'm2', name: 'minor second', num: 2, q: 'm' }, { semis: 2, label: 'б2', disp: 'M2', name: 'major second', num: 2, q: 'M' },
    { semis: 3, label: 'м3', disp: 'm3', name: 'minor third', num: 3, q: 'm' }, { semis: 4, label: 'б3', disp: 'M3', name: 'major third', num: 3, q: 'M' },
    { semis: 5, label: 'ч4', disp: 'P4', name: 'perfect fourth', num: 4, q: 'P' }, { semis: 6, label: 'тритон', disp: 'TT', name: 'tritone', num: 4, q: 'A' },
    { semis: 7, label: 'ч5', disp: 'P5', name: 'perfect fifth', num: 5, q: 'P' }, { semis: 8, label: 'м6', disp: 'm6', name: 'minor sixth', num: 6, q: 'm' },
    { semis: 9, label: 'б6', disp: 'M6', name: 'major sixth', num: 6, q: 'M' }, { semis: 10, label: 'м7', disp: 'm7', name: 'minor seventh', num: 7, q: 'm' },
    { semis: 11, label: 'б7', disp: 'M7', name: 'major seventh', num: 7, q: 'M' }, { semis: 12, label: 'ч8', disp: 'P8', name: 'octave', num: 8, q: 'P' },
  ];
  const GROUPS = [
    { title: 'Seconds', semis: [1, 2], timbres: ['piano'] },
    { title: 'Thirds', semis: [3, 4], timbres: ['piano'] },
    { title: 'Fourth, fifth, tritone', semis: [5, 6, 7], timbres: ['piano', 'epiano'] },
    { title: 'Sixths', semis: [8, 9], timbres: ['piano', 'epiano', 'pluck'] },
    { title: 'Sevenths and octave', semis: [10, 11, 12], timbres: ['piano', 'epiano', 'pluck'] },
    { title: 'All intervals', semis: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], timbres: ['piano', 'epiano', 'organ', 'strings', 'brass', 'pluck', 'flute'] },
  ];
  const DIRS = [['up', 'up', 'low note, then high'], ['down', 'down', 'high note, then low'], ['harm', 'harmonic', 'both notes together'], ['mix', 'mixed', 'up, down or together, shuffled']];
  const LEVELS = [];
  GROUPS.forEach(g => DIRS.forEach(([dir, dname, ddesc]) => LEVELS.push({ title: `${g.title}: ${dname}`, group: g.title, short: dname, desc: `${INTERVALS.filter(i => g.semis.includes(i.semis)).map(i => i.disp).join(', ')} · ${ddesc}`, semis: g.semis, dir, timbres: g.timbres })));
  const byLabel = l => INTERVALS.find(i => i.label === l);
  const bySemis = s => INTERVALS.find(i => i.semis === s);
  const Intervals = { INTERVALS, GROUPS, LEVELS, byLabel, bySemis };
  if (typeof module !== 'undefined' && module.exports) module.exports = Intervals;
  else root.Intervals = Intervals;
})(typeof window !== 'undefined' ? window : globalThis);
