/* Общее для страниц: состояние на сервере (API), вход, аудио, уровни, прогресс.
   Инициализация асинхронная: страницы ждут ET.ready. */
window.ET = (function () {
  'use strict';
  const T = window.Theory, S = window.Synth;
  const $ = sel => document.querySelector(sel);

  const store = { mode: 'major', timbre: 'auto', autoNext: true, songAutoNext: false, progress: {}, seen: new Set(), user: null, songs: [] };

  async function api(method, path, body) {
    const r = await fetch('/api' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    let d = {}; try { d = await r.json(); } catch (e) { /* пусто */ }
    if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
    return d;
  }

  let saveTimer = null, pendingSettings = {}, pendingProgress = {};
  function save() {
    cacheState();
    pendingSettings = { mode: store.mode, timbre: store.timbre, autoNext: store.autoNext, songAutoNext: store.songAutoNext };
    pendingProgress = store.progress;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { if (store.user) api('PUT', '/state', { settings: pendingSettings, progress: pendingProgress }).catch(e => toast('Не удалось сохранить: ' + e.message)); }, 400);
  }

  // кэш состояния и корпуса: страница рисуется сразу из кэша, сервер подтверждает в фоне
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* переполнение или приватный режим */ } };
  const isHome = /(^|\/)(index\.html)?$/.test(location.pathname);
  const cacheUser = u => lsSet('etUser', u);
  const cachedUser = () => lsGet('etUser');
  function applyState(st) { Object.assign(store, st.settings || {}); store.progress = st.progress || {}; store.seen = new Set(st.seen || []); }
  function cacheState() { lsSet('etState', { settings: { mode: store.mode, timbre: store.timbre, autoNext: store.autoNext, songAutoNext: store.songAutoNext }, progress: store.progress, seen: [...store.seen] }); }
  async function loadState() { const st = await api('GET', '/state'); applyState(st); cacheState(); }
  async function loadSongs() { store.songs = (await api('GET', '/songs')).songs; lsSet('etSongs', { at: Date.now(), songs: store.songs }); }
  const needsSongs = !!document.body.dataset.task || /editor\.html$/.test(location.pathname);
  const toLogin = () => { cacheUser(null); lsSet('etState', null); location.replace('index.html?login=1&next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search)); return new Promise(() => {}); };

  // лад из адреса (?mode=major|minor) — подпункты меню; применяется поверх сохранённого состояния
  let urlMode = null;
  function applyUrlMode() {
    const m = new URLSearchParams(location.search).get('mode');
    urlMode = ['major', 'minor'].includes(m) ? m : null;
    if (urlMode) { const u = new URL(location.href); u.searchParams.delete('mode'); history.replaceState(history.state, '', u.pathname + (u.search || '') + u.hash); }
  }
  applyUrlMode();
  const forceMode = () => { if (urlMode && store.mode !== urlMode) { store.mode = urlMode; save(); cacheState(); } };
  async function init() {
    store.user = cachedUser(); if (store.user) renderUserBar();
    const cachedSt = store.user ? lsGet('etState') : null, cachedSongs = lsGet('etSongs');
    const canRenderNow = store.user && cachedSt && (!needsSongs || (cachedSongs && Date.now() - cachedSongs.at < 15 * 60e3));
    if (canRenderNow) {
      applyState(cachedSt); forceMode(); if (needsSongs) store.songs = cachedSongs.songs;
      (async () => { // фоновая сверка
        let fresh = null; try { fresh = (await api('GET', '/me')).user; } catch (e) { return; }
        if (!fresh) return toLogin();
        cacheUser(fresh);
        try { const st = await api('GET', '/state'); applyState(st); forceMode(); cacheState(); } catch (e) { /* оставляем кэш */ }
        if (needsSongs) loadSongs().catch(() => {});
      })();
      return;
    }
    let fresh = null;
    try { fresh = (await api('GET', '/me')).user; } catch (e) { fresh = null; }
    if (JSON.stringify(fresh) !== JSON.stringify(store.user)) { store.user = fresh; const old = document.querySelector('.user-chip'); if (old) old.remove(); }
    cacheUser(store.user);
    if (!store.user) { lsSet('etState', null); if (isHome) { renderUserBar(); return; } return toLogin(); }
    await Promise.all([loadState(), needsSongs ? loadSongs() : Promise.resolve()]);
    forceMode();
    renderUserBar();
  }

  // ---------- вход ----------
  function showLogin(container) {
    return new Promise(resolve => {
      const el = document.createElement('div'); el.className = container ? 'auth-inline' : 'auth-overlay';
      el.innerHTML = `<form class="auth-box" id="authForm">
        ${container ? '' : '<button class="modal-close" type="button" id="authClose" aria-label="Закрыть" data-tip="Закрыть">×</button>'}
        <div class="auth-title">${container ? 'Вход' : 'Тренажёр слуха'}</div>
        <div class="auth-sub" id="authSub">Войдите, чтобы прогресс и пройденные песни сохранялись.</div>
        <label>Email<input type="email" id="authEmail" required autocomplete="email"></label>
        <label>Пароль<input type="password" id="authPass" required minlength="6" autocomplete="current-password"></label>
        <label id="authNameRow" hidden>Имя<input type="text" id="authName" maxlength="60"></label>
        <div class="auth-err" id="authErr"></div>
        <div class="auth-actions"><button class="btn primary" type="submit" id="authSubmit">Войти</button><button class="link" type="button" id="authToggle">Создать аккаунт</button></div>
      </form>`;
      (container || document.body).appendChild(el);
      if (!container) { // попап закрывается кликом по фону или Escape
        el.addEventListener('click', ev => { if (ev.target === el) el.remove(); });
        el.querySelector('#authClose').addEventListener('click', () => el.remove());
        const onKey = ev => { if (ev.key === 'Escape') { el.remove(); document.removeEventListener('keydown', onKey); } };
        document.addEventListener('keydown', onKey);
      }
      let mode = 'login';
      const form = el.querySelector('#authForm');
      el.querySelector('#authToggle').addEventListener('click', () => {
        mode = mode === 'login' ? 'register' : 'login';
        el.querySelector('#authNameRow').hidden = mode === 'login';
        el.querySelector('#authSubmit').textContent = mode === 'login' ? 'Войти' : 'Создать аккаунт';
        el.querySelector('#authToggle').textContent = mode === 'login' ? 'Создать аккаунт' : 'У меня есть аккаунт';
        el.querySelector('#authErr').textContent = '';
      });
      form.addEventListener('submit', async ev => {
        ev.preventDefault(); el.querySelector('#authErr').textContent = '';
        try {
          const d = await api('POST', mode === 'login' ? '/login' : '/register', { email: el.querySelector('#authEmail').value, password: el.querySelector('#authPass').value, name: el.querySelector('#authName').value });
          store.user = d.user; cacheUser(d.user); el.remove(); resolve();
        } catch (e) { el.querySelector('#authErr').textContent = e.message; }
      });
      setTimeout(() => el.querySelector('#authEmail').focus(), 50);
    });
  }
  document.addEventListener('click', async ev => {
    const b = ev.target.closest && ev.target.closest('#btnLogout'); if (!b) return;
    ev.preventDefault(); b.disabled = true;
    try { await api('POST', '/logout'); } catch (e) { /* локальный выход всё равно */ }
    finally { cacheUser(null); lsSet('etState', null); location.href = 'index.html'; }
  });
  function renderUserBar() {
    const nav = document.querySelector('.nav'); if (!nav || nav.querySelector('.user-chip')) return;
    const chip = document.createElement('span'); chip.className = 'user-chip';
    if (store.user) {
      const onHistory = /history\.html$/.test(location.pathname);
      chip.innerHTML = `<a href="history.html" class="hist-link${onHistory ? ' current' : ''}" data-tip="История" aria-label="История"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></a><a href="account.html" class="user-pill${/account\.html$/.test(location.pathname) ? ' current' : ''}" data-tip="Аккаунт: ${store.user.email}">${store.user.name}</a><button class="link logout" id="btnLogout" data-tip="Выйти"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18"/></svg></button>`;
      nav.appendChild(chip);
    } else {
      chip.innerHTML = `<a href="index.html?login=1" class="btn primary mini" id="btnLoginTop">Войти</a>`;
      nav.appendChild(chip);
    }
  }

  // ---------- аудио ----------
  let engine = null;
  function audio() {
    if (!engine) { const Ctx = window.AudioContext || window.webkitAudioContext; engine = S.createEngine(new Ctx()); }
    if (engine.ctx.state === 'suspended') engine.ctx.resume();
    return engine;
  }
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  function weightedPick(items, weightFn) {
    const w = items.map(weightFn); let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }
  function toast(msg) {
    let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 3500);
  }
  /* Лог ответа на сервер (и отметка «показано» для песен) */
  function logAnswer(rec) { if (store.user) api('POST', '/answer', rec).catch(() => {}); if (rec.songId) { store.seen.add(rec.songId); cacheState(); } }

  /* Контроллер страницы упражнения. page = { exercise, levels(mode), onReset() } */
  function page(cfg) {
    const ctx = { cfg, mode: store.mode };
    ctx.prog = () => { const k = cfg.exercise + '.' + ctx.mode; if (!store.progress[k]) store.progress[k] = { level: 1, history: [], confusion: {}, total: 0, correct: 0, streak: 0, best: 0 }; return store.progress[k]; };
    ctx.levels = () => cfg.levels(ctx.mode);
    ctx.levelDef = () => ctx.levels()[ctx.prog().level - 1];
    ctx.timbre = lvl => store.timbre === 'auto' ? pick(lvl.timbres) : store.timbre;
    ctx.autoNext = () => store.autoNext;
    ctx.errRate = label => { const c = ctx.prog().confusion[label]; return !c || c.n < 2 ? 0 : c.wrong / c.n; };
    ctx.recordConfusion = (label, given) => {
      const c = ctx.prog().confusion;
      if (!c[label]) c[label] = { n: 0, wrong: 0, given: {} };
      c[label].n++;
      if (label !== given) { c[label].wrong++; c[label].given[given] = (c[label].given[given] || 0) + 1; }
    };
    ctx.recordResult = correct => {
      const p = ctx.prog();
      p.total++; if (correct) { p.correct++; p.streak++; p.best = Math.max(p.best, p.streak); } else p.streak = 0;
      p.history.push(correct ? 1 : 0); if (p.history.length > 20) p.history.shift();
      let levelUp = false;
      if (p.history.length >= 20 && p.history.reduce((a, b) => a + b, 0) >= 16 && p.level < ctx.levels().length) { p.level++; p.history = []; levelUp = true; }
      save(); ctx.renderProgress();
      if (levelUp) { ctx.renderLevels(); toast('Уровень ' + p.level + ': ' + ctx.levelDef().title); }
      return levelUp;
    };
    ctx.renderLevels = () => {
      const p = ctx.prog();
      const el = $('#levels');
      if (el) {
        el.innerHTML = '<span class="lbl">Уровень</span>';
        ctx.levels().forEach((lvl, i) => {
          const b = document.createElement('button');
          b.className = 'lvl' + (i + 1 === p.level ? ' active' : ''); b.textContent = i + 1; b.dataset.tip = lvl.title;
          b.addEventListener('click', () => { p.level = i + 1; p.history = []; save(); ctx.renderLevels(); ctx.renderProgress(); cfg.onReset(); });
          el.appendChild(b);
        });
      }
      const lvl = ctx.levelDef();
      if ($('#levelNote')) $('#levelNote').innerHTML = `<b>${lvl.title}.</b> ${lvl.desc}.`;
      const list = $('#levelsList');
      if (list) {
        list.innerHTML = '';
        ctx.levels().forEach((l, i) => {
          const b = document.createElement('button');
          b.className = 'lvl-row' + (i + 1 === p.level ? ' active' : '');
          b.innerHTML = `<span class="num">${i + 1}</span><span><b>${l.title}</b><small>${l.desc}</small></span>`;
          b.addEventListener('click', () => { p.level = i + 1; p.history = []; save(); ctx.renderLevels(); ctx.renderProgress(); cfg.onReset(); });
          list.appendChild(b);
        });
      }
    };
    ctx.renderProgress = () => {
      const p = ctx.prog();
      const hist = $('#history');
      if (hist) { hist.innerHTML = ''; for (let i = 0; i < 20; i++) { const d = document.createElement('i'); if (i < p.history.length) d.className = p.history[i] ? 'y' : 'n'; hist.appendChild(d); } }
      const right = p.history.reduce((a, b) => a + b, 0);
      if ($('#progressText')) {
        const lines = [];
        lines.push(p.history.length ? `Из последних ${p.history.length} ответов верных: <b>${right}</b>.` : 'Ответов на этом уровне пока нет.');
        if (p.total) lines.push(`Серия сейчас <b>${p.streak}</b>, рекорд ${p.best}. Всего ${p.total} вопросов, верных ${p.correct}.`);
        lines.push(p.level < ctx.levels().length ? `Следующий уровень откроется, когда из последних 20 ответов будет верно 16${p.history.length < 20 ? ` (осталось ответить ещё ${20 - p.history.length})` : ''}.` : 'Это последний уровень.');
        $('#progressText').innerHTML = lines.map(l => `<p>${l}</p>`).join('');
      }
      if ($('#weak')) {
        const weak = Object.entries(p.confusion).filter(([, c]) => c.wrong > 0).map(([label, c]) => { const top = Object.entries(c.given).sort((a, b) => b[1] - a[1])[0]; return { label, wrong: c.wrong, top }; }).sort((a, b) => b.wrong - a.wrong).slice(0, 4);
        $('#weak').innerHTML = weak.length ? '<span class="lbl" style="color:var(--ink-2);font-size:15px">Чаще всего путаете:</span> ' + weak.map(w => `<span class="pill">${w.label} → ${w.top[0]} <span style="color:var(--ink-3)">×${w.top[1]}</span></span>`).join('') : '';
      }
    };
    ctx.renderSettings = () => {
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === ctx.mode));
      if ($('#modeSelect')) $('#modeSelect').value = ctx.mode;
      if ($('#timbre')) $('#timbre').value = store.timbre;
      if ($('#autoNext') && cfg.exercise !== 'songs' && cfg.exercise !== 'melodies') $('#autoNext').checked = store.autoNext;
    };
    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { ctx.mode = store.mode = b.dataset.mode; save(); ctx.renderSettings(); ctx.renderLevels(); ctx.renderProgress(); cfg.onReset(); }));
    // подпункт меню «Мажор/Минор» текущей страницы: переключаем лад на месте, без перезагрузки
    const here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-sub-box a').forEach(a => listen(a, 'click', ev => {
      const u = new URL(a.href, location.href); const m = u.searchParams.get('mode');
      if (u.pathname.split('/').pop() !== here || !['major', 'minor'].includes(m)) return;
      ev.preventDefault(); a.blur();
      if (m !== ctx.mode) { ctx.mode = store.mode = m; save(); cacheState(); ctx.renderSettings(); ctx.renderLevels(); ctx.renderProgress(); cfg.onReset(); }
    }));
    const ts = $('#timbre');
    if (ts) { Object.entries(S.PRESETS).forEach(([id, p]) => { const o = document.createElement('option'); o.value = id; o.textContent = p.name; ts.appendChild(o); }); ts.addEventListener('change', () => { store.timbre = ts.value; save(); }); }
    if ($('#autoNext') && cfg.exercise !== 'songs' && cfg.exercise !== 'melodies') $('#autoNext').addEventListener('change', e => { store.autoNext = e.target.checked; save(); });
    if ($('#btnReset')) $('#btnReset').addEventListener('click', async ev => {
      if (!await confirmPop(ev.currentTarget, 'Сбросить прогресс для этого упражнения в текущем ладу?')) return;
      delete store.progress[cfg.exercise + '.' + ctx.mode]; await api('DELETE', '/progress?key=' + encodeURIComponent(cfg.exercise + '.' + ctx.mode)).catch(() => {}); ctx.renderLevels(); ctx.renderProgress(); cfg.onReset();
    });
    ctx.renderSettings(); ctx.renderLevels(); ctx.renderProgress();
    return ctx;
  }

  /* Серия из N вопросов (живёт до перезагрузки) и попап настроек */
  function session(n, noun) {
    const st = { results: [] };
    st.render = active => {
      const steps = $('#sessionSteps'); if (!steps) return;
      steps.innerHTML = '';
      for (let i = 0; i < n; i++) { const d = document.createElement('i'); if (i < st.results.length) d.className = st.results[i] ? 'y' : 'n'; else if (i === st.results.length && active) d.className = 'cur'; steps.appendChild(d); }
      const right = st.results.filter(Boolean).length;
      const wrong = st.results.length - right;
      $('#sessionText').innerHTML = active ? `${noun} <b>${Math.min(st.results.length + 1, n)}</b> из ${n} <span class="cnt ok" data-tip="Верно">${right}</span><span class="cnt bad" data-tip="Ошибок">${wrong}</span>` : `Серия из ${n}`;
    };
    st.push = ok => { st.results.push(ok); if (st.results.length >= n) toast(`Серия завершена: верно ${st.results.filter(Boolean).length} из ${n}`); st.render(true); };
    st.nextIfDone = () => { if (st.results.length >= n) st.results = []; };
    return st;
  }
  /* Свои подсказки вместо браузерных: [data-tip] показывается по наведению и фокусу */
  function tips() {
    let bubble, cur, timer;
    const hide = () => { clearTimeout(timer); if (bubble) bubble.hidden = true; cur = null; };
    const show = el => {
      const text = el.dataset.tip; if (!text) return;
      if (!bubble) { bubble = document.createElement('div'); bubble.className = 'tip-bubble'; bubble.hidden = true; document.body.appendChild(bubble); }
      bubble.textContent = text; bubble.hidden = false; cur = el;
      const r = el.getBoundingClientRect(), b = bubble.getBoundingClientRect();
      let left = r.left + r.width / 2 - b.width / 2; left = Math.max(8, Math.min(left, window.innerWidth - b.width - 8));
      const below = r.bottom + 8 + b.height < window.innerHeight;
      bubble.classList.toggle('above', !below);
      bubble.style.left = left + window.scrollX + 'px';
      bubble.style.top = (below ? r.bottom + 8 : r.top - b.height - 8) + window.scrollY + 'px';
    };
    const target = ev => ev.target.closest && ev.target.closest('[data-tip]');
    document.addEventListener('mouseover', ev => { const el = target(ev); if (!el || el === cur) return; clearTimeout(timer); timer = setTimeout(() => show(el), 350); });
    document.addEventListener('mouseout', ev => { const el = target(ev); if (el && !el.contains(ev.relatedTarget)) hide(); });
    document.addEventListener('focusin', ev => { const el = target(ev); if (el) show(el); });
    document.addEventListener('focusout', hide);
    document.addEventListener('mousedown', hide, true);
    document.addEventListener('scroll', hide, true);
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') hide(); });
  }
  tips();
  /* Подтверждение действием в попапе у кнопки вместо confirm() */
  function confirmPop(anchor, text) {
    return new Promise(resolve => {
      document.querySelectorAll('.confirm-pop').forEach(p => p.remove());
      const pop = document.createElement('div'); pop.className = 'confirm-pop';
      pop.innerHTML = `<div class="confirm-text">${text}</div><div class="confirm-actions"><button class="btn mini" data-ok>Да</button><button class="btn quiet mini" data-no>Отмена</button></div>`;
      document.body.appendChild(pop);
      const r = anchor.getBoundingClientRect(), b = pop.getBoundingClientRect();
      let left = r.left + r.width / 2 - b.width / 2; left = Math.max(8, Math.min(left, window.innerWidth - b.width - 8));
      pop.style.left = left + window.scrollX + 'px'; pop.style.top = r.bottom + 8 + window.scrollY + 'px';
      const done = v => { pop.remove(); document.removeEventListener('click', outside, true); document.removeEventListener('keydown', esc); resolve(v); };
      const outside = ev => { if (!pop.contains(ev.target)) done(false); };
      const esc = ev => { if (ev.key === 'Escape') done(false); };
      pop.querySelector('[data-ok]').addEventListener('click', () => done(true));
      pop.querySelector('[data-no]').addEventListener('click', () => done(false));
      setTimeout(() => { document.addEventListener('click', outside, true); document.addEventListener('keydown', esc); }, 0);
      pop.querySelector('[data-no]').focus();
    });
  }
  function settingsPopover() {
    const gear = $('#btnSettings'), pop = $('#settingsPop'); if (!gear || !pop) return;
    if (!pop.querySelector('.modal-close')) { const x = document.createElement('button'); x.className = 'modal-close'; x.type = 'button'; x.setAttribute('aria-label', 'Закрыть'); x.textContent = '×'; x.addEventListener('click', () => { pop.hidden = true; }); pop.prepend(x); }
    gear.addEventListener('click', ev => { ev.stopPropagation(); pop.hidden = !pop.hidden; });
    listen(document, 'click', ev => { if (!pop.hidden && !pop.contains(ev.target)) pop.hidden = true; });
    listen(document, 'keydown', ev => { if (ev.key === 'Escape') pop.hidden = true; });
  }

  /* ---------- мягкая навигация: страницы подменяются без перезагрузки ----------
     Скрипты страницы регистрируют слушатели документа через ET.listen и уборку через ET.onLeave;
     при переходе они снимаются, содержимое .wrap после шапки заменяется, скрипты страницы запускаются заново. */
  const PAGES = /^(index|degrees|progressions|songs|melodies|history|account)\.html$/;
  const ONCE = /^(theory|progressions|songs-db|synth|yt|common|header)\.js$/;  // библиотеки: грузятся один раз
  const leaveFns = [];
  function onLeave(fn) { leaveFns.push(fn); }
  function listen(target, type, fn, opts) { target.addEventListener(type, fn, opts); leaveFns.push(() => target.removeEventListener(type, fn, opts)); }
  function interval(fn, ms) { const id = setInterval(fn, ms); leaveFns.push(() => clearInterval(id)); return id; }
  function runLeave() { while (leaveFns.length) { try { leaveFns.pop()(); } catch (e) { /* уборка не должна ломать переход */ } } }
  const loadedScripts = new Set([...document.scripts].map(x => x.getAttribute('src')).filter(Boolean));
  function loadScript(src) { return new Promise(resolve => { const x = document.createElement('script'); x.src = src; x.onload = x.onerror = () => { x.remove(); resolve(); }; document.body.appendChild(x); }); }
  function fileOf(u) { return u.pathname.split('/').pop() || 'index.html'; }
  function markNav(file) {
    document.querySelectorAll('.nav a').forEach(a => { if (a.closest('.nav-sub')) return; const h = (a.getAttribute('href') || '').split('?')[0]; a.classList.toggle('current', h === file && file !== 'index.html'); });
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('current', !!i.querySelector(':scope > a.current')));
  }
  async function prepare(file) {
    if (file !== 'index.html' && !store.user) return toLogin();
    forceMode();
    if (document.body.dataset.task && !store.songs.length) await loadSongs();
  }
  let navSeq = 0;
  async function navigate(href, push) {
    const u = new URL(href, location.href), file = fileOf(u), seq = ++navSeq;
    let html;
    try { const r = await fetch(u.pathname + u.search, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); html = await r.text(); } catch (e) { location.href = u.href; return; }
    if (seq !== navSeq) return;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const newWrap = doc.querySelector('.wrap'), wrap = document.querySelector('.wrap'), header = wrap && wrap.querySelector('header.top');
    if (!newWrap || !header) { location.href = u.href; return; }
    runLeave();
    document.querySelectorAll('.confirm-pop, .tip-bubble, .auth-overlay').forEach(el => el.remove());
    if (push) history.pushState({ soft: true }, '', u.pathname + u.search + u.hash);
    applyUrlMode();
    const inlineInWrap = [];
    const swap = () => {
      document.title = doc.title;
      [...document.body.attributes].forEach(a => document.body.removeAttribute(a.name));
      [...doc.body.attributes].forEach(a => document.body.setAttribute(a.name, a.value));
      let n = header.nextSibling; while (n) { const nx = n.nextSibling; if (!(n.nodeType === 1 && n.tagName === 'SCRIPT' && /header\.js$/.test(n.getAttribute('src') || ''))) n.remove(); n = nx; }
      [...newWrap.childNodes].forEach(node => {
        if (node.nodeType === 1 && (node.matches('header.top') || (node.tagName === 'SCRIPT' && /header\.js$/.test(node.getAttribute('src') || '')))) return;
        const imp = document.importNode(node, true); wrap.appendChild(imp);
        if (imp.nodeType === 1) (imp.tagName === 'SCRIPT' ? [imp] : [...imp.querySelectorAll('script')]).forEach(x => inlineInWrap.push(x));
      });
      markNav(file); window.scrollTo(0, 0);
    };
    if (document.startViewTransition) { try { await document.startViewTransition(swap).updateCallbackDone; } catch (e) { swap(); } } else swap();
    ET.ready = prepare(file);
    // скрипты внутри .wrap (из DOMParser не выполняются — пересоздаём на месте)
    for (const x of inlineInWrap) { const ns = document.createElement('script'); if (x.src) ns.src = x.getAttribute('src'); else ns.text = x.text; x.replaceWith(ns); }
    // скрипты страницы в конце body: библиотеки — один раз, скрипт страницы — заново
    for (const x of [...doc.body.children].filter(el => el.tagName === 'SCRIPT')) {
      const src = x.getAttribute('src');
      if (src) { if (ONCE.test(src) && loadedScripts.has(src)) continue; await loadScript(src); loadedScripts.add(src); }
      else { const ns = document.createElement('script'); ns.text = x.text; document.body.appendChild(ns); ns.remove(); }
    }
  }
  document.addEventListener('click', ev => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const a = ev.target.closest && ev.target.closest('a[href]'); if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const u = new URL(a.href, location.href); if (u.origin !== location.origin || !PAGES.test(fileOf(u))) return;
    ev.preventDefault(); navigate(u.href, true);
  });
  window.addEventListener('popstate', () => { navigate(location.href, false); });

  const ET = { store, save, api, audio, pick, weightedPick, toast, page, session, settingsPopover, confirmPop, logAnswer, loadSongs, loadState, showLogin, listen, onLeave, interval, navigate, ready: null, $ };
  ET.ready = init();
  return ET;
})();
