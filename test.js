/* node test.js — проверки теории и базы прогрессий */
const T = require('./lib/theory.js');
const P = require('./lib/progressions.js');
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL:', msg); } };

// 1. Аккорды: ожидаемые классы высот для C и для всех 12 тоник
const expect = {
  major: { 'I': [0, 4, 7], 'ii': [2, 5, 9], 'iii': [4, 7, 11], 'IV': [5, 9, 0], 'V': [7, 11, 2], 'vi': [9, 0, 4], 'vii°': [11, 2, 5], 'V7': [7, 11, 2, 5], 'V/V': [2, 6, 9, 0], 'iv': [5, 8, 0], '♭VII': [10, 2, 5] },
  minor: { 'i': [0, 3, 7], 'ii°': [2, 5, 8], 'III': [3, 7, 10], 'iv': [5, 8, 0], 'v': [7, 10, 2], 'V': [7, 11, 2], 'VI': [8, 0, 3], 'VII': [10, 2, 5], 'iiø7': [2, 5, 8, 0], 'N': [1, 5, 8], 'IV': [5, 9, 0] },
};
for (const mode of ['major', 'minor']) for (const [tok, pcs] of Object.entries(expect[mode])) {
  for (let tonic = 0; tonic < 12; tonic++) {
    const d = T.chordDef(mode, tok);
    const got = d.pcs.map(p => (p + tonic) % 12).sort((a, b) => a - b).join(',');
    const want = pcs.map(p => (p + tonic) % 12).sort((a, b) => a - b).join(',');
    ok(got === want, `${mode} ${tok} tonic ${tonic}: got ${got} want ${want}`);
  }
}
// Диатоника должна лежать в гамме (кроме гармонических V/vii° в миноре)
for (const mode of ['major', 'minor']) {
  const scale = new Set(T.SCALES[mode]);
  const diatonic = mode === 'major' ? ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] : ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
  for (const tok of diatonic) ok(T.chordDef(mode, tok).pcs.every(p => scale.has(p)), `${mode} ${tok} not in scale`);
}
// Обращения
ok(T.chordDef('major', 'V:1').bassRel === 11, 'V:1 bass should be leading tone');
ok(T.chordDef('major', 'V7:3').bassRel === 5, 'V7:3 bass should be 7th');
ok(T.displayToken('V:1') === 'V⁶' && T.displayToken('V7:1') === 'V7⁶₅' && T.displayToken('iiø7:2') === 'iiø7⁴₃', 'display figures');
ok(T.letterName('major', 'V7', 0) === 'G7' && T.letterName('minor', 'iv', 9) === 'Dm' && T.letterName('major', 'V:1', 0) === 'G/B', 'letter names');

// 2. База: каждая прогрессия использует только аккорды из словаря своего уровня
for (const p of P.PROGRESSIONS) {
  const level = P.PROG_LEVELS[p.mode][p.level - 1];
  ok(level, `no level ${p.level} for ${p.mode}`);
  for (const tok of p.chords) {
    const sym = T.parseToken(tok).symbol;
    ok(level.vocab.includes(sym), `${p.mode} L${p.level} ${p.chords.join('-')}: ${sym} not in vocab`);
    try { T.chordDef(p.mode, tok); } catch (e) { ok(false, e.message); }
  }
  ok(p.chords.length >= 2, 'progression too short');
}
// Каждый уровень имеет хотя бы 4 прогрессии; словари растут монотонно
for (const mode of ['major', 'minor']) {
  P.PROG_LEVELS[mode].forEach((lvl, i) => {
    const n = P.PROGRESSIONS.filter(p => p.mode === mode && p.level === i + 1).length;
    ok(n >= 4, `${mode} level ${i + 1} has only ${n} progressions`);
    for (const sym of lvl.vocab) ok(T.CHORDS[mode][sym], `${mode} vocab ${sym} unknown`);
    if (i > 0) for (const sym of P.PROG_LEVELS[mode][i - 1].vocab) ok(lvl.vocab.includes(sym), `${mode} level ${i + 1} dropped ${sym}`);
  });
  P.DEGREE_LEVELS[mode].forEach((lvl, i) => {
    for (const lab of lvl.degrees) ok(T.degreeByLabel(mode, lab), `${mode} degree level ${i + 1}: unknown degree ${lab}`);
  });
  for (const tok of T.CADENCE[mode]) T.chordDef(mode, tok);
}

// 3. Голосоведение: все ноты аккорда покрыты, голоса в диапазоне, движение небольшое
let maxMove = 0;
for (const p of P.PROGRESSIONS) for (let tonic = 0; tonic < 12; tonic++) {
  const v = T.voiceLead(T.CADENCE[p.mode].concat(p.chords), p.mode, tonic);
  let prev = null;
  for (const c of v) {
    const d = T.chordDef(p.mode, c.token);
    const want = new Set(d.pcs.map(x => (x + tonic) % 12));
    const got = new Set(c.notes.map(n => n % 12));
    ok([...want].every(x => got.has(x)) && [...got].every(x => want.has(x)), `voicing pcs mismatch ${p.mode} ${c.token}`);
    ok(c.bass % 12 === (d.bassRel + tonic) % 12, `bass wrong for ${c.token}`);
    ok(c.upper.every(n => n >= 55 && n <= 81) && c.bass >= 40 && c.bass <= 52, 'range');
    for (let i = 1; i < 4; i++) ok(c.upper[i] > c.upper[i - 1], 'voices not strictly ascending');
    if (prev) { const mv = c.upper.reduce((s, n, i) => s + Math.abs(n - prev[i]), 0); maxMove = Math.max(maxMove, mv); ok(mv <= 14, `big jump ${mv} ${p.mode} ${p.chords.join('-')} at ${c.token}`); }
    prev = c.upper;
  }
}
// 4. База песен
const SB = require('./lib/songs-db.js');
const fs = require('fs');
let AUTO = [];
if (fs.existsSync('./lib/songs-data.js')) AUTO = new Function(fs.readFileSync('./lib/songs-data.js', 'utf8').replace('export default SongsAuto;', 'return SongsAuto;'))();
const ALL_SONGS = SB.SONGS.concat(AUTO);
const ids = new Set();
for (const raw of ALL_SONGS) {
  ok(!ids.has(raw.id), `${raw.id}: duplicate id`); ids.add(raw.id);
  const s = SB.expand(raw);
  ok(raw.bpm > 30 && raw.bpm < 300, `${raw.id}: bad bpm`);
  const m = s.key.mode;
  ok(SB.levelFor(s) != null, `${s.id}: chords outside the ladder`);
  const vocab = SB.SONG_LEVELS[m][SB.SONG_LEVELS[m].length - 1].vocab;
  ok(/^[\w-]{11}$/.test(s.youtube), `${s.id}: bad youtube id`);
  ok(s.end > s.start, `${s.id}: end <= start`);
  ok(raw.start >= 0, `${s.id}: negative start`);
  ok(s.chords.length >= 1, `${s.id}: no chords`);
  for (const c of s.chords) {
    try { T.chordDef(m, c.c); } catch (e) { ok(false, `${s.id}: ${e.message}`); }
    ok(vocab.includes(T.parseToken(c.c).symbol), `${s.id}: ${c.c} outside ladder vocab`);
    ok(c.t >= s.start && c.t < s.end, `${s.id}: chord ${c.c} at ${c.t} outside fragment`);
  }
  if (s.melody) { ok(s.melody.end > s.melody.start, `${s.id}: melody range`); for (const d of s.melody.degrees) ok(T.degreeByLabel(m, d), `${s.id}: bad degree ${d}`); }
}
console.log('songs:', SB.SONGS.length, 'auto:', AUTO.length);
console.log('max total voice movement between chords:', maxMove);
console.log('progressions:', P.PROGRESSIONS.length, 'major:', P.PROGRESSIONS.filter(p => p.mode === 'major').length, 'minor:', P.PROGRESSIONS.filter(p => p.mode === 'minor').length);
console.log(fails ? `${fails} FAILURES` : 'ALL TESTS PASSED');
process.exit(fails ? 1 : 0);
