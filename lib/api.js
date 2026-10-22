/* HTTP API тренажёра поверх Web Request/Response (Next route handler).
   Аутентификация: email + пароль (scrypt), сессия в httpOnly-cookie sid. */
import crypto from 'crypto';
import { getStore } from './db';
import { chordSongs, melodySongs } from './corpus';
import config from '../app.config';

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
/* Настройки приложения (коллекция settings, документ app): правятся в админке, применяются на клиенте и сервере */
export const DEFAULT_SETTINGS = { sessionLength: 10, levelUpWindow: 20, levelUpNeed: 16, poolMin: 8, hideFlagged: true, corpusAutoSync: true, minSongsPerLevel: 20 };
export async function appSettings() { const d = await store.get('settings', 'app'); return Object.assign({}, DEFAULT_SETTINGS, d || {}); }
/* Ступени: старая лестница из 6 уровней стала 6 группами по 4 задачи. Уровень n старой лестницы — задача
   «одна октава» группы n, то есть уровень (n-1)*4+1 новой. Переносим прогресс и уровни в ответах один раз. */
const DEGREE_TASKS = 4;
async function migrateDegrees(user, st) {
  const p = st.progress || {}; const keys = ['degrees.major', 'degrees.minor'].filter(k => p[k] && !p[k].ladder);
  if (!keys.length) return;
  const up = n => (Math.max(1, n | 0) - 1) * DEGREE_TASKS + 1;
  for (const k of keys) {
    const x = p[k]; x.level = up(x.level); if (x.maxLevel) x.maxLevel = up(x.maxLevel);
    if (x.byLevel) x.byLevel = Object.fromEntries(Object.entries(x.byLevel).map(([n, h]) => [up(+n), h]));
    x.ladder = 2;
  }
  await store.put('state', st);
  const answers = (await store.find('answers', { userId: user.id })).filter(a => a.exercise === 'degrees' && !a.ladder);
  for (const a of answers) await store.update('answers', a.id, { level: up(a.level), ladder: 2 });
}
export const defaultState = () => ({ settings: { mode: 'major', timbre: 'auto', autoNext: true, songAutoNext: false }, progress: {} });
/* состояние пользователя для первого рендера: настройки, прогресс, показанные песни */
export async function userState(user) {
  const st = (await store.get('state', user.id)) || Object.assign({ id: user.id }, defaultState());
  await migrateDegrees(user, st);
  const seen = await store.find('seen', { userId: user.id });
  // ключ «упражнение:id»: пройденная в аккордах песня не считается пройденной в мелодиях
  return { settings: st.settings, progress: st.progress, seen: seen.map(s => s.exercise + ':' + s.songId) };
}
export async function corpusForUser(user, kind) {
  // скрывают песню только ручные отметки «разметка неверна»; старые автоматические «недоступен» не учитываем
  const st = await appSettings();
  const flagged = new Set(st.hideFlagged ? (await store.all('flags')).filter(f => f.reason !== 'unavailable').map(f => f.songId) : []);
  const rejected = new Set((await store.find('reviews', { status: 'bad' })).map(r => r.songId)); // ручная проверка в админке: «неверно» скрывает фрагмент
  const base = (await (kind === 'melody' ? melodySongs(store) : chordSongs(store))).filter(s => !flagged.has(s.id) && !rejected.has(s.id));
  const custom = user ? (await store.find('customSongs', { userId: user.id })).map(c => Object.assign({ source: 'custom' }, c.song)).filter(s => kind !== 'melody' || (s.melody && s.melody.degrees && s.melody.degrees.length)) : [];
  return base.concat(custom);
}

/* Адрес служебной страницы из app.config.js: admin_xxxxxx (admin + подчёркивание + 6 символов); иначе страницы нет */
export function adminPath() { const v = String(config.adminPath || '').trim(); return /^admin_[a-z0-9]{6}$/i.test(v) ? v : null; }
/* Администраторы — коллекция admins ({ id, login, password: scrypt-хэш, at }), не связанная с пользователями.
   Пустая коллекция заполняется из app.config.js (adminLogin / adminPassword). Вход даёт подписанную cookie asid
   (id.срок.подпись, HMAC с adminSecret) на 30 дней; сессии в базе не нужны. */
async function seedAdmins() {
  const all = await store.all('admins');
  for (const a of all) if (!a.login || !a.password) await store.del('admins', a.id); // записи старого формата (только почта) не годятся для входа
  if (all.some(a => a.login && a.password)) return;
  await store.put('admins', { id: rid(), login: String(config.adminLogin || 'admin'), password: hashPassword(String(config.adminPassword || '')), at: new Date().toISOString() });
}
const sign = s => crypto.createHmac('sha256', String(config.adminSecret || 'dev')).update(s).digest('hex');
function adminToken(id) { const exp = Date.now() + 30 * 86400e3; const body = id + '.' + exp; return body + '.' + sign(body); }
export async function adminFromToken(token) {
  if (!token) return null;
  const parts = token.split('.'); if (parts.length !== 3) return null;
  const body = parts[0] + '.' + parts[1]; const good = sign(body);
  if (good.length !== parts[2].length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(parts[2]))) return null;
  if (+parts[1] < Date.now()) return null;
  const a = await store.get('admins', parts[0]); return a ? { id: a.id, login: a.login } : null;
}
const COLLECTIONS = ['chordSongs', 'melodySongs', 'reviews', 'users', 'admins', 'state', 'seen', 'answers', 'flags', 'customSongs', 'settings', 'meta'];
const maskDoc = (col, d) => (col === 'users' || col === 'admins') && d.password ? Object.assign({}, d, { password: '••••••' }) : d;

export async function handleApi(req, p) {
  const url = new URL(req.url);
  const m = req.method;
  const ck = parseCookies(req.headers.get('cookie'));
  try {
    if (m === 'POST' && p === '/register') {
      const b = await readBody(req);
      const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: 'Invalid email' });
      if (pw.length < 6) return json(400, { error: 'Password must be at least 6 characters' });
      if ((await store.find('users', { email })).length) return json(409, { error: 'This email is already registered' });
      const user = { id: rid(), email, name: String(b.name || '').trim().slice(0, 60) || email.split('@')[0], password: hashPassword(pw), created: new Date().toISOString() };
      await store.put('users', user);
      await store.put('state', Object.assign({ id: user.id }, defaultState()));
      return login(req, user);
    }
    if (m === 'POST' && p === '/login') {
      const b = await readBody(req);
      const email = String(b.email || '').trim().toLowerCase();
      const user = (await store.find('users', { email }))[0];
      if (!user || !checkPassword(String(b.password || ''), user.password)) return json(401, { error: 'Wrong email or password' });
      return login(req, user);
    }
    if (m === 'POST' && p === '/logout') {
      if (ck.sid) await store.del('sessions', ck.sid);
      return json(200, { ok: true }, cookieHeader(req, 'sid', '', 0));
    }
    const user = await userBySid(ck.sid);
    if (m === 'GET' && p === '/me') return json(200, { user: publicUser(user) });
    if (m === 'GET' && p === '/songs') return json(200, { songs: await corpusForUser(user, url.searchParams.get('kind') === 'melody' ? 'melody' : 'chords') });

    if (p === '/admin/login' && m === 'POST') {
      if (!adminPath()) return json(404, { error: 'no such route' });
      await seedAdmins();
      const b = await readBody(req); const login = String(b.login || '').trim();
      const a = (await store.find('admins', { login }))[0];
      if (!a || !a.password || !checkPassword(String(b.password || ''), a.password)) return json(401, { error: 'Wrong login or password' });
      return json(200, { admin: { id: a.id, login: a.login } }, cookieHeader(req, 'asid', adminToken(a.id), 30 * 86400));
    }
    if (p === '/admin/logout' && m === 'POST') return json(200, { ok: true }, cookieHeader(req, 'asid', '', 0));
    if (p.startsWith('/admin/')) {
      const admin = adminPath() ? await adminFromToken(ck.asid) : null;
      if (!admin) return json(403, { error: 'Admin sign-in required' });
      const parts = p.split('/').filter(Boolean); // ['admin', col, id?]
      if (m === 'GET' && parts[1] === 'overview') {
        const [users, chords, melodies, answers, flags, meta] = await Promise.all([store.all('users'), chordSongs(store), melodySongs(store), store.all('answers'), store.all('flags'), store.get('meta', 'songs')]);
        const SB = (await import('./songs-db')).default;
        const perLevel = {};
        for (const s of chords) { const e = SB.expand(s); const lvl = SB.levelFor(e); if (!lvl) continue; const k = e.key.mode + ':' + lvl; (perLevel[k] = perLevel[k] || new Set()).add(s.artist + ' — ' + s.title); }
        const levels = { major: SB.SONG_LEVELS.major.map((l, i) => ({ level: i + 1, title: l.title, songs: (perLevel['major:' + (i + 1)] || new Set()).size })), minor: SB.SONG_LEVELS.minor.map((l, i) => ({ level: i + 1, title: l.title, songs: (perLevel['minor:' + (i + 1)] || new Set()).size })) };
        const day = Date.now() - 86400e3;
        return json(200, { users: users.length, chordSongs: chords.length, melodySongs: melodies.length, answers: answers.length, answersToday: answers.filter(a => Date.parse(a.at) > day).length, flags: flags.length, lastImport: meta ? meta.at : null, levels, settings: await appSettings() });
      }
      if (parts[1] === 'settings') {
        if (m === 'GET') return json(200, { settings: await appSettings() });
        if (m === 'PUT') {
          const b = await readBody(req); const cur = await appSettings(); const next = { id: 'app' };
          for (const k of Object.keys(DEFAULT_SETTINGS)) { const v = b[k]; next[k] = typeof DEFAULT_SETTINGS[k] === 'number' ? (Number.isFinite(+v) ? +v : cur[k]) : !!v; }
          if (next.levelUpNeed > next.levelUpWindow) next.levelUpNeed = next.levelUpWindow;
          await store.put('settings', next); return json(200, { settings: Object.assign({}, DEFAULT_SETTINGS, next) });
        }
      }
      if (m === 'GET' && parts[1] === 'users' && !parts[2]) {
        const [users, answers, states] = await Promise.all([store.all('users'), store.all('answers'), store.all('state')]);
        const byUser = {}; for (const a of answers) { const u = byUser[a.userId] = byUser[a.userId] || { total: 0, correct: 0, last: null }; u.total++; if (a.correct) u.correct++; if (!u.last || a.at > u.last) u.last = a.at; }
        const st = {}; for (const x of states) st[x.id] = x;
        users.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
        return json(200, { users: users.map(u => ({ id: u.id, email: u.email, name: u.name, created: u.created, answers: byUser[u.id] || { total: 0, correct: 0, last: null }, progress: st[u.id] ? st[u.id].progress : {} })) });
      }
      if (m === 'DELETE' && parts[1] === 'users' && parts[2]) {
        const id = decodeURIComponent(parts[2]);
        await store.del('users', id); await store.del('state', id);
        for (const c of ['seen', 'answers', 'customSongs']) for (const d of await store.find(c, { userId: id })) await store.del(c, d.id);
        for (const d of await store.find('sessions', { userId: id })) await store.del('sessions', d.id);
        return json(200, { ok: true });
      }
      // ручная проверка песен по уровням: список фрагментов уровня со статусами и сохранение вердикта
      if (m === 'GET' && parts[1] === 'review' && !parts[2]) {
        const kind = url.searchParams.get('kind') === 'melody' ? 'melody' : 'chords', mode = url.searchParams.get('mode') === 'minor' ? 'minor' : 'major', level = +url.searchParams.get('level') || 1;
        const SB = (await import('./songs-db')).default;
        const songs = (await (kind === 'melody' ? melodySongs(store) : chordSongs(store))).filter(s => { const e = SB.expand(s); return e.key.mode === mode && (kind === 'melody' || SB.levelFor(e) === level); });
        const reviews = {}; for (const r of await store.find('reviews', { kind })) reviews[r.songId] = r;
        songs.sort((a, b) => (a.artist + a.title).localeCompare(b.artist + b.title));
        return json(200, { songs: songs.map(s => Object.assign({}, s, { review: reviews[s.id] || null })) });
      }
      if (m === 'POST' && parts[1] === 'review' && parts[2]) {
        const b = await readBody(req); const songId = decodeURIComponent(parts[2]);
        const status = ['ok', 'bad'].includes(b.status) ? b.status : null;
        const doc = { id: (b.kind === 'melody' ? 'melody:' : 'chords:') + songId, songId, kind: b.kind === 'melody' ? 'melody' : 'chords', status, note: String(b.note || '').slice(0, 2000), answer: Array.isArray(b.answer) ? b.answer : null, truth: Array.isArray(b.truth) ? b.truth : null, correct: typeof b.correct === 'boolean' ? b.correct : null, at: new Date().toISOString(), by: admin.login };
        if (!status && !doc.note) { await store.del('reviews', doc.id); return json(200, { review: null }); }
        await store.put('reviews', doc); return json(200, { review: doc });
      }
      if (m === 'GET' && parts[1] === 'collections') {
        const out = []; for (const c of COLLECTIONS) out.push({ name: c, count: await store.count(c, () => true) });
        return json(200, { collections: out });
      }
      const col = parts[1]; if (!COLLECTIONS.includes(col)) return json(404, { error: 'no such collection' });
      if (m === 'GET') {
        const q = (url.searchParams.get('q') || '').toLowerCase(), offset = +url.searchParams.get('offset') || 0, limit = Math.min(+url.searchParams.get('limit') || 50, 2000);
        let docs = (await store.all(col)).map(d => maskDoc(col, d));
        if (q) docs = docs.filter(d => JSON.stringify(d).toLowerCase().includes(q));
        docs.sort((a, b) => String(b.at || b.created || '').localeCompare(String(a.at || a.created || '')));
        return json(200, { total: docs.length, docs: docs.slice(offset, offset + limit) });
      }
      if (m === 'POST' && !parts[2]) {
        const b = await readBody(req); const doc = b.doc;
        if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return json(400, { error: 'a document object is expected' });
        if (!doc.id) doc.id = rid();
        if (await store.get(col, doc.id)) return json(409, { error: 'a record with this id already exists' });
        if ((col === 'users' || col === 'admins') && doc.password && !/^[0-9a-f]{32}:[0-9a-f]{64}$/.test(doc.password)) doc.password = hashPassword(String(doc.password)); // открытый пароль хэшируем
        await store.put(col, doc); return json(200, { doc: maskDoc(col, doc) });
      }
      if (m === 'DELETE' && parts[2]) { await store.del(col, decodeURIComponent(parts[2])); return json(200, { ok: true }); }
      if (m === 'PUT' && parts[2]) {
        const id = decodeURIComponent(parts[2]); const b = await readBody(req); const doc = b.doc;
        if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return json(400, { error: 'a document object is expected' });
        const prev = await store.get(col, id); if (!prev) return json(404, { error: 'no such record' });
        doc.id = id;
        if ((col === 'users' || col === 'admins') && (doc.password === '••••••' || !doc.password)) doc.password = prev.password; // хэш не показываем и не затираем
        if (col === 'admins' && doc.password !== prev.password && !/^[0-9a-f]{32}:[0-9a-f]{64}$/.test(doc.password)) doc.password = hashPassword(String(doc.password));
        if (col === 'chordSongs' || col === 'melodySongs') doc.edited = true; // правленную вручную песню импорт корпуса больше не перезаписывает
        await store.put(col, doc); return json(200, { doc: maskDoc(col, doc) });
      }
      return json(404, { error: 'no such route' });
    }

    if (!user) return json(401, { error: 'Sign-in required' });

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
    // работа над ошибками: что отвечено неверно и с тех пор не исправлено
    if (m === 'GET' && p === '/mistakes') {
      const ex = url.searchParams.get('exercise'), mode = url.searchParams.get('mode') === 'minor' ? 'minor' : 'major';
      if (ex === 'songs' || ex === 'melodies') {
        const seen = (await store.find('seen', { userId: user.id })).filter(x => x.exercise === ex && x.mode === mode && x.correct === false);
        return json(200, { items: seen.map(x => ({ songId: x.songId, title: x.title, artist: x.artist, level: x.level })) });
      }
      const answers = (await store.find('answers', { userId: user.id })).filter(a => a.exercise === ex && a.mode === mode && !a.songId);
      answers.sort((a, b) => (a.at || '').localeCompare(b.at || ''));
      const last = {}; // по каждому «правильному ответу» — был ли последний ответ верным
      for (const a of answers) { const k = JSON.stringify(a.truth); last[k] = { correct: a.correct, truth: a.truth, level: a.level, wrong: (last[k] ? last[k].wrong : 0) + (a.correct ? 0 : 1) }; }
      return json(200, { items: Object.values(last).filter(x => !x.correct).map(x => ({ truth: x.truth, level: x.level, wrong: x.wrong })) });
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
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: 'Invalid email' });
      if (!checkPassword(String(b.password || ''), user.password)) return json(403, { error: 'Wrong password' });
      if (email !== user.email && (await store.find('users', { email })).length) return json(409, { error: 'This email is already registered' });
      await store.update('users', user.id, { email });
      return json(200, { user: { id: user.id, email, name: user.name } });
    }
    if (m === 'POST' && p === '/account/password') {
      const b = await readBody(req);
      const npw = String(b.newPassword || '');
      if (npw.length < 6) return json(400, { error: 'New password must be at least 6 characters' });
      if (!checkPassword(String(b.password || ''), user.password)) return json(403, { error: 'Wrong current password' });
      await store.update('users', user.id, { password: hashPassword(npw) });
      return json(200, { ok: true });
    }
    if (m === 'POST' && p === '/flag') {
      const b = await readBody(req);
      if (!b.id) return json(400, { error: 'no id' });
      await store.put('flags', { id: rid(), userId: user.id, songId: b.id, reason: b.reason || '', task: b.task || '', youtube: b.youtube, start: b.start, title: b.title, artist: b.artist, answer: b.answer || null, at: new Date().toISOString() });
      return json(200, { ok: true });
    }
    if (m === 'GET' && p === '/flags') return json(200, { flags: await store.all('flags') });
    if (m === 'GET' && p === '/custom-songs') return json(200, { songs: (await store.find('customSongs', { userId: user.id })).map(c => c.song) });
    if (m === 'POST' && p === '/custom-song') {
      const b = await readBody(req); const song = b.song;
      if (!song || !song.id) return json(400, { error: 'no song' });
      await store.put('customSongs', { id: user.id + ':' + song.id, userId: user.id, song, at: new Date().toISOString() });
      return json(200, { ok: true });
    }
    if (m === 'DELETE' && p.startsWith('/custom-song/')) {
      await store.del('customSongs', user.id + ':' + decodeURIComponent(p.slice(13))); return json(200, { ok: true });
    }
    // --- просмотр базы (только администратор)
    if (m === 'DELETE' && p === '/progress') {
      const key = url.searchParams.get('key');
      const st = (await store.get('state', user.id)) || Object.assign({ id: user.id }, defaultState());
      if (key) delete st.progress[key]; else st.progress = {};
      await store.put('state', st); return json(200, { ok: true });
    }
    return json(404, { error: 'no such route' });
  } catch (e) {
    console.error(e); return json(500, { error: 'server error: ' + e.message });
  }
}
async function login(req, user) {
  const sid = rid();
  await store.put('sessions', { id: sid, userId: user.id, expires: Date.now() + 365 * 86400e3 });
  return json(200, { user: publicUser(user) }, cookieHeader(req, 'sid', sid, 365 * 86400));
}
