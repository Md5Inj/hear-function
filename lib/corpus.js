/* Корпус песен в базе: две коллекции.
   chordSongs  — все фрагменты с аккордами (для «Аккордов песен»), без поля melody;
   melodySongs — фрагменты с вокальной фразой (для «Мелодий песен»), с аккордами для контекста и уровня.
   Источник импорта — lib/songs-data.js (результат конвейера tools/) и ручные песни lib/songs-db.js. Сервер сам
   синхронизирует коллекции при смене версии файла; записи с edited: true (правленные в админке) не трогаем. */
import crypto from 'crypto';
import Songs from './songs-db';
import SongsAuto from './songs-data';

const all = Songs.SONGS.map(s => Object.assign({ source: 'hand' }, s)).concat(SongsAuto.map(s => Object.assign({ source: 'auto' }, s)));
const chordDocs = all.map(s => { const d = Object.assign({}, s); delete d.melody; return d; });
const melodyDocs = all.filter(s => s.melody && s.melody.degrees && s.melody.degrees.length);
const VERSION = 'v2-' + crypto.createHash('sha1').update(JSON.stringify(all)).digest('hex').slice(0, 16); // v2: две коллекции
let synced = null;

async function syncCollection(store, col, docs) {
  const existing = new Map((await store.all(col)).map(d => [d.id, d]));
  let put = 0, kept = 0, removed = 0;
  for (const d of docs) {
    const old = existing.get(d.id);
    if (old && old.edited) { kept++; continue; }
    await store.put(col, Object.assign({}, d, { importedAt: new Date().toISOString() })); put++;
  }
  const ids = new Set(docs.map(d => d.id));
  for (const [id, old] of existing) if (!ids.has(id) && old.source !== 'custom' && !old.edited) { await store.del(col, id); removed++; }
  return { put, kept, removed, count: docs.length };
}
export async function ensureSongs(store) {
  if (synced === VERSION) return;
  const st = await store.get('settings', 'app');
  if (st && st.corpusAutoSync === false) return; // импорт выключен в настройках админки
  const meta = await store.get('meta', 'songs');
  if (!meta || meta.version !== VERSION) {
    const chords = await syncCollection(store, 'chordSongs', chordDocs);
    const melodies = await syncCollection(store, 'melodySongs', melodyDocs);
    for (const old of await store.all('songs')) await store.del('songs', old.id); // прежняя общая коллекция больше не используется
    await store.put('meta', { id: 'songs', version: VERSION, at: new Date().toISOString(), chordSongs: chords, melodySongs: melodies });
    console.log(`корпус в базе обновлён: аккорды ${chords.put} записано / ${chords.removed} удалено, мелодии ${melodies.put} записано / ${melodies.removed} удалено`);
  }
  synced = VERSION;
}
export async function chordSongs(store) { await ensureSongs(store); return store.all('chordSongs'); }
export async function melodySongs(store) { await ensureSongs(store); return store.all('melodySongs'); }
