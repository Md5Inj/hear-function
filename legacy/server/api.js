/* HTTP API тренажёра. Одна функция handle(req, res) для локального сервера и для Vercel.
   Аутентификация: email + пароль (scrypt), сессия в httpOnly-cookie sid. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createStore } = require('./db');
const store = createStore();
const ROOT = path.join(__dirname, '..');

// ---------- корпус песен: грузим статические файлы один раз ----------
let corpus = null, corpusMtime = 0;
function loadCorpus() {
  const files = ['songs-db.js', 'songs-data.js'].map(f => path.join(ROOT, f));
  const mtime = Math.max(...files.map(f => { try { return fs.statSync(f).mtimeMs; } catch (e) { return 0; } }));
  if (corpus && mtime === corpusMtime) return corpus;
  const w = {};
  for (const f of files) {
    try { new Function('window', 'module', fs.readFileSync(f, 'utf8'))(w, undefined); } catch (e) { console.error('corpus load error', f, e.message); }
  }
  const hand = (w.Songs && w.Songs.SONGS) || [], auto = w.SongsAuto || [];
  corpus = hand.map(s => Object.assign({ source: 'hand' }, s)).concat(auto.map(s => Object.assign({ source: 'auto' }, s)));
  corpusMtime = mtime;
  return corpus;
}

// ---------- утилиты ----------
const json = (res, code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined) { // vercel уже распарсил
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body || '{}')); } catch (e) { return reject(e); } }
      return resolve(req.body || {});
    }
    let b = ''; req.on('data', c => { b += c; if (b.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
  });
}
function cookies(req) { const o = {}; (req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
function setCookie(req, res, name, value, maxAge) {
  const secure = (req.headers['x-forwarded-proto'] || '').includes('https') || process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}
const rid = () => crypto.randomBytes(16).toString('hex');
function hashPassword(pw, salt) { salt = salt || crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex'); }
function checkPassword(pw, stored) { const [salt, h] = stored.split(':'); return crypto.timingSafeEqual(Buffer.from(h, 'hex'), crypto.scryptSync(pw, salt, 32)); }

async function currentUser(req) {
  const sid = cookies(req).sid; if (!sid) return null;
  const s = await store.get('sessions', sid); if (!s || s.expires < Date.now()) return null;
  return store.get('users', s.userId);
}
const publicUser = u => u ? { id: u.id, email: u.email, name: u.name } : null;
const defaultState = () => ({ settings: { mode: 'major', timbre: 'auto', autoNext: true, songAutoNext: false }, progress: {} });

// ---------- маршруты ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/^\/api/, '') || '/';
  const m = req.method;
  try {
    // --- auth
    if (m === 'POST' && p === '/register') {
      const b = await readBody(req);
      const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: 'Некорректный email' });
      if (pw.length < 6) return json(res, 400, { error: 'Пароль не короче 6 символов' });
      if ((await store.find('users', { email })).length) return json(res, 409, { error: 'Такой email уже зарегистрирован' });
      const user = { id: rid(), email, name: String(b.name || '').trim().slice(0, 60) || email.split('@')[0], password: hashPassword(pw), created: new Date().toISOString() };
      await store.put('users', user);
      await store.put('state', Object.assign({ id: user.id }, defaultState()));
      return login(req, res, user);
    }
    if (m === 'POST' && p === '/login') {
      const b = await readBody(req);
      const email = String(b.email || '').trim().toLowerCase();
      const user = (await store.find('users', { email }))[0];
      if (!user || !checkPassword(String(b.password || ''), user.password)) return json(res, 401, { error: 'Неверный email или пароль' });
      return login(req, res, user);
    }
    if (m === 'POST' && p === '/logout') {
      const sid = cookies(req).sid; if (sid) await store.del('sessions', sid);
      setCookie(req, res, 'sid', '', 0); return json(res, 200, { ok: true });
    }
    const user = await currentUser(req);
    if (m === 'GET' && p === '/me') return json(res, 200, { user: publicUser(user) });

    // --- корпус (доступен без логина)
    if (m === 'GET' && p === '/songs') {
      const flagged = new Set((await store.all('flags')).map(f => f.songId));
      const base = loadCorpus().filter(s => !flagged.has(s.id));
      const custom = user ? (await store.find('customSongs', { userId: user.id })).map(c => Object.assign({ source: 'custom' }, c.song)) : [];
      return json(res, 200, { songs: base.concat(custom) });
    }

    if (!user) return json(res, 401, { error: 'Нужен вход' });

    // --- состояние: настройки и прогресс упражнений
    if (m === 'GET' && p === '/state') {
      const st = (await store.get('state', user.id)) || Object.assign({ id: user.id }, defaultState());
      const seen = await store.find('seen', { userId: user.id });
      return json(res, 200, { settings: st.settings, progress: st.progress, seen: seen.map(s => s.songId) });
    }
    if (m === 'PUT' && p === '/state') {
      const b = await readBody(req);
      const st = (await store.get('state', user.id)) || Object.assign({ id: user.id }, defaultState());
      if (b.settings) Object.assign(st.settings, b.settings);
      if (b.progress) Object.assign(st.progress, b.progress);
      await store.put('state', st);
      return json(res, 200, { ok: true });
    }
    // --- ответ: лог + отметка «показано»
    if (m === 'POST' && p === '/answer') {
      const b = await readBody(req);
      const rec = { id: rid(), userId: user.id, at: new Date().toISOString(), exercise: String(b.exercise || ''), mode: b.mode, level: b.level, songId: b.songId || null, title: b.title || null, artist: b.artist || null, correct: !!b.correct, answer: b.answer || null, truth: b.truth || null };
      await store.put('answers', rec);
      if (rec.songId) await store.put('seen', { id: user.id + ':' + rec.exercise + ':' + rec.songId, userId: user.id, exercise: rec.exercise, songId: rec.songId, title: rec.title, artist: rec.artist, mode: rec.mode, level: rec.level, correct: rec.correct, at: rec.at });
      return json(res, 200, { ok: true });
    }
    // --- пройденные
    if (m === 'GET' && p === '/answers') {
      const ex = url.searchParams.get('exercise');
      const list = (await store.find('answers', { userId: user.id })).filter(a => !a.songId && (!ex || a.exercise === ex));
      list.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
      return json(res, 200, { answers: list.slice(0, 500) });
    }
    if (m === 'DELETE' && p === '/answers') {
      const ex = url.searchParams.get('exercise');
      for (const a of await store.find('answers', { userId: user.id })) if (!a.songId && (!ex || a.exercise === ex)) await store.del('answers', a.id);
      return json(res, 200, { ok: true });
    }
    if (m === 'DELETE' && p.startsWith('/answers/')) {
      const id = decodeURIComponent(p.slice(9)); const a = await store.get('answers', id);
      if (a && a.userId === user.id) await store.del('answers', id);
      return json(res, 200, { ok: true });
    }
    if (m === 'GET' && p === '/seen') {
      const list = await store.find('seen', { userId: user.id });
      list.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
      return json(res, 200, { seen: list });
    }
    if (m === 'DELETE' && p === '/seen') {
      const ex = url.searchParams.get('exercise');
      for (const s of await store.find('seen', { userId: user.id })) if (!ex || s.exercise === ex) await store.del('seen', s.id);
      return json(res, 200, { ok: true });
    }
    if (m === 'DELETE' && p.startsWith('/seen/')) {
      const id = decodeURIComponent(p.slice(6)); const s = await store.get('seen', id);
      if (s && s.userId === user.id) await store.del('seen', id);
      return json(res, 200, { ok: true });
    }
    // --- аккаунт: смена почты и пароля (с проверкой текущего пароля)
    if (m === 'POST' && p === '/account/email') {
      const b = await readBody(req);
      const email = String(b.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: 'Некорректный email' });
      if (!checkPassword(String(b.password || ''), user.password)) return json(res, 403, { error: 'Неверный пароль' });
      if (email !== user.email && (await store.find('users', { email })).length) return json(res, 409, { error: 'Такой email уже зарегистрирован' });
      await store.update('users', user.id, { email });
      return json(res, 200, { user: { id: user.id, email, name: user.name } });
    }
    if (m === 'POST' && p === '/account/password') {
      const b = await readBody(req);
      const npw = String(b.newPassword || '');
      if (npw.length < 6) return json(res, 400, { error: 'Новый пароль не короче 6 символов' });
      if (!checkPassword(String(b.password || ''), user.password)) return json(res, 403, { error: 'Неверный текущий пароль' });
      await store.update('users', user.id, { password: hashPassword(npw) });
      return json(res, 200, { ok: true });
    }
    // --- отметка «разметка неверна»: скрывает фрагмент для всех
    if (m === 'POST' && p === '/flag') {
      const b = await readBody(req);
      if (!b.id) return json(res, 400, { error: 'нет id' });
      await store.put('flags', { id: rid(), userId: user.id, songId: b.id, reason: b.reason || '', task: b.task || '', youtube: b.youtube, start: b.start, title: b.title, artist: b.artist, answer: b.answer || null, at: new Date().toISOString() });
      return json(res, 200, { ok: true });
    }
    if (m === 'GET' && p === '/flags') return json(res, 200, { flags: await store.all('flags') });
    // --- свои песни из редактора
    if (m === 'GET' && p === '/custom-songs') return json(res, 200, { songs: (await store.find('customSongs', { userId: user.id })).map(c => c.song) });
    if (m === 'POST' && p === '/custom-song') {
      const b = await readBody(req); const song = b.song;
      if (!song || !song.id) return json(res, 400, { error: 'нет песни' });
      await store.put('customSongs', { id: user.id + ':' + song.id, userId: user.id, song, at: new Date().toISOString() });
      return json(res, 200, { ok: true });
    }
    if (m === 'DELETE' && p.startsWith('/custom-song/')) {
      await store.del('customSongs', user.id + ':' + decodeURIComponent(p.slice(13))); return json(res, 200, { ok: true });
    }
    // --- сброс прогресса упражнения
    if (m === 'DELETE' && p === '/progress') {
      const key = url.searchParams.get('key');
      const st = (await store.get('state', user.id)) || Object.assign({ id: user.id }, defaultState());
      if (key) delete st.progress[key]; else st.progress = {};
      await store.put('state', st); return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'нет такого маршрута' });
  } catch (e) {
    console.error(e); return json(res, 500, { error: 'ошибка сервера: ' + e.message });
  }
}
async function login(req, res, user) {
  const sid = rid();
  await store.put('sessions', { id: sid, userId: user.id, expires: Date.now() + 365 * 86400e3 });
  setCookie(req, res, 'sid', sid, 365 * 86400);
  return json(res, 200, { user: publicUser(user) });
}
module.exports = { handle, store, loadCorpus };
