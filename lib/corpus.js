/* Корпус песен: ручные (songs-db.js) + автоматические (songs-data.js, пишет tools/export-songs.py). Только на сервере. */
import Songs from './songs-db';
import SongsAuto from './songs-data';
export function loadCorpus() {
  return Songs.SONGS.map(s => Object.assign({ source: 'hand' }, s)).concat(SongsAuto.map(s => Object.assign({ source: 'auto' }, s)));
}
