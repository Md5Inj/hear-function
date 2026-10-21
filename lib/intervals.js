/* Интервалы: каждая группа только своими интервалами, в конце все вместе; у каждой группы четыре задачи (вверх, вниз, гармонически, смешанно). Без DOM. */
(function (root) {
  'use strict';
  const INTERVALS = [
    { semis: 1, label: 'м2', name: 'малая секунда', num: 2, q: 'm' }, { semis: 2, label: 'б2', name: 'большая секунда', num: 2, q: 'M' },
    { semis: 3, label: 'м3', name: 'малая терция', num: 3, q: 'm' }, { semis: 4, label: 'б3', name: 'большая терция', num: 3, q: 'M' },
    { semis: 5, label: 'ч4', name: 'чистая кварта', num: 4, q: 'P' }, { semis: 6, label: 'тритон', name: 'тритон', num: 4, q: 'A' },
    { semis: 7, label: 'ч5', name: 'чистая квинта', num: 5, q: 'P' }, { semis: 8, label: 'м6', name: 'малая секста', num: 6, q: 'm' },
    { semis: 9, label: 'б6', name: 'большая секста', num: 6, q: 'M' }, { semis: 10, label: 'м7', name: 'малая септима', num: 7, q: 'm' },
    { semis: 11, label: 'б7', name: 'большая септима', num: 7, q: 'M' }, { semis: 12, label: 'ч8', name: 'октава', num: 8, q: 'P' },
  ];
  const GROUPS = [
    { title: 'Секунды', semis: [1, 2], timbres: ['piano'] },
    { title: 'Терции', semis: [3, 4], timbres: ['piano'] },
    { title: 'Кварта, квинта, тритон', semis: [5, 6, 7], timbres: ['piano', 'epiano'] },
    { title: 'Сексты', semis: [8, 9], timbres: ['piano', 'epiano', 'pluck'] },
    { title: 'Септимы и октава', semis: [10, 11, 12], timbres: ['piano', 'epiano', 'pluck'] },
    { title: 'Все интервалы', semis: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], timbres: ['piano', 'epiano', 'organ', 'strings', 'brass', 'pluck', 'flute'] },
  ];
  const DIRS = [['up', 'вверх', 'нижняя нота, затем верхняя'], ['down', 'вниз', 'верхняя нота, затем нижняя'], ['harm', 'гармонически', 'обе ноты одновременно'], ['mix', 'смешанно', 'вверх, вниз или вместе, вразнобой']];
  const LEVELS = [];
  GROUPS.forEach(g => DIRS.forEach(([dir, dname, ddesc]) => LEVELS.push({ title: `${g.title}: ${dname}`, group: g.title, short: dname, desc: `${INTERVALS.filter(i => g.semis.includes(i.semis)).map(i => i.label).join(', ')} · ${ddesc}`, semis: g.semis, dir, timbres: g.timbres })));
  const byLabel = l => INTERVALS.find(i => i.label === l);
  const bySemis = s => INTERVALS.find(i => i.semis === s);
  const Intervals = { INTERVALS, GROUPS, LEVELS, byLabel, bySemis };
  if (typeof module !== 'undefined' && module.exports) module.exports = Intervals;
  else root.Intervals = Intervals;
})(typeof window !== 'undefined' ? window : globalThis);
