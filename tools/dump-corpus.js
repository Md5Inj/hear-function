// Корпус песен (авто + ручные) как JSON для инструментов: node tools/dump-corpus.js > corpus.json
const fs = require('fs');
const SB = require('../lib/songs-db.js');
const auto = new Function(fs.readFileSync(__dirname + '/../lib/songs-data.js', 'utf8').replace('export default SongsAuto;', 'return SongsAuto;'))();
const all = SB.SONGS.map(s => Object.assign({ source: 'hand' }, s)).concat(auto.map(s => Object.assign({ source: 'auto' }, s)));
process.stdout.write(JSON.stringify(all.map(s => { const e = SB.expand(s); return Object.assign({}, s, { level: SB.levelFor(e) || s.level, chords: s.chords.map(c => ({ c: c.c, beats: c.beats != null ? c.beats : (s.beatsPerBar || 4) })) }); })));
