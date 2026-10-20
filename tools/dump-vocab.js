// node tools/dump-vocab.js > vocab.json — лестница уровней песен: накопленный словарь и лимит тактов
// node tools/dump-vocab.js chords > chords.json — таблицы аккордов для python
const P = require('../progressions.js'); const S = require('../songs-db.js');
if (process.argv[2] === 'chords') {
  const T = require('../theory.js'); const o = {};
  for (const m of ['major', 'minor']) { o[m] = {}; for (const [sym, d] of Object.entries(T.CHORDS[m])) o[m][sym] = { root: d.root, intervals: T.QUALITIES[d.q] }; }
  process.stdout.write(JSON.stringify(o));
} else {
  const out = {};
  for (const mode of ['major', 'minor']) out[mode] = S.SONG_LEVELS[mode].map(l => ({ vocab: l.vocab, maxBars: isFinite(l.maxBars) ? l.maxBars : 1000 }));
  process.stdout.write(JSON.stringify(out));
}
