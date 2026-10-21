// node tools/dump-songs.js > songs.json — выгрузка базы песен для calibrate.py
const S = require('../lib/songs-db.js');
const T = require('../lib/theory.js');
const out = S.SONGS.map(s => {
  const e = S.expand(s);
  return {
    id: s.id, youtube: s.youtube, start: s.start, bpm: s.bpm, beatsPerBar: s.beatsPerBar || 4, end: e.end,
    chords: s.chords.map(c => ({ c: c.c, beats: c.beats != null ? c.beats : (s.beatsPerBar || 4), pcs: T.chordDef(s.key.mode, c.c).pcs.map(p => (p + s.key.tonic) % 12) })),
  };
});
process.stdout.write(JSON.stringify(out, null, 1));
