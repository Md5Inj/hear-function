/* Песни для режима «Реальная музыка».
   youtube — ID видео. Разметка по сетке:
     start       — момент первой доли первого такта фрагмента (секунды в видео)
     bpm         — темп; beatsPerBar — долей в такте (по умолчанию 4)
     chords      — [{ c, beats }]: символ аккорда (как в Theory.CHORDS, можно "V:1") и длительность в долях (по умолчанию такт)
   melody — { lyric, start, end, degrees: [...] } — фраза мелодии (секунды) и ступени её нот.
   draft — start и bpm проставлены по памяти, без прослушивания; откалибруйте в редакторе (одно нажатие «первая доля = сейчас»).
   expand(song) считает абсолютные времена аккордов и конец фрагмента. */
(function (root) {
  'use strict';

  /* Лестница уровней: каждый уровень добавляет к словарю один-два аккорда; первые ограничены длиной фрагмента.
     Уровень фрагмента = первый уровень, словарь которого покрывает все его аккорды (с учётом лимита тактов). */
  const LADDER = {
    major: [
      { title: 'Тоника и доминанта', add: ['I', 'V'], maxBars: 4 },
      { title: 'Плюс субдоминанта', add: ['IV'], maxBars: 4 },
      { title: 'Главные трезвучия, до 8 тактов', add: [], maxBars: 8 },
      { title: 'Плюс vi', add: ['vi'] },
      { title: 'Плюс ii', add: ['ii'] },
      { title: 'Плюс iii', add: ['iii'] },
      { title: 'Доминантсептаккорды', add: ['V7', 'I7', 'IV7'] },
      { title: 'Большие и малые септаккорды', add: ['Imaj7', 'IVmaj7', 'ii7', 'vi7', 'iii7'] },
      { title: 'Вводный и задержание', add: ['vii°', 'viiø7', 'Vsus4'] },
      { title: 'Побочные доминанты', add: ['V/V', 'V/ii', 'V/vi', 'V/IV', 'V/iii'] },
      { title: 'Заимствования из минора', add: ['iv', '♭VII', '♭VI', '♭III'] },
      { title: 'Редкая хроматика', add: ['i', 'N', 'ii°', 'vii°7'] },
    ],
    minor: [
      { title: 'Тоника и доминанта', add: ['i', 'V'], maxBars: 4 },
      { title: 'Плюс субдоминанта', add: ['iv'], maxBars: 4 },
      { title: 'Главные трезвучия, до 8 тактов', add: [], maxBars: 8 },
      { title: 'Плюс VI', add: ['VI'] },
      { title: 'Плюс VII', add: ['VII'] },
      { title: 'Плюс III', add: ['III'] },
      { title: 'Минорная доминанта', add: ['v'] },
      { title: 'Вторая ступень', add: ['ii°', 'iiø7'] },
      { title: 'Септаккорды', add: ['V7', 'i7', 'iv7', 'v7'] },
      { title: 'Ещё септаккорды и вводный', add: ['IIImaj7', 'VImaj7', 'VII7', 'vii°', 'vii°7'] },
      { title: 'Дорийские аккорды', add: ['IV', 'ii'] },
      { title: 'Побочные доминанты', add: ['V/iv', 'V/V', 'V/VI', 'V/III'] },
      { title: 'Неаполитанский и пикардийская терция', add: ['N', 'I'] },
    ],
  };
  // SONG_LEVELS: { title, desc, vocab (накопленный), maxBars }
  const SONG_LEVELS = {};
  for (const mode of ['major', 'minor']) {
    let vocab = [];
    SONG_LEVELS[mode] = LADDER[mode].map(l => {
      vocab = vocab.concat(l.add);
      return { title: l.title, desc: l.add.length ? 'Аккорды: ' + vocab.join(', ') + (l.maxBars ? `. До ${l.maxBars} тактов` : '') : `Аккорды: ${vocab.join(', ')}. До ${l.maxBars} тактов`, vocab: vocab.slice(), maxBars: l.maxBars || Infinity };
    });
  }
  function barsOf(s) { const bpb = s.beatsPerBar || 4; return s.chords.reduce((a, c) => a + (c.beats != null ? c.beats : bpb), 0) / bpb; }
  function symbolsOf(s) { return s.chords.map(c => c.c.split(':')[0]); }
  /* Уровень фрагмента по лестнице; null, если аккорды не покрываются даже последним уровнем */
  function levelFor(s) {
    const mode = s.key.mode, syms = symbolsOf(s), bars = barsOf(s);
    const levels = SONG_LEVELS[mode];
    for (let i = 0; i < levels.length; i++) {
      const l = levels[i];
      if (syms.every(x => l.vocab.includes(x)) && bars <= l.maxBars) return i + 1;
    }
    return null;
  }

  function expand(s) {
    const bpb = s.beatsPerBar || 4;
    if (s.chords.length && s.chords[0].t != null) return Object.assign({ end: s.end }, s);
    const beat = 60 / s.bpm;
    let t = s.start;
    const chords = s.chords.map(ch => { const o = { t: +t.toFixed(3), c: ch.c, beats: ch.beats != null ? ch.beats : bpb }; t += o.beats * beat; return o; });
    return Object.assign({}, s, { chords, end: +t.toFixed(3) });
  }

  const bars = (...syms) => syms.map(c => ({ c }));

  const SONGS = [
    { id: 'let-it-be-verse', title: 'Let It Be', artist: 'The Beatles', youtube: 'HzvDofigTKQ', key: { tonic: 0, mode: 'major' }, level: 1,
      start: 0.26, bpm: 75.15, chords: ['I', 'V', 'vi', 'IV', 'I', 'V', 'IV', 'I'].map(c => ({ c, beats: 2 })),
      section: 'Вступление на фортепиано' },
    { id: 'zombie-verse', title: 'Zombie', artist: 'The Cranberries', youtube: '6Ejga4kJUts', key: { tonic: 4, mode: 'minor' }, level: 1,
      start: 37.88, bpm: 83.9, chords: bars('i', 'VI', 'III', 'VII', 'i', 'VI', 'III', 'VII'),
      section: 'Начало куплета' },
    { id: 'stand-by-me-verse', title: 'Stand by Me', artist: 'Ben E. King', youtube: 'z5i9vT8wGY8', key: { tonic: 9, mode: 'major' }, level: 1,
      start: 24.99, bpm: 123.85, chords: [{ c: 'I', beats: 8 }, { c: 'vi', beats: 8 }, { c: 'IV', beats: 4 }, { c: 'V', beats: 4 }, { c: 'I', beats: 8 }],
      section: 'Куплет' },
    { id: 'knockin-verse', title: 'Knockin’ on Heaven’s Door', artist: 'Bob Dylan', youtube: 'rm9coqlk8fY', key: { tonic: 7, mode: 'major' }, level: 1,
      start: 1.4, bpm: 139.75, chords: [{ c: 'I' }, { c: 'V' }, { c: 'ii', beats: 8 }, { c: 'I' }, { c: 'V' }, { c: 'IV', beats: 8 }],
      section: 'Вступление' },
    { id: 'teen-spirit-intro', title: 'Smells Like Teen Spirit', artist: 'Nirvana', youtube: 'hTWKbfoikeg', key: { tonic: 5, mode: 'minor' }, level: 1,
      start: 223.2, bpm: 123.25, chords: ['i', 'iv', 'III', 'VI', 'i', 'iv', 'III', 'VI'].map(c => ({ c, beats: 2 })),
      section: 'Финальный припев' },
    { id: 'numb-verse', title: 'Numb', artist: 'Linkin Park', youtube: 'kXYiU_JCYtU', key: { tonic: 6, mode: 'minor' }, level: 1,
      start: 5.34, bpm: 120.55, chords: bars('i', 'VI', 'III', 'VII', 'i', 'VI', 'III', 'VII'),
      section: 'Вступление' },
    { id: 'dont-stop-verse', title: 'Don’t Stop Believin’', artist: 'Journey', youtube: '1k8craCGpgs', key: { tonic: 4, mode: 'major' }, level: 2,
      start: 1.12, bpm: 120.55, chords: bars('I', 'V', 'vi', 'IV', 'I', 'V', 'iii', 'IV'),
      section: 'Вступление на фортепиано' },
    { id: 'with-or-without-verse', title: 'With or Without You', artist: 'U2', youtube: 'ujNeHIo7oTE', key: { tonic: 2, mode: 'major' }, level: 1,
      start: 36.06, bpm: 109.4, chords: bars('I', 'V', 'vi', 'IV', 'I', 'V', 'vi', 'IV'),
      section: 'Куплет 1: «See the stone set in your eyes»' },
    { id: 'sultans-verse', title: 'Sultans of Swing', artist: 'Dire Straits', youtube: 'h0ffIJ7ZO4U', key: { tonic: 2, mode: 'minor' }, level: 1,
      start: 169.78, bpm: 165.9, chords: [{ c: 'i' }, { c: 'VII', beats: 2 }, { c: 'VI', beats: 2 }, { c: 'V' }],
      section: 'Куплет' },
    { id: 'jolene-chorus', title: 'Jolene', artist: 'Dolly Parton', youtube: 'Ixrje2rXLMA', key: { tonic: 1, mode: 'minor' }, level: 1,
      start: 89.05, bpm: 197.4, chords: bars('i', 'III', 'VII', 'i'),
      section: 'Припев' },
    { id: 'hotel-california-verse', title: 'Hotel California', artist: 'Eagles', youtube: 'dLl4PZtxia8', key: { tonic: 11, mode: 'minor' }, level: 2,
      start: 26.4, bpm: 74.8, chords: bars('i', 'V7', 'VII', 'IV', 'VI', 'III', 'iv', 'V7'),
      section: 'Вступление, второй круг' },
    { id: 'creep-verse', title: 'Creep', artist: 'Radiohead', youtube: 'XFkzRNyygfk', key: { tonic: 7, mode: 'major' }, level: 3,
      start: 187.17, bpm: 102.45, chords: [{ c: 'I', beats: 8 }, { c: 'V/vi', beats: 8 }, { c: 'IV', beats: 8 }, { c: 'iv', beats: 8 }],
      section: 'Последний куплет' },
  ];

  const Songs = { SONG_LEVELS, LADDER, SONGS, expand, levelFor, barsOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = Songs;
  else root.Songs = Songs;
})(typeof window !== 'undefined' ? window : globalThis);
