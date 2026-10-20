/* HTTP API тренажёра поверх Web Request/Response (Next route handler).
   Аутентификация: email + пароль (scrypt), сессия в httpOnly-cookie sid. */
import crypto from 'crypto';
import { getStore } from './db';
import { loadCorpus } from './corpus';

const store = getStore();
const json = (code, body, headers) => new Response(JSON.stringify(body), { status: code, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}) });
async function readBody(req) { try { const t = await req.text(); return t ? JSON.parse(t) : {}; } catch (e) { return {}; } }
export function parseCookies(header) { const o = {}; (header || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
function cookieHeader(req, name, value, maxAge) {
  const secure = (req.headers.get('x-forwarded-proto') || '').includes('https') || process.env.VERCEL ? '; Secure' : '';
  return { 'Set-Cookie': `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}` };
}
const rid = () => crypto.randomBytes(16).toString('hex');
export function hashPassword(pw, salt) { salt = salt || crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex'); }
export function checkPassword(pw, stored) { const [salt, h] = stored.split(':'); return crypto.timingSafeEqual(Buffer.from(h, 'hex'), crypto.scryptSync(pw, salt, 32)); }

/* пользователь по sid (для серверных компонентов и API) */
export async function userBySid(sid) {
  if (!sid) return null;
  const s = await store.get('sessions', sid); if (!s || s.expires < Date.now()) return null;
  return store.get('users', s.userId);
}
export const publicUser = u => u ? { id: u.id, email: u.email, name: u.name } : null;
export const defaultState = () => ({ settings: { mode: 'major', timbre: 'auto', autoNext: true, songAutoNext: false }, progress: {} });
/* состояние пользователя для первого рендера: настройки, прогресс, показанные песни */
export async function userState(user) {
  const st = (await store.get('state', user.id)) || Object.assign({ id: user.id }, defaultState());
  const seen = await store.find('seen', { userId: user.id });
  return { settings: st.settings, progress: st.progress, seen: seen.map(s => s.songId) };
}
export async function corpusForUser(user) {
  const flagged = new Set((await store.all('flags')).map(f => f.songId));
  const base = loadCorpus().filter(s => !flagged.has(s.id));
  const custom = user ? (await store.find('customSongs', { userId: user.id })).map(c => Object.assign({ source: 'custom' }, c.song)) : [];
  return base.concat(custom);
}

export async function handleApi(req, p) {
  const url = new URL(req.url);
  const m = req.method;
  const ck = parseCookies(req.headers.get('cookie'));
  try {
    if (m === 'POST' && p === '/register') {
      const b = await readBody(req);
      const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: 'Некорректный email' });
      if (pw.length < 6) return json(400, { error: 'Пароль не короче 6 символов' });
      if ((await store.find('users', { email })).length) return json(409, { error: 'Такой email уже зарегистрирован' });
      const user = { id: rid(), email, name: String(b.name || '').trim().slice(0, 60) || email.split('@')[0], password: hashPassword(pw), created: new Date().toISOString() };
      await store.put('users', user);
      await store.put('state', Object.assign({ id: user.id }, defaultState()));
      return login(req, user);
    }
    if (m === 'POST' && p === '/login') {
      const b = await readBody(req);
      const email = String(b.email || '').trim().toLowerCase();
      const user = (await store.find('users', { email }))[0];
      if (!user || !checkPassword(String(b.password || ''), user.password)) return json(401, { error: 'Неверный email или пароль' });
      return login(req, user);
    }
    if (m === 'POST' && p === '/logout') {
      if (ck.sid) await store.del('sessions', ck.sid);
      return json(200, { ok: true }, cookieHeader(req, 'sid', '', 0));
    }
    const user = await userBySid(ck.sid);
    if (m === 'GET' && p === '/me') return json(200, { user: publicUser(user) });
    if (m === 'GET' && p === '/songs') return json(200, { songs: await corpusForUser(user) });

    if (!user) return json(401, { error: 'Нужен вход' });

    if (m === 'GET' && p === '/state') return json(200, await userState(user));
    if (m === 'PUT' && p === '/state') {
      const b = await readBody(req);
      const st = (await store.get('state', user.id)) || Object.assign({ id: user.id }, defaultState());
      if (b.settings) Object.assign(st.settings, b.settings);
      if (b.progress) Object.assign(st.progress, b.progress);
      await store.put('state', st);
      return json(200, { ok: true });
    }
    if (m === 'POST' && p === '/answer') {
      const b = await readBody(req);
      const rec = { id: rid(), userId: user.id, at: new Date().toISOString(), exercise: String(b.exercise || ''), mode: b.mode, level: b.level, songId: b.songId || null, title: b.title || null, artist: b.artist || null, correct: !!b.correct, answer: b.answer || null, truth: b.truth || null };
      await store.put('answers', rec);
      if (rec.songId) await store.put('seen', { id: user.id + ':' + rec.exercise + ':' + rec.songId, userId: user.id, exercise: rec.exercise, songId: rec.songId, title: rec.title, artist: rec.artist, mode: rec.mode, level: rec.level, correct: rec.correct, at: rec.at });
      return json(200, { ok: true });
    }
    if (m === 'GET' && p === '/answers') {
      const ex = url.searchParams.get('exercise');
      const list = (await store.find('answers', { userId: user.id })).filter(a => !a.songId && (!ex || a.exercise === ex));
      list.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
      return json(200, { answers: list.slice(0, 500) });
    }
    if (m === 'DELETE' && p === '/answers') {
      const ex = url.searchParams.get('exercise');
      for (const a of await store.find('answers', { userId: user.id })) if (!a.songId && (!ex || a.exercise === ex)) await store.del('answers', a.id);
      return json(200, { ok: true });
    }
    if (m === 'DELETE' && p.startsWith('/answers/')) {
      const id = decodeURIComponent(p.slice(9)); const a = await store.get('answers', id);
      if (a && a.userId === user.id) await store.del('answers', id);
      return json(200, { ok: true });
    }
    if (m === 'GET' && p === '/seen') {
      const list = await store.find('seen', { userId: user.id });
      list.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
      return json(200, { seen: list });
    }
    if (m === 'DELETE' && p === '/seen') {
      const ex = url.searchParams.get('exercise');
      for (const s of await store.find('seen', { userId: user.id })) if (!ex || s.exercise === ex) await store.del('seen', s.id);
      return json(200, { ok: true });
    }
    if (m === 'DELETE' && p.startsWith('/seen/')) {
      const id = decodeURIComponent(p.slice(6)); const s = await store.get('seen', id);
      if (s && s.userId === user.id) await store.del('seen', id);
      return json(200, { ok: true });
    }
    if (m === 'POST' && p === '/account/email') {
      const b = await readBody(req);
      const email = String(b.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: 'Некорректный email' });
      if (!checkPassword(String(b.password || ''), user.password)) return json(403, { error: 'Неверный пароль' });
      if (email !== user.email && (await store.find('users', { email })).length) return json(409, { error: 'Такой email уже зарегистрирован' });
      await store.update('users', user.id, { email });
      return json(200, { user: { id: user.id, email, name: user.name } });
    }
    if (m === 'POST' && p === '/account/password') {
      const b = await readBody(req);
      const npw = String(b.newPassword || '');
      if (npw.length < 6) return json(400, { error: 'Новый пароль не короче 6 символов' });
      if (!checkPassword(String(b.password || ''), user.password)) return json(403, { error: 'Неверный текущий пароль' });
      await store.update('users', user.id, { password: hashPassword(npw) });
      return json(200, { ok: true });
    }
    if (m === 'POST' && p === '/flag') {
      const b = await readBody(req);
      if (!b.id) return json(400, { error: 'нет id' });
      await store.put('flags', { id: rid(), userId: user.id, songId: b.id, reason: b.reason || '', task: b.task || '', youtube: b.youtube, start: b.start, title: b.title, artist: b.artist, answer: b.answer || null, at: new Date().toISOString() });
      return json(200, { ok: true });
    }
    if (m === 'GET' && p === '/flags') return json(200, { flags: await store.all('flags') });
    if (m === 'GET' && p === '/custom-songs') return json(200, { songs: (await store.find('customSongs', { userId: user.id })).map(c => c.song) });
    if (m === 'POST' && p === '/custom-song') {
      const b = await readBody(req); const song = b.song;
      if (!song || !song.id) return json(400, { error: 'нет песни' });
      await store.put('customSongs', { id: user.id + ':' + song.id, userId: user.id, song, at: new Date().toISOString() });
      return json(200, { ok: true });
    }
    if (m === 'DELETE' && p.startsWith('/custom-song/')) {
      await store.del('customSongs', user.id + ':' + decodeURIComponent(p.slice(13))); return json(200, { ok: true });
    }
    if (m === 'DELETE' && p === '/progress') {
      const key = url.searchParams.get('key');
      const st = (await store.get('state', user.id)) || Object.assign({ id: user.id }, defaultState());
      if (key) delete st.progress[key]; else st.progress = {};
      await store.put('state', st); return json(200, { ok: true });
    }
    return json(404, { error: 'нет такого маршрута' });
  } catch (e) {
    console.error(e); return json(500, { error: 'ошибка сервера: ' + e.message });
  }
}
async function login(req, user) {
  const sid = rid();
  await store.put('sessions', { id: sid, userId: user.id, expires: Date.now() + 365 * 86400e3 });
  return json(200, { user: publicUser(user) }, cookieHeader(req, 'sid', sid, 365 * 86400));
}
