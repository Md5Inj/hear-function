// Скачивает сэмплы General MIDI (FluidR3, mp3 по нотам) в public/samples/<инструмент>/<нота>.mp3.
// Запускается перед сборкой (prebuild) и локально: node tools/fetch-samples.js. Уже скачанные файлы пропускает.
const fs = require('fs'); const path = require('path');
const BASE = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/';
const INSTR = ['acoustic_grand_piano', 'electric_piano_1', 'drawbar_organ', 'string_ensemble_1', 'brass_section', 'acoustic_guitar_nylon', 'flute'];
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const LO = 33, HI = 96; // A1..C7
const out = path.join(__dirname, '..', 'public', 'samples');
async function main() {
  let n = 0, skipped = 0, failed = 0;
  for (const instr of INSTR) {
    fs.mkdirSync(path.join(out, instr), { recursive: true });
    const jobs = [];
    for (let m = LO; m <= HI; m++) {
      const name = NAMES[m % 12] + (Math.floor(m / 12) - 1); const file = path.join(out, instr, name + '.mp3');
      if (fs.existsSync(file) && fs.statSync(file).size > 0) { skipped++; continue; }
      jobs.push(fetch(`${BASE}${instr}-mp3/${name}.mp3`).then(async r => { if (!r.ok) throw new Error(r.status); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); n++; }).catch(e => { failed++; console.error('нет', instr, name, e.message); }));
      if (jobs.length >= 8) { await Promise.all(jobs); jobs.length = 0; }
    }
    await Promise.all(jobs);
    console.log(instr, 'готово');
  }
  console.log(`скачано ${n}, уже было ${skipped}, не удалось ${failed}`);
  if (failed) process.exitCode = 1;
}
main();
