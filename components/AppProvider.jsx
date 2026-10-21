'use client';
/* Состояние приложения вместо старого common.js: пользователь, настройки, прогресс, показанные песни, корпус.
   Хранилище намеренно мутабельное (как раньше), перерисовка — через refresh(). Первое состояние приходит с сервера (SSR). */
import { createContext, useContext, useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createSampledEngine } from '@/lib/sampler';
import { toast, installTips, pick, weightedPick } from './ui';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export async function api(method, path, body) {
  const r = await fetch('/api' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  let d = {}; try { d = await r.json(); } catch (e) { /* пусто */ }
  if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
  return d;
}

function applyState(store, state) {
  if (!state) { store.progress = {}; store.seen = new Set(); return; }
  const s = state.settings || {};
  store.mode = s.mode === 'minor' ? 'minor' : 'major'; store.timbre = s.timbre || 'auto';
  store.autoNext = s.autoNext !== false; store.songAutoNext = !!s.songAutoNext;
  store.progress = state.progress || {}; store.seen = new Set(state.seen || []);
}

export default function AppProvider({ user, state, settings, children }) {
  const router = useRouter();
  const ref = useRef(null);
  if (!ref.current) { ref.current = { user, mode: 'major', timbre: 'auto', autoNext: true, songAutoNext: false, progress: {}, seen: new Set(), songs: {}, applied: null }; applyState(ref.current, state); ref.current.applied = state; ref.current.user = user; }
  const store = ref.current;
  // новые данные с сервера (после входа / router.refresh) применяем поверх
  if (store.applied !== state) { applyState(store, state); store.applied = state; }
  if (store.user !== user && (user ? user.id : null) !== (store.user ? store.user.id : null)) store.user = user;
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);
  const [login, setLogin] = useState(null);
  useEffect(() => { installTips(); }, []);

  const saveTimer = useRef(null);
  const save = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!store.user) return;
      api('PUT', '/state', { settings: { mode: store.mode, timbre: store.timbre, autoNext: store.autoNext, songAutoNext: store.songAutoNext }, progress: store.progress }).catch(e => toast('Не удалось сохранить: ' + e.message));
    }, 400);
  }, [store]);
  const logAnswer = useCallback(rec => { if (store.user) api('POST', '/answer', rec).catch(() => {}); if (rec.songId) store.seen.add(rec.exercise + ':' + rec.songId); }, [store]);
  const engineRef = useRef(null);
  const audio = useCallback(() => { if (!engineRef.current) { const C = window.AudioContext || window.webkitAudioContext; engineRef.current = createSampledEngine(new C()); } return engineRef.current; }, []);
  /* корпус по видам: chords (все фрагменты) и melody (с вокальной фразой); кэш в store.songs[kind] */
  const songsPromise = useRef({});
  const loadSongs = useCallback((kind = 'chords') => {
    if (store.songs[kind] && store.songs[kind].length) return Promise.resolve(store.songs[kind]);
    if (!songsPromise.current[kind]) songsPromise.current[kind] = api('GET', '/songs?kind=' + kind).then(d => { store.songs[kind] = d.songs; songsPromise.current[kind] = null; return d.songs; });
    return songsPromise.current[kind];
  }, [store]);
  const setUser = useCallback(u => { store.user = u; if (!u) { store.progress = {}; store.seen = new Set(); } refresh(); }, [store, refresh]);
  const logout = useCallback(async () => {
    try { await api('POST', '/logout'); } catch (e) { /* выходим локально всё равно */ }
    setUser(null); router.push('/'); router.refresh();
  }, [setUser, router]);
  const openLogin = useCallback(next => setLogin({ next: next || null }), []);

  const value = useMemo(() => ({ store, tick, refresh, api, save, logAnswer, audio, loadSongs, toast, pick, weightedPick, setUser, logout, openLogin, router, settings: settings || {} }), [store, tick, refresh, save, logAnswer, audio, loadSongs, setUser, logout, openLogin, router, settings]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div id="toast" />
      {login && <LoginModal next={login.next} onClose={() => setLogin(null)} onDone={u => { setLogin(null); store.user = u; refresh(); router.refresh(); if (login.next) router.push(login.next); }} />}
    </Ctx.Provider>
  );
}

function LoginModal({ onClose, onDone }) {
  const [mode, setMode] = useState('login');
  const [err, setErr] = useState('');
  const emailRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => emailRef.current && emailRef.current.focus(), 50); const onKey = ev => { if (ev.key === 'Escape') onClose(); }; document.addEventListener('keydown', onKey); return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); }; }, [onClose]);
  async function submit(ev) {
    ev.preventDefault(); setErr('');
    const f = ev.currentTarget;
    try {
      const d = await api('POST', mode === 'login' ? '/login' : '/register', { email: f.email.value, password: f.password.value, name: f.name ? f.name.value : '' });
      onDone(d.user);
    } catch (e) { setErr(e.message); }
  }
  return (
    <div className="auth-overlay" onClick={ev => { if (ev.target === ev.currentTarget) onClose(); }}>
      <form className="auth-box" onSubmit={submit}>
        <button className="modal-close" type="button" aria-label="Закрыть" data-tip="Закрыть" onClick={onClose}>×</button>
        <div className="auth-title">Тренажёр слуха</div>
        <div className="auth-sub">Войдите, чтобы прогресс и пройденные песни сохранялись.</div>
        <label>Email<input type="email" name="email" ref={emailRef} required autoComplete="email" /></label>
        <label>Пароль<input type="password" name="password" required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        {mode === 'register' && <label>Имя<input type="text" name="name" maxLength={60} /></label>}
        <div className="auth-err">{err}</div>
        <div className="auth-actions">
          <button className="btn primary" type="submit">{mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
          <button className="link" type="button" onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setErr(''); }}>{mode === 'login' ? 'Создать аккаунт' : 'У меня есть аккаунт'}</button>
        </div>
      </form>
    </div>
  );
}
